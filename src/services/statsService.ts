import { doc, getDoc, WriteBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Game, TeamStats, TeamSeasonStats } from '../types';

const topToSeconds = (top?: string): number => {
  if (!top) return 0;
  const [mins, secs] = top.split(':').map(Number);
  return (mins || 0) * 60 + (secs || 0);
};

const calculateDerivedStats = (stats: Partial<TeamSeasonStats>) => {
  const games = stats.gamesPlayed || 0;
  if (games === 0) return stats;

  const passAtt = stats.passAttempts || 0;
  const rushAtt = stats.rushAttempts || 0;

  return {
    ...stats,
    ppg: (stats.pointsScored || 0) / games,
    passYpg: (stats.passYards || 0) / games,
    rushYpg: (stats.rushYards || 0) / games,
    totalOffYpg: ((stats.passYards || 0) + (stats.rushYards || 0)) / games,
    rushYpc: rushAtt > 0 ? (stats.rushYards || 0) / rushAtt : 0,
    compPct: passAtt > 0 ? ((stats.passComps || 0) / passAtt) * 100 : 0,
    papg: (stats.pointsAllowed || 0) / games,
    defPassYpgAllowed: (stats.defPassYards || 0) / games,
    defRushYpgAllowed: (stats.defRushYards || 0) / games,
    defTotalYpgAllowed: ((stats.defPassYards || 0) + (stats.defRushYards || 0)) / games,
    turnoverMargin: ((stats.defIntsCaught || 0) + (stats.defFumblesRecovered || 0)) - ((stats.intsThrown || 0) + (stats.fumblesLost || 0)),
  };
};

/**
 * Updates the team_stats collection for both teams in a completed game.
 * This function handles both new results and updates by calculating the difference.
 */
