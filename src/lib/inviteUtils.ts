/**
 * Generates a random, 6-character alphanumeric string for unique invites.
 * Excludes ambiguous characters (O, 0, I, l).
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
