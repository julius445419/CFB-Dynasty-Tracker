export interface GhostCoach {
  id: string;
  leagueId: string;
  firstName: string;
  lastName: string;
  teamId: string;
  role: 'HC' | 'OC' | 'DC';
  inviteCode?: string;
  isLinked: boolean;
  linkedUserId?: string;
  createdAt: any;
}

export interface Coach {
  id: number;
  firstName: string;
  lastName: string;
  school: string;
  role: 'HC' | 'OC' | 'DC';
  prestige: string;
  level: number;
  archetype: string;
  offensiveScheme: string;
  defensiveScheme: string;
}

export interface CarouselCoach {
  id: string;
  leagueId: string;
  name: string;
  role: 'HC' | 'OC' | 'DC' | 'Unassigned';
  teamId: string | null;
  userId?: string;
  careerWins: number;
  careerLosses: number;
  schoolWins: number;
  schoolLosses: number;
  createdAt: any;
  updatedAt: any;
}

export interface TeamAssignment {
  id?: string;
  name: string;
  coachName: string;
  coachRole: 'HC' | 'OC' | 'DC';
  leagueId: string;
  ownerId: string | null;
  conference: string;
  logoId?: number | string;
  color: string;
  assignmentStatus: 'Active' | 'Inactive';
  contractStart: any;
  createdAt: any;
  isPlaceholder?: boolean;
  isFCS?: boolean;
  rank?: number;
  currentRank?: number;
  wins?: number;
  losses?: number;
  confWins?: number;
  confLosses?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  schoolWins?: number;
  schoolLosses?: number;
  careerWins?: number;
  careerLosses?: number;
  offensiveScheme?: string;
  defensiveScheme?: string;
  passYards?: number;
  rushYards?: number;
  totalYards?: number;
  passYardsAllowed?: number;
  rushYardsAllowed?: number;
  totalYardsAllowed?: number;
  headCoachId?: string;
  ocId?: string;
  dcId?: string;
}

export interface Player {
  id: string;
  name: string;
  pos: string;
  number: number;
  height: string;
  weight: number;
  year: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior';
  redshirt: boolean;
  isActive?: boolean;
  ovr: number;
  archetype?: string;
  physicalAbilities?: string[];
  mentalAbilities?: string[];
  teamId: string;
  leagueId: string;
  hometown?: string;
  createdAt: any;
  updatedAt?: any;
  // Aggregated Season Stats
  seasonPassYds?: number;
  seasonPassTDs?: number;
  seasonPassInts?: number;
  seasonRushYds?: number;
  seasonRushTDs?: number;
  seasonRecYds?: number;
  seasonRecTDs?: number;
  seasonReceptions?: number;
  seasonTackles?: number;
  seasonSacks?: number;
  seasonInts?: number;
}

export interface TeamStats {
  passYards: number;
  rushYards: number;
  turnovers: number;
  takeaways: number;
  firstDowns?: number;
  thirdDownMade?: number;
  thirdDownAtt?: number;
  topMinutes?: number;
  topSeconds?: number;
  timeOfPossession?: string;
  updatedAt?: any;
  // New granular fields
  totalPlays?: number;
  rushingAttempts?: number;
  rushingTds?: number;
  completions?: number;
  passingAttempts?: number;
  passingTds?: number;
  fourthDownConversions?: number;
  fourthDownAttempts?: number;
  twoPointConversions?: number;
  twoPointAttempts?: number;
  fumblesLost?: number;
  interceptionsThrown?: number;
  penalties?: number;
  penaltyYards?: number;
}

export interface Game {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore: number;
  awayScore: number;
  isUvU: boolean;
  status: 'scheduled' | 'final';
  leagueId: string;
  season: number;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  homeStats?: TeamStats;
  awayStats?: TeamStats;
  quarterLengthAtGame?: number;
}

export interface TeamGameStats {
  gameId: string;
  teamId: string;
  score: number;
  totalYards: number;
  passingYards: number;
  rushingYards: number;
  turnovers: number;
  timeOfPossession: string;
  firstDowns: number;
  thirdDownConv: string;
  redZoneAttempts: number;
  redZoneTDs: number;
  // New granular fields
  totalPlays: number;
  rushingAttempts: number;
  rushingTds: number;
  completions: number;
  passingAttempts: number;
  passingTds: number;
  fourthDownConversions: number;
  fourthDownAttempts: number;
  twoPointConversions: number;
  twoPointAttempts: number;
  fumblesLost: number;
  interceptionsThrown: number;
  penalties: number;
  penaltyYards: number;
}

