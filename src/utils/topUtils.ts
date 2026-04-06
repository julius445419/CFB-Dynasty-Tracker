export const parseTOPToSeconds = (top: string | undefined): number => {
  if (!top || !top.includes(':')) return 0;
  const [mins, secs] = top.split(':').map(n => parseInt(n) || 0);
  return (mins * 60) + secs;
};

export const normalizeTOP = (awaySeconds: number, homeSeconds: number) => {
  const totalRawSeconds = awaySeconds + homeSeconds;
  if (totalRawSeconds === 0) return { awayNormalized: 0, homeNormalized: 0 };

  // Calculate ratio
  const awayRatio = awaySeconds / totalRawSeconds;
  const homeRatio = homeSeconds / totalRawSeconds;

  // Scale to 60 minutes (3600 seconds)
  let awayNormalized = Math.round(awayRatio * 3600);
  let homeNormalized = Math.round(homeRatio * 3600);

  // Zero-Sum Adjustment
  const sum = awayNormalized + homeNormalized;
  if (sum !== 3600) {
    const diff = 3600 - sum;
    // Assign leftover to the team with higher raw TOP
    if (awaySeconds >= homeSeconds) {
      awayNormalized += diff;
    } else {
      homeNormalized += diff;
    }
  }

  return { awayNormalized, homeNormalized };
};

export const formatSecondsToMMSS = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