export const updateTeamStats = async (
  batch: WriteBatch,
  leagueId: string,
  game: Game,
  newHomeScore: number,
  newAwayScore: number,
  newHomeStats: TeamStats,
  newAwayStats: TeamStats,
  isNewResult: boolean,
  quarterLength: number = 5 // Default to 5 if not provided
) => {
  const season = game.season || 2025;
  const normalizationFactor = 60 / (quarterLength * 4);
  
  const homeStatsId = `${game.homeTeamId}_${season}`;
  const awayStatsId = `${game.awayTeamId}_${season}`;
  
  const homeStatsRef = doc(db, 'leagues', leagueId, 'team_stats', homeStatsId);
  const awayStatsRef = doc(db, 'leagues', leagueId, 'team_stats', awayStatsId);

  const [homeSnap, awaySnap] = await Promise.all([
    getDoc(homeStatsRef),
    getDoc(awayStatsRef)
  ]);

  const currentHome = homeSnap.exists() ? homeSnap.data() as TeamSeasonStats : {
    teamId: game.homeTeamId,
    seasonYear: season,
    gamesPlayed: 0,
    pointsScored: 0,
    pointsAllowed: 0,
    passAttempts: 0,
    passComps: 0,
    passYards: 0,
    passTds: 0,
    intsThrown: 0,
    rushAttempts: 0,
    rushYards: 0,
    rushTds: 0,
    firstDowns: 0,
    fumblesLost: 0,
    defPassAttempts: 0,
    defPassComps: 0,
    defPassYards: 0,
    defPassTds: 0,
    defIntsCaught: 0,
    defRushAttempts: 0,
    defRushYards: 0,
    defRushTds: 0,
    defFirstDownsAllowed: 0,
    defFumblesRecovered: 0,
    penalties: 0,
    penaltyYards: 0,
    timeOfPossessionSeconds: 0,
    normalizedTopSeconds: 0
  } as TeamSeasonStats;

  const currentAway = awaySnap.exists() ? awaySnap.data() as TeamSeasonStats : {
    teamId: game.awayTeamId,
    seasonYear: season,
    gamesPlayed: 0,
    pointsScored: 0,
    pointsAllowed: 0,
    passAttempts: 0,
    passComps: 0,
    passYards: 0,
    passTds: 0,
    intsThrown: 0,
    rushAttempts: 0,
    rushYards: 0,
    rushTds: 0,
    firstDowns: 0,
    fumblesLost: 0,
    defPassAttempts: 0,
    defPassComps: 0,
    defPassYards: 0,
    defPassTds: 0,
    defIntsCaught: 0,
    defRushAttempts: 0,
    defRushYards: 0,
    defRushTds: 0,
    defFirstDownsAllowed: 0,
    defFumblesRecovered: 0,
    penalties: 0,
    penaltyYards: 0,
    timeOfPossessionSeconds: 0,
    normalizedTopSeconds: 0
  } as TeamSeasonStats;

  const oldHomeScore = isNewResult ? 0 : (game.homeScore || 0);
  const oldAwayScore = isNewResult ? 0 : (game.awayScore || 0);
  const oldHomeStats = isNewResult ? {} as TeamStats : (game.homeStats || {} as TeamStats);
  const oldAwayStats = isNewResult ? {} as TeamStats : (game.awayStats || {} as TeamStats);

  const getDiff = (newVal?: number, oldVal?: number) => (newVal || 0) - (oldVal || 0);

  const updatedHome: Partial<TeamSeasonStats> = {
    ...currentHome,
    gamesPlayed: Number(currentHome.gamesPlayed || 0) + (isNewResult ? 1 : 0),
    pointsScored: Number(currentHome.pointsScored || 0) + (newHomeScore - oldHomeScore),
    pointsAllowed: Number(currentHome.pointsAllowed || 0) + (newAwayScore - oldAwayScore),
    passAttempts: Number(currentHome.passAttempts || 0) + getDiff(newHomeStats.passingAttempts, oldHomeStats.passingAttempts),
    passComps: Number(currentHome.passComps || 0) + getDiff(newHomeStats.completions, oldHomeStats.completions),
    passYards: Number(currentHome.passYards || 0) + getDiff(newHomeStats.passYards, oldHomeStats.passYards),
    passTds: Number(currentHome.passTds || 0) + getDiff(newHomeStats.passingTds, oldHomeStats.passingTds),
    intsThrown: Number(currentHome.intsThrown || 0) + getDiff(newHomeStats.interceptionsThrown, oldHomeStats.interceptionsThrown),
    rushAttempts: Number(currentHome.rushAttempts || 0) + getDiff(newHomeStats.rushingAttempts, oldHomeStats.rushingAttempts),
    rushYards: Number(currentHome.rushYards || 0) + getDiff(newHomeStats.rushYards, oldHomeStats.rushYards),
    rushTds: Number(currentHome.rushTds || 0) + getDiff(newHomeStats.rushingTds, oldHomeStats.rushingTds),
    firstDowns: Number(currentHome.firstDowns || 0) + getDiff(newHomeStats.firstDowns, oldHomeStats.firstDowns),
    fumblesLost: Number(currentHome.fumblesLost || 0) + getDiff(newHomeStats.fumblesLost, oldHomeStats.fumblesLost),
    defPassAttempts: Number(currentHome.defPassAttempts || 0) + getDiff(newAwayStats.passingAttempts, oldAwayStats.passingAttempts),
    defPassComps: Number(currentHome.defPassComps || 0) + getDiff(newAwayStats.completions, oldAwayStats.completions),
    defPassYards: Number(currentHome.defPassYards || 0) + getDiff(newAwayStats.passYards, oldAwayStats.passYards),
    defPassTds: Number(currentHome.defPassTds || 0) + getDiff(newAwayStats.passingTds, oldAwayStats.passingTds),
    defIntsCaught: Number(currentHome.defIntsCaught || 0) + getDiff(newAwayStats.interceptionsThrown, oldAwayStats.interceptionsThrown),
    defRushAttempts: Number(currentHome.defRushAttempts || 0) + getDiff(newAwayStats.rushingAttempts, oldAwayStats.rushingAttempts),
    defRushYards: Number(currentHome.defRushYards || 0) + getDiff(newAwayStats.rushYards, oldAwayStats.rushYards),
    defRushTds: Number(currentHome.defRushTds || 0) + getDiff(newAwayStats.rushingTds, oldAwayStats.rushingTds),
    defFirstDownsAllowed: Number(currentHome.defFirstDownsAllowed || 0) + getDiff(newAwayStats.firstDowns, oldAwayStats.firstDowns),
    defFumblesRecovered: Number(currentHome.defFumblesRecovered || 0) + getDiff(newAwayStats.fumblesLost, oldAwayStats.fumblesLost),
    penalties: Number(currentHome.penalties || 0) + getDiff(newHomeStats.penalties, oldHomeStats.penalties),
    penaltyYards: Number(currentHome.penaltyYards || 0) + getDiff(newHomeStats.penaltyYards, oldHomeStats.penaltyYards),
    timeOfPossessionSeconds: Number(currentHome.timeOfPossessionSeconds || 0) + getDiff(topToSeconds(newHomeStats.timeOfPossession), topToSeconds(oldHomeStats.timeOfPossession)),
    normalizedTopSeconds: Number(currentHome.normalizedTopSeconds || 0) + (getDiff(topToSeconds(newHomeStats.timeOfPossession), topToSeconds(oldHomeStats.timeOfPossession)) * normalizationFactor),
    updatedAt: serverTimestamp()
  };

  const updatedAway: Partial<TeamSeasonStats> = {
    ...currentAway,
    gamesPlayed: Number(currentAway.gamesPlayed || 0) + (isNewResult ? 1 : 0),
    pointsScored: Number(currentAway.pointsScored || 0) + (newAwayScore - oldAwayScore),
    pointsAllowed: Number(currentAway.pointsAllowed || 0) + (newHomeScore - oldHomeScore),
    passAttempts: Number(currentAway.passAttempts || 0) + getDiff(newAwayStats.passingAttempts, oldAwayStats.passingAttempts),
    passComps: Number(currentAway.passComps || 0) + getDiff(newAwayStats.completions, oldAwayStats.completions),
    passYards: Number(currentAway.passYards || 0) + getDiff(newAwayStats.passYards, oldAwayStats.passYards),
    passTds: Number(currentAway.passTds || 0) + getDiff(newAwayStats.passingTds, oldAwayStats.passingTds),
    intsThrown: Number(currentAway.intsThrown || 0) + getDiff(newAwayStats.interceptionsThrown, oldAwayStats.interceptionsThrown),
    rushAttempts: Number(currentAway.rushAttempts || 0) + getDiff(newAwayStats.rushingAttempts, oldAwayStats.rushingAttempts),
    rushYards: Number(currentAway.rushYards || 0) + getDiff(newAwayStats.rushYards, oldAwayStats.rushYards),
    rushTds: Number(currentAway.rushTds || 0) + getDiff(newAwayStats.rushingTds, oldAwayStats.rushingTds),
    firstDowns: Number(currentAway.firstDowns || 0) + getDiff(newAwayStats.firstDowns, oldAwayStats.firstDowns),
    fumblesLost: Number(currentAway.fumblesLost || 0) + getDiff(newAwayStats.fumblesLost, oldAwayStats.fumblesLost),
    defPassAttempts: Number(currentAway.defPassAttempts || 0) + getDiff(newHomeStats.passingAttempts, oldHomeStats.passingAttempts),
    defPassComps: Number(currentAway.defPassComps || 0) + getDiff(newHomeStats.completions, oldHomeStats.completions),
    defPassYards: Number(currentAway.defPassYards || 0) + getDiff(newHomeStats.passYards, oldHomeStats.passYards),
    defPassTds: Number(currentAway.defPassTds || 0) + getDiff(newHomeStats.passingTds, oldHomeStats.passingTds),
    defIntsCaught: Number(currentAway.defIntsCaught || 0) + getDiff(newHomeStats.interceptionsThrown, oldHomeStats.interceptionsThrown),
    defRushAttempts: Number(currentAway.defRushAttempts || 0) + getDiff(newHomeStats.rushingAttempts, oldHomeStats.rushingAttempts),
    defRushYards: Number(currentAway.defRushYards || 0) + getDiff(newHomeStats.rushYards, oldHomeStats.rushYards),
    defRushTds: Number(currentAway.defRushTds || 0) + getDiff(newHomeStats.rushingTds, oldHomeStats.rushingTds),
    defFirstDownsAllowed: Number(currentAway.defFirstDownsAllowed || 0) + getDiff(newHomeStats.firstDowns, oldHomeStats.firstDowns),
    defFumblesRecovered: Number(currentAway.defFumblesRecovered || 0) + getDiff(newHomeStats.fumblesLost, oldHomeStats.fumblesLost),
    penalties: Number(currentAway.penalties || 0) + getDiff(newAwayStats.penalties, oldAwayStats.penalties),
    penaltyYards: Number(currentAway.penaltyYards || 0) + getDiff(newAwayStats.penaltyYards, oldAwayStats.penaltyYards),
    timeOfPossessionSeconds: Number(currentAway.timeOfPossessionSeconds || 0) + getDiff(topToSeconds(newAwayStats.timeOfPossession), topToSeconds(oldAwayStats.timeOfPossession)),
    normalizedTopSeconds: Number(currentAway.normalizedTopSeconds || 0) + (getDiff(topToSeconds(newAwayStats.timeOfPossession), topToSeconds(oldAwayStats.timeOfPossession)) * normalizationFactor),
    updatedAt: serverTimestamp()
  };

  batch.set(homeStatsRef, calculateDerivedStats(updatedHome), { merge: true });
  batch.set(awayStatsRef, calculateDerivedStats(updatedAway), { merge: true });
};
