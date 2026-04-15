/**
 * Trigger haptic feedback via the Vibration API.
 * Falls back silently on unsupported devices.
 */
export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!navigator.vibrate) return;
  const patterns: Record<string, number> = {
    light: 10,
    medium: 25,
    heavy: 50,
  };
  navigator.vibrate(patterns[style]);
}
