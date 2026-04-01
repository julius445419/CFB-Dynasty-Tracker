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

export interface TeamAssignment {
  id?: string;
  name: string;
  coachName: string;
  coachRole: 'HC' | 'OC' | 'DC';
  leagueId: string;
  ownerId: string;
  conference: string;
  logoId?: number;
  color: string;
  assignmentStatus: 'Active' | 'Inactive';
  contractStart: any;
  createdAt: any;
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
  ovr: number;
  archetype?: string;
  teamId: string;
  leagueId: string;
  hometown?: string;
  createdAt: any;
}

export interface Game {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'completed';
  leagueId: string;
  season: number;
  createdAt: any;
  updatedAt: any;
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

export interface League {
  id: string;
  name: string;
  ownerId: string;
  currentYear: number;
  currentWeek: number;
  seasonPhase: 'Off Season' | 'Regular Season' | 'CFP Window';
  createdAt: any;
}
