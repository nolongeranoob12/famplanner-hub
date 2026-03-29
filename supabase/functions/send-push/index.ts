import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── helpers ──────────────────────────────────────────────────────────

function base64UrlToUint8Array(b64: string): Uint8Array {
  const base64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const raw = atob(base64 + "=".repeat(pad));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const pubRaw = base64UrlToUint8Array(publicKeyB64);
  const privRaw = base64UrlToUint8Array(privateKeyB64);

  // Build uncompressed public key (65 bytes: 0x04 + X + Y)
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(pubRaw, 1);

  const publicKey = await crypto.subtle.importKey(
    "raw",
    uncompressed,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privRaw, pubRaw),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  return { publicKey, privateKey };
}

function buildPkcs8(privBytes: Uint8Array, pubBytes: Uint8Array): ArrayBuffer {
  // Minimal PKCS#8 wrapper for EC P-256 private key
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const mid = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00, 0x04]);
  const result = new Uint8Array(
    header.length + privBytes.length + mid.length + pubBytes.length
  );
  result.set(header);
  result.set(privBytes, header.length);
  result.set(mid, header.length + privBytes.length);
  result.set(pubBytes, header.length + privBytes.length + mid.length);
  return result.buffer;
}

function uint8ToBase64Url(arr: Uint8Array): string {
  let binary = "";
  arr.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidAuthHeader(
  endpoint: string,
  publicKeyB64: string,
  privateKeyB64: string
) {
  const { publicKey, privateKey } = await importVapidKeys(publicKeyB64, privateKeyB64);

  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp, sub: "mailto:family@chaufamily.app" };

  const enc = new TextEncoder();
  const headerB64 = uint8ToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ToBase64Url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(unsigned)
  );

  // Convert DER signature to raw r||s
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

  return {
    authorization: `vapid t=${token}, k=${pubB64}`,
  };
}

// ── main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body, exclude_member } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all push subscriptions (optionally exclude the person who made the change)
    let query = supabase.from("push_subscriptions").select("*");
    if (exclude_member) {
      query = query.neq("member_name", exclude_member);
    }
    const { data: subs, error } = await query;
    if (error) throw error;

    const results = await Promise.allSettled(
      (subs ?? []).map(async (sub: any) => {
        const vapidHeaders = await createVapidAuthHeader(
          sub.endpoint,
          vapidPublic,
          vapidPrivate
        );

        const payloadBytes = new TextEncoder().encode(
          JSON.stringify({ title, body })
        );

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            ...vapidHeaders,
            "Content-Type": "application/octet-stream",
            TTL: "86400",
          },
          body: payloadBytes,
        });

        if (res.status === 404 || res.status === 410) {
          // Subscription expired — clean up
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }

        return { endpoint: sub.endpoint, status: res.status };
      })
    );

    return new Response(JSON.stringify({ sent: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
