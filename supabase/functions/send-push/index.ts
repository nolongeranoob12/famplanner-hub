import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Web Push Encryption (RFC 8291 / aes128gcm) ──────────────────────

function base64UrlToUint8Array(b64: string): Uint8Array {
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const raw = atob(base64 + "=".repeat(pad));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ToBase64Url(arr: Uint8Array): string {
  let binary = "";
  arr.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

async function hkdfExtractAndExpand(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await crypto.subtle.importKey("raw", ikm as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const saltBuf = (salt.length ? salt : new Uint8Array(32)) as BufferSource;
  const prkSigned = new Uint8Array(await crypto.subtle.sign("HMAC", prk, saltBuf));
  const key = await crypto.subtle.importKey("raw", prkSigned as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = concat(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", key, infoWithCounter as BufferSource));
  return okm.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(type);
  const nul = new Uint8Array([0]);
  const header = enc.encode("Content-Encoding: ");
  const p256 = enc.encode("P-256");
  const clientLen = new Uint8Array(2); clientLen[0] = 0; clientLen[1] = clientPublicKey.length;
  const serverLen = new Uint8Array(2); serverLen[0] = 0; serverLen[1] = serverPublicKey.length;
  return concat(header, typeBytes, nul, p256, nul, clientLen, clientPublicKey, serverLen, serverPublicKey);
}

async function encryptPayload(plaintext: Uint8Array, subscriberPublicKeyB64: string, subscriberAuthB64: string): Promise<{ encrypted: Uint8Array; localPublicKey: Uint8Array }> {
  const subscriberAuth = base64UrlToUint8Array(subscriberAuthB64.replace(/\+/g, "-").replace(/\//g, "_"));
  const subscriberPublicKeyRaw = base64UrlToUint8Array(subscriberPublicKeyB64.replace(/\+/g, "-").replace(/\//g, "_"));
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));
  const subscriberPublicKey = await crypto.subtle.importKey("raw", subscriberPublicKeyRaw as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberPublicKey }, localKeyPair.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const authInfo = concat(enc.encode("WebPush: info\0"), subscriberPublicKeyRaw, localPublicKeyRaw);
  const ikm = await hkdfExtractAndExpand(subscriberAuth, sharedSecret, authInfo, 32);
  const cekInfo = createInfo("aes128gcm", subscriberPublicKeyRaw, localPublicKeyRaw);
  const nonceInfo = createInfo("nonce", subscriberPublicKeyRaw, localPublicKeyRaw);
  const cek = await hkdfExtractAndExpand(salt, ikm, cekInfo, 16);
  const nonce = await hkdfExtractAndExpand(salt, ikm, nonceInfo, 12);
  const padded = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, padded as BufferSource));
  const rs = new Uint8Array(4);
  const rsView = new DataView(rs.buffer);
  rsView.setUint32(0, 4096);
  const idLen = new Uint8Array([localPublicKeyRaw.length]);
  const encrypted = concat(salt, rs, idLen, localPublicKeyRaw, ciphertext);
  return { encrypted, localPublicKey: localPublicKeyRaw };
}

// ── VAPID JWT ───────────────────────────────────────────────────────

function buildPkcs8(privBytes: Uint8Array, pubBytes: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20]);
  const mid = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00, 0x04]);
  const result = new Uint8Array(header.length + privBytes.length + mid.length + pubBytes.length);
  result.set(header);
  result.set(privBytes, header.length);
  result.set(mid, header.length + privBytes.length);
  result.set(pubBytes, header.length + privBytes.length + mid.length);
  return result.buffer;
}

async function createVapidAuthHeader(endpoint: string, publicKeyB64: string, privateKeyB64: string) {
  const pubRaw = base64UrlToUint8Array(publicKeyB64);
  const privRaw = base64UrlToUint8Array(privateKeyB64);
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(pubRaw, 1);
  const publicKey = await crypto.subtle.importKey("raw", uncompressed, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  const privateKey = await crypto.subtle.importKey("pkcs8", buildPkcs8(privRaw, pubRaw), { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp, sub: "mailto:family@familyconnecthub.app" };
  const enc = new TextEncoder();
  const headerB64 = uint8ToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ToBase64Url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(unsigned));
  const derSig = new Uint8Array(sig);
  let offset = 2;
  const rLen = derSig[offset + 1];
  const r = derSig.slice(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;
  const sLen = derSig[offset + 1];
  const s = derSig.slice(offset + 2, offset + 2 + sLen);
  const rawSig = new Uint8Array(64);
  rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  const token = `${unsigned}.${uint8ToBase64Url(rawSig)}`;
  const pubExported = await crypto.subtle.exportKey("raw", publicKey);
  const pubB64 = uint8ToBase64Url(new Uint8Array(pubExported));
  return { authorization: `vapid t=${token}, k=${pubB64}` };
}

// ── Main handler ────────────────────────────────────────────────────

function normalizeApnsKey(raw: string) {
  return raw.replace(/\\n/g, "\n").trim();
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = normalizeApnsKey(pem)
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  return base64UrlToUint8Array(b64).buffer;
}

function ecdsaSignatureToJwt(sig: Uint8Array): Uint8Array {
  if (sig.length === 64) return sig;
  let offset = 2;
  const rLen = sig[offset + 1];
  const r = sig.slice(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;
  const sLen = sig[offset + 1];
  const s = sig.slice(offset + 2, offset + 2 + sLen);
  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

async function createApnsJwt(teamId: string, keyId: string, privateKey: string) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = uint8ToBase64Url(enc.encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = uint8ToBase64Url(enc.encode(JSON.stringify({ iss: teamId, iat: now })));
  const unsigned = `${header}.${payload}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
  return `${unsigned}.${uint8ToBase64Url(ecdsaSignatureToJwt(new Uint8Array(sig)))}`;
}

async function sendApnsPush(args: { token: string; title: string; body: string; badge: number; bundleId: string; jwt: string; host: string }) {
  const res = await fetch(`https://${args.host}/3/device/${args.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${args.jwt}`,
      "apns-topic": args.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: args.title, body: args.body },
        sound: "default",
        badge: args.badge,
        "mutable-content": 1,
      },
      url: "/",
    }),
  });
  let reason = "";
  if (res.status >= 400) {
    try { reason = await res.clone().text(); } catch { /* ignore */ }
  }
  return { res, reason };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body, family_id, exclude_user_id, platform } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
    const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY");
    const defaultBundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "com.nolongeranoob12.famplannerhub";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Family-scoped: only deliver to subscriptions in the same family
    let query = supabase.from("push_subscriptions").select("*");
    if (family_id) query = query.eq("family_id", family_id);
    if (exclude_user_id) query = query.neq("user_id", exclude_user_id);
    if (platform === "ios") query = query.eq("platform", "ios").not("device_token", "is", null);

    const { data: subs, error } = await query;
    if (error) throw error;

    console.log(`Found ${(subs ?? []).length} push subscriptions to notify (family ${family_id})`);

    // Per-user unread counts for badge sync
    const userIds = [...new Set((subs ?? []).map((s: any) => s.user_id).filter(Boolean))];
    const unreadCounts = new Map<string, number>();
    if (userIds.length > 0) {
      const { data: unread } = await supabase
        .from("notifications")
        .select("user_id")
        .in("user_id", userIds as string[])
        .eq("is_read", false);
      for (const row of unread ?? []) {
        const uid = (row as { user_id: string }).user_id;
        if (uid) unreadCounts.set(uid, (unreadCounts.get(uid) ?? 0) + 1);
      }
    }

    const results = await Promise.allSettled(
      (subs ?? []).map(async (sub: any) => {
        if (sub.platform === "ios" || sub.endpoint?.startsWith("apns://") || sub.device_token) {
          if (!apnsKeyId || !apnsTeamId || !apnsPrivateKey) {
            console.log(`Skipping native push for ${sub.user_id}: APNs secrets not configured`);
            return { endpoint: sub.endpoint, status: 0, skipped: "missing-apns-secrets" };
          }

          const jwt = await createApnsJwt(apnsTeamId, apnsKeyId, apnsPrivateKey);
          const badge = unreadCounts.get(sub.user_id) ?? 1;
          const token = sub.device_token ?? String(sub.endpoint).replace("apns://", "");
          const bundleId = sub.bundle_id ?? defaultBundleId;

          // Try production first; on BadDeviceToken (400) fall back to sandbox.
          let { res, reason } = await sendApnsPush({ token, title, body, badge, bundleId, jwt, host: "api.push.apple.com" });
          let host = "api.push.apple.com";
          if (res.status === 400 && /BadDeviceToken/i.test(reason)) {
            console.log(`Prod APNs returned BadDeviceToken for ${sub.user_id}, retrying sandbox`);
            const fallback = await sendApnsPush({ token, title, body, badge, bundleId, jwt, host: "api.sandbox.push.apple.com" });
            res = fallback.res;
            reason = fallback.reason;
            host = "api.sandbox.push.apple.com";
          }

          console.log(`APNs ${host} -> user ${sub.user_id}: status ${res.status}${reason ? ` reason=${reason}` : ""} topic=${bundleId}`);

          if (res.status === 410 || (res.status === 400 && /BadDeviceToken/i.test(reason))) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
          return { endpoint: sub.endpoint, status: res.status, reason };
        }

        const vapidHeaders = await createVapidAuthHeader(sub.endpoint, vapidPublic, vapidPrivate);

        const payloadBytes = new TextEncoder().encode(JSON.stringify({
          title,
          body,
          url: "/",
          badgeCount: unreadCounts.get(sub.user_id) ?? 1,
        }));

        const { encrypted } = await encryptPayload(payloadBytes, sub.p256dh, sub.auth);

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            ...vapidHeaders,
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
          },
          body: encrypted,
        });

        console.log(`Push to user ${sub.user_id}: status ${res.status}`);

        if (res.status === 404 || res.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }

        return { endpoint: sub.endpoint, status: res.status };
      })
    );

    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
