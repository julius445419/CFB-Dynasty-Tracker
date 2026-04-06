export const normalizeYards = (yards: number | undefined, quarterLength: number | undefined): number => {
  if (yards === undefined || quarterLength === undefined || quarterLength <= 0) return yards || 0;
  // Normalize to 15-minute quarters (60-minute game)
  const multiplier = 15 / quarterLength;
  return Math.round(yards * multiplier);
};