export interface PlayerGameStats {
  gameId: string;
  playerId: string;
  teamId: string;
  // Passing
  passYds?: number;
  passTDs?: number;
  passInts?: number;
  passCompletions?: number;
  passAttempts?: number;
  // Rushing
  rushYds?: number;
  rushTDs?: number;
  rushAtts?: number;
  // Receiving
  recYds?: number;
  recTDs?: number;
  receptions?: number;
  // Defense
  tackles?: number;
  sacks?: number;
  ints?: number;
  forcedFumbles?: number;
  // Kicking
  fgMade?: number;
  fgAtt?: number;
  xpMade?: number;
  xpAtt?: number;
}

export interface ActivityLog {
  id: string;
  leagueId: string;
  type: 'game_result' | 'recruiting_commit' | 'league_event';
  title: string;
  description: string;
  timestamp: any;
  metadata?: {
    gameId?: string;
    prospectId?: string;
    homeTeamId?: string;
    awayTeamId?: string;
    teamId?: string;
    isUserInvolved?: boolean;
    isHumanInvolved?: boolean;
    week?: number;
    season?: number;
  };
}

export interface LeagueSettings {
  skillLevel: 'Freshman' | 'Varsity' | 'All-American' | 'Heisman';
  coachXP: 'Slowest' | 'Slow' | 'Normal' | 'Fast' | 'Fastest';
  injuryEnabled: boolean;
  manualProgressionXP: number;
  playcallCooldownEnabled: boolean;
  playcallCooldownValue?: number;
  quarterLength: number;
  acceleratedClockEnabled: boolean;
  minPlayclockTime?: number;
  wearAndTearEnabled: boolean;
  wearAndTearSettings: {
    normalTackleImpact: number;
    catchTackleImpact: number;
    hitStickImpact: number;
    cutStickImpact: number;
    defenderTackleAdvantageImpact: number;
    sackImpact: number;
    impactBlockImpact: number;
    perPlayRecovery: number;
    perTimeoutRecovery: number;
    betweenQuarterRecovery: number;
    halftimeRecovery: number;
    weekToWeekRecovery: number;
    inGameHealingReservePool: number;
  };
  maxTransfersPerTeam: number;
  userPlayerTransferChance: number;
  cpuPlayerTransferChance: number;
  maxUsers: number;
  crossPlayEnabled: boolean;
  houseRules: string;
}

export interface League {
  id: string;
  name: string;
  ownerId: string;
  currentYear: number;
  currentWeek: number;
  seasonPhase: 'Off Season' | 'Regular Season' | 'CFP Window';
  createdAt: any;
  settings?: LeagueSettings;
}

export interface Prospect {
  id: string;
  name: string;
  pos: string;
  stars: number;
  archetype: string;
  hometown: string;
  state: string;
  height: string;
  weight: number;
  ovr?: number;
  leagueId: string;
  createdAt: any;
  commitStatus?: 'Uncommitted' | 'Committed' | 'Committed to My School' | 'Committed Elsewhere';
  committedTo?: string;
  committedByUserId?: string;
}

export interface Target extends Prospect {
  prospectId: string;
  scoutingStatus: 'Normal' | 'Gem' | 'Bust';
  priority: 'Low' | 'Med' | 'High' | 'Top Target';
  notes: string;
  topSchools: string;
  teamId: string;
  updatedAt: any;
  devTrait?: 'Normal' | 'Impact' | 'Star' | 'Elite' | 'Unknown';
  scoutedRatings?: Record<string, string>;
  visits?: string;
}

export interface PollRanking {
  teamId: string;
  rank: number;
  previousRank?: number;
}

export interface Poll {
  id: string;
  leagueId: string;
  seasonYear: number;
  week: number;
  pollType: 'Media' | 'Coaches' | 'CFP';
  rankings: PollRanking[];
  createdAt: any;
  updatedAt: any;
}

export interface TeamSeasonStats {
  id: string; // format ${teamId}_${seasonYear}
  teamId: string;
  seasonYear: number;
  gamesPlayed: number;
  pointsScored: number;
  pointsAllowed: number;
  // Offense
  passAttempts: number;
  passComps: number;
  passYards: number;
  passTds: number;
  intsThrown: number;
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  firstDowns: number;
  fumblesLost: number;
  // Defense (Allowed)
  defPassAttempts: number;
  defPassComps: number;
  defPassYards: number;
  defPassTds: number;
  defIntsCaught: number;
  defRushAttempts: number;
  defRushYards: number;
  defRushTds: number;
  defFirstDownsAllowed: number;
  defFumblesRecovered: number;
  // Miscellaneous
  penalties: number;
  penaltyYards: number;
  timeOfPossessionSeconds: number;
  // Offensive Averages
  compPct: number;
  passYpg: number;
  rushYpg: number;
  rushYpc: number;
  totalOffYpg: number;
  ppg: number;
  // Defensive Averages
  defPassYpgAllowed: number;
  defRushYpgAllowed: number;
  defTotalYpgAllowed: number;
  papg: number;
  // Miscellaneous
  turnoverMargin: number;
  normalizedTopSeconds: number;
  createdAt?: any;
  updatedAt?: any;
}
