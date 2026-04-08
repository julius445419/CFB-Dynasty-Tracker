import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Gamepad2, 
  CheckCircle2, 
  PlusCircle,
  AlertCircle,
  Activity,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  increment,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { Game, TeamAssignment, TeamStats, PlayerGameStats } from '../types';
import { TeamLogo } from '../components/common/TeamLogo';
import { Ghost } from 'lucide-react';
import { UnifiedStatEntryModal } from '../components/modals/UnifiedStatEntryModal';
import AddMatchupModal from '../components/modals/AddMatchupModal';
import { BoxScoreView } from '../components/matchups/BoxScoreView';
import { updateTeamStats } from '../services/statsService';

const MatchupHub: React.FC = () => {
  const { currentLeagueId, leagueInfo, userRole, userTeam, loading: leagueLoading } = useLeague();
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [isStatModalOpen, setIsStatModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Initialize selectedWeek once leagueInfo is available
  useEffect(() => {
    if (leagueInfo?.currentWeek) {
      setSelectedWeek(leagueInfo.currentWeek);
    }
  }, [leagueInfo?.currentWeek]);

  // Fetch Teams for mapping
  useEffect(() => {
    if (!currentLeagueId) return;

    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribe = onSnapshot(teamsRef, (snapshot) => {
      const teamsMap: Record<string, TeamAssignment> = {};
      snapshot.docs.forEach(doc => {
        teamsMap[doc.id] = { id: doc.id, ...doc.data() } as TeamAssignment;
      });
      setTeams(teamsMap);
    });

    return () => unsubscribe();
  }, [currentLeagueId]);

  // Fetch Games for selected week
  useEffect(() => {
    if (!currentLeagueId) return;

    setLoading(true);
    const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
    const q = query(
      gamesRef, 
      where('week', '==', selectedWeek),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Game))
        .filter(game => {
          // If game has a season, it must match. If not, we treat it as current season for legacy support.
          return !game.season || game.season === (leagueInfo?.currentYear || 2025);
        });
      setGames(gamesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching games:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId, selectedWeek]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncStandings = async () => {
    if (!currentLeagueId) return;
    setIsSyncing(true);
    
    try {
      const batch = writeBatch(db);
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
      
      const teamsSnap = await getDocs(teamsRef);
      const finalGamesSnap = await getDocs(query(gamesRef, where('status', '==', 'final')));
      
      const teamRecords: Record<string, { 
        wins: number, losses: number, confWins: number, confLosses: number, 
        pointsFor: number, pointsAgainst: number, 
        passYards: number, rushYards: number, totalYards: number,
        passYardsAllowed: number, rushYardsAllowed: number, totalYardsAllowed: number,
        schoolWins: number, schoolLosses: number, careerWins: number, careerLosses: number 
      }> = {};

      const teamSeasonStats: Record<string, {
        teamId: string,
        seasonYear: number,
        gamesPlayed: number,
        pointsScored: number,
        pointsAllowed: number,
        passAttempts: number,
        passComps: number,
        passYards: number,
        passTds: number,
        intsThrown: number,
        rushAttempts: number,
        rushYards: number,
        rushTds: number,
        firstDowns: number,
        fumblesLost: number,
        defPassAttempts: number,
        defPassComps: number,
        defPassYards: number,
        defPassTds: number,
        defIntsCaught: number,
        defRushAttempts: number,
        defRushYards: number,
        defRushTds: number,
        defFirstDownsAllowed: number,
        defFumblesRecovered: number,
        penalties: number,
        penaltyYards: number,
        timeOfPossessionSeconds: number,
        normalizedTopSeconds: number,
        compPct: number,
        passYpg: number,
        rushYpg: number,
        rushYpc: number,
        totalOffYpg: number,
        ppg: number,
        defPassYpgAllowed: number,
        defRushYpgAllowed: number,
        defTotalYpgAllowed: number,
        papg: number,
        turnoverMargin: number
      }> = {};
      
      teamsSnap.docs.forEach(doc => {
        const data = doc.data() as TeamAssignment;
        teamRecords[doc.id] = { 
          wins: 0, 
          losses: 0, 
          confWins: 0, 
          confLosses: 0, 
          pointsFor: 0, 
          pointsAgainst: 0,
          passYards: 0,
          rushYards: 0,
          totalYards: 0,
          passYardsAllowed: 0,
          rushYardsAllowed: 0,
          totalYardsAllowed: 0,
          schoolWins: data.schoolWins || 0,
          schoolLosses: data.schoolLosses || 0,
          careerWins: data.careerWins || 0,
          careerLosses: data.careerLosses || 0
        };
      });
      
      finalGamesSnap.docs.forEach(gameDoc => {
        const game = gameDoc.data() as Game;
        const homeTeam = teamsSnap.docs.find(d => d.id === game.homeTeamId)?.data() as TeamAssignment | undefined;
        const awayTeam = teamsSnap.docs.find(d => d.id === game.awayTeamId)?.data() as TeamAssignment | undefined;
        
        if (!homeTeam || !awayTeam) return;
        
        const isConfGame = homeTeam.conference === awayTeam.conference;
        const homeWon = (game.homeScore ?? 0) > (game.awayScore ?? 0);
        const awayWon = (game.awayScore ?? 0) > (game.homeScore ?? 0);

        if (!teamRecords[game.homeTeamId]) {
          teamRecords[game.homeTeamId] = { wins: 0, losses: 0, confWins: 0, confLosses: 0, pointsFor: 0, pointsAgainst: 0, passYards: 0, rushYards: 0, totalYards: 0, passYardsAllowed: 0, rushYardsAllowed: 0, totalYardsAllowed: 0, schoolWins: 0, schoolLosses: 0, careerWins: 0, careerLosses: 0 };
        }
        if (!teamRecords[game.awayTeamId]) {
          teamRecords[game.awayTeamId] = { wins: 0, losses: 0, confWins: 0, confLosses: 0, pointsFor: 0, pointsAgainst: 0, passYards: 0, rushYards: 0, totalYards: 0, passYardsAllowed: 0, rushYardsAllowed: 0, totalYardsAllowed: 0, schoolWins: 0, schoolLosses: 0, careerWins: 0, careerLosses: 0 };
        }
        
        const hScore = Number(game.homeScore) || 0;
        const aScore = Number(game.awayScore) || 0;

        // Update Team Season Stats Map
        const season = game.season || 2025;
        const hKey = `${game.homeTeamId}_${season}`;
        const aKey = `${game.awayTeamId}_${season}`;

        if (!teamSeasonStats[hKey]) {
          teamSeasonStats[hKey] = { 
            teamId: game.homeTeamId, seasonYear: season, gamesPlayed: 0, pointsScored: 0, pointsAllowed: 0,
            passAttempts: 0, passComps: 0, passYards: 0, passTds: 0, intsThrown: 0,
            rushAttempts: 0, rushYards: 0, rushTds: 0, firstDowns: 0, fumblesLost: 0,
            defPassAttempts: 0, defPassComps: 0, defPassYards: 0, defPassTds: 0, defIntsCaught: 0,
            defRushAttempts: 0, defRushYards: 0, defRushTds: 0, defFirstDownsAllowed: 0, defFumblesRecovered: 0,
            penalties: 0, penaltyYards: 0, timeOfPossessionSeconds: 0, normalizedTopSeconds: 0,
            compPct: 0, passYpg: 0, rushYpg: 0, rushYpc: 0, totalOffYpg: 0, ppg: 0,
            defPassYpgAllowed: 0, defRushYpgAllowed: 0, defTotalYpgAllowed: 0, papg: 0, turnoverMargin: 0
          };
        }
        if (!teamSeasonStats[aKey]) {
          teamSeasonStats[aKey] = { 
            teamId: game.awayTeamId, seasonYear: season, gamesPlayed: 0, pointsScored: 0, pointsAllowed: 0,
            passAttempts: 0, passComps: 0, passYards: 0, passTds: 0, intsThrown: 0,
            rushAttempts: 0, rushYards: 0, rushTds: 0, firstDowns: 0, fumblesLost: 0,
            defPassAttempts: 0, defPassComps: 0, defPassYards: 0, defPassTds: 0, defIntsCaught: 0,
            defRushAttempts: 0, defRushYards: 0, defRushTds: 0, defFirstDownsAllowed: 0, defFumblesRecovered: 0,
            penalties: 0, penaltyYards: 0, timeOfPossessionSeconds: 0, normalizedTopSeconds: 0,
            compPct: 0, passYpg: 0, rushYpg: 0, rushYpc: 0, totalOffYpg: 0, ppg: 0,
            defPassYpgAllowed: 0, defRushYpgAllowed: 0, defTotalYpgAllowed: 0, papg: 0, turnoverMargin: 0
          };
        }

        const gameHomeStats = (game.homeStats || {}) as TeamStats;
        const gameAwayStats = (game.awayStats || {}) as TeamStats;

        const topToSeconds = (top?: string): number => {
          if (!top) return 0;
          const [mins, secs] = top.split(':').map(Number);
          return (mins || 0) * 60 + (secs || 0);
        };

        const qLen = leagueInfo?.settings?.quarterLength || 5;
        const normFactor = 60 / (qLen * 4);

        teamSeasonStats[hKey].gamesPlayed++;
        teamSeasonStats[hKey].pointsScored += hScore;
        teamSeasonStats[hKey].pointsAllowed += aScore;
        teamSeasonStats[hKey].passAttempts += Number(gameHomeStats.passingAttempts || 0);
        teamSeasonStats[hKey].passComps += Number(gameHomeStats.completions || 0);
        teamSeasonStats[hKey].passYards += Number(gameHomeStats.passYards || 0);
        teamSeasonStats[hKey].passTds += Number(gameHomeStats.passingTds || 0);
        teamSeasonStats[hKey].intsThrown += Number(gameHomeStats.interceptionsThrown || 0);
        teamSeasonStats[hKey].rushAttempts += Number(gameHomeStats.rushingAttempts || 0);
        teamSeasonStats[hKey].rushYards += Number(gameHomeStats.rushYards || 0);
        teamSeasonStats[hKey].rushTds += Number(gameHomeStats.rushingTds || 0);
        teamSeasonStats[hKey].firstDowns += Number(gameHomeStats.firstDowns || 0);
        teamSeasonStats[hKey].fumblesLost += Number(gameHomeStats.fumblesLost || 0);
        teamSeasonStats[hKey].penalties += Number(gameHomeStats.penalties || 0);
        teamSeasonStats[hKey].penaltyYards += Number(gameHomeStats.penaltyYards || 0);
        const hTopSecs = topToSeconds(gameHomeStats.timeOfPossession);
        teamSeasonStats[hKey].timeOfPossessionSeconds += hTopSecs;
        teamSeasonStats[hKey].normalizedTopSeconds += (hTopSecs * normFactor);

        // Mirror Effect for Home Team Defense
        teamSeasonStats[hKey].defPassAttempts += Number(gameAwayStats.passingAttempts || 0);
        teamSeasonStats[hKey].defPassComps += Number(gameAwayStats.completions || 0);
        teamSeasonStats[hKey].defPassYards += Number(gameAwayStats.passYards || 0);
        teamSeasonStats[hKey].defPassTds += Number(gameAwayStats.passingTds || 0);
        teamSeasonStats[hKey].defIntsCaught += Number(gameAwayStats.interceptionsThrown || 0);
        teamSeasonStats[hKey].defRushAttempts += Number(gameAwayStats.rushingAttempts || 0);
        teamSeasonStats[hKey].defRushYards += Number(gameAwayStats.rushYards || 0);
        teamSeasonStats[hKey].defRushTds += Number(gameAwayStats.rushingTds || 0);
        teamSeasonStats[hKey].defFirstDownsAllowed += Number(gameAwayStats.firstDowns || 0);
        teamSeasonStats[hKey].defFumblesRecovered += Number(gameAwayStats.fumblesLost || 0);

        teamSeasonStats[aKey].gamesPlayed++;
        teamSeasonStats[aKey].pointsScored += aScore;
        teamSeasonStats[aKey].pointsAllowed += hScore;
        teamSeasonStats[aKey].passAttempts += Number(gameAwayStats.passingAttempts || 0);
        teamSeasonStats[aKey].passComps += Number(gameAwayStats.completions || 0);
        teamSeasonStats[aKey].passYards += Number(gameAwayStats.passYards || 0);
        teamSeasonStats[aKey].passTds += Number(gameAwayStats.passingTds || 0);
        teamSeasonStats[aKey].intsThrown += Number(gameAwayStats.interceptionsThrown || 0);
        teamSeasonStats[aKey].rushAttempts += Number(gameAwayStats.rushingAttempts || 0);
        teamSeasonStats[aKey].rushYards += Number(gameAwayStats.rushYards || 0);
        teamSeasonStats[aKey].rushTds += Number(gameAwayStats.rushingTds || 0);
        teamSeasonStats[aKey].firstDowns += Number(gameAwayStats.firstDowns || 0);
        teamSeasonStats[aKey].fumblesLost += Number(gameAwayStats.fumblesLost || 0);
        teamSeasonStats[aKey].penalties += Number(gameAwayStats.penalties || 0);
        teamSeasonStats[aKey].penaltyYards += Number(gameAwayStats.penaltyYards || 0);
        const aTopSecs = topToSeconds(gameAwayStats.timeOfPossession);
        teamSeasonStats[aKey].timeOfPossessionSeconds += aTopSecs;
        teamSeasonStats[aKey].normalizedTopSeconds += (aTopSecs * normFactor);

        // Mirror Effect for Away Team Defense
        teamSeasonStats[aKey].defPassAttempts += Number(gameHomeStats.passingAttempts || 0);
        teamSeasonStats[aKey].defPassComps += Number(gameHomeStats.completions || 0);
        teamSeasonStats[aKey].defPassYards += Number(gameHomeStats.passYards || 0);
        teamSeasonStats[aKey].defPassTds += Number(gameHomeStats.passingTds || 0);
        teamSeasonStats[aKey].defIntsCaught += Number(gameHomeStats.interceptionsThrown || 0);
        teamSeasonStats[aKey].defRushAttempts += Number(gameHomeStats.rushingAttempts || 0);
        teamSeasonStats[aKey].defRushYards += Number(gameHomeStats.rushYards || 0);
        teamSeasonStats[aKey].defRushTds += Number(gameHomeStats.rushingTds || 0);
        teamSeasonStats[aKey].defFirstDownsAllowed += Number(gameHomeStats.firstDowns || 0);
        teamSeasonStats[aKey].defFumblesRecovered += Number(gameHomeStats.fumblesLost || 0);

        teamRecords[game.homeTeamId].pointsFor += hScore;
        teamRecords[game.homeTeamId].pointsAgainst += aScore;
        teamRecords[game.awayTeamId].pointsFor += aScore;
        teamRecords[game.awayTeamId].pointsAgainst += hScore;

        // Add Yardage
        if (gameHomeStats) {
          const pYds = Number(gameHomeStats.passYards) || 0;
          const rYds = Number(gameHomeStats.rushYards) || 0;
          teamRecords[game.homeTeamId].passYards += pYds;
          teamRecords[game.homeTeamId].rushYards += rYds;
          teamRecords[game.homeTeamId].totalYards += (pYds + rYds);
          teamRecords[game.awayTeamId].passYardsAllowed += pYds;
          teamRecords[game.awayTeamId].rushYardsAllowed += rYds;
          teamRecords[game.awayTeamId].totalYardsAllowed += (pYds + rYds);
        }
        if (gameAwayStats) {
          const pYds = Number(gameAwayStats.passYards) || 0;
          const rYds = Number(gameAwayStats.rushYards) || 0;
          teamRecords[game.awayTeamId].passYards += pYds;
          teamRecords[game.awayTeamId].rushYards += rYds;
          teamRecords[game.awayTeamId].totalYards += (pYds + rYds);
          teamRecords[game.homeTeamId].passYardsAllowed += pYds;
          teamRecords[game.homeTeamId].rushYardsAllowed += rYds;
          teamRecords[game.homeTeamId].totalYardsAllowed += (pYds + rYds);
        }

        if (homeWon) {
          teamRecords[game.homeTeamId].wins++;
          if (isConfGame) teamRecords[game.homeTeamId].confWins++;
          teamRecords[game.awayTeamId].losses++;
          if (isConfGame) teamRecords[game.awayTeamId].confLosses++;
        } else if (awayWon) {
          teamRecords[game.awayTeamId].wins++;
          if (isConfGame) teamRecords[game.awayTeamId].confWins++;
          teamRecords[game.homeTeamId].losses++;
          if (isConfGame) teamRecords[game.homeTeamId].confLosses++;
        }
      });

      // For now, let's make sure schoolWins/Losses at least reflect the current season if they were 0
      Object.entries(teamRecords).forEach(([teamId, records]) => {
        if (records.schoolWins === 0 && records.schoolLosses === 0) {
          records.schoolWins = records.wins;
          records.schoolLosses = records.losses;
        }
        if (records.careerWins === 0 && records.careerLosses === 0) {
          records.careerWins = records.wins;
          records.careerLosses = records.losses;
        }
      });
      
      Object.entries(teamRecords).forEach(([teamId, records]) => {
        const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', teamId);
        batch.update(teamRef, {
          ...records,
          updatedAt: serverTimestamp()
        });
      });

      // Update Team Season Stats in Batch
      Object.entries(teamSeasonStats).forEach(([statsId, stats]) => {
        const games = stats.gamesPlayed || 0;
        if (games > 0) {
          stats.ppg = stats.pointsScored / games;
          stats.passYpg = stats.passYards / games;
          stats.rushYpg = stats.rushYards / games;
          stats.totalOffYpg = (stats.passYards + stats.rushYards) / games;
          stats.rushYpc = stats.rushAttempts > 0 ? stats.rushYards / stats.rushAttempts : 0;
          stats.compPct = stats.passAttempts > 0 ? (stats.passComps / stats.passAttempts) * 100 : 0;
          stats.papg = stats.pointsAllowed / games;
          stats.defPassYpgAllowed = stats.defPassYards / games;
          stats.defRushYpgAllowed = stats.defRushYards / games;
          stats.defTotalYpgAllowed = (stats.defPassYards + stats.defRushYards) / games;
          stats.turnoverMargin = (stats.defIntsCaught + stats.defFumblesRecovered) - (stats.intsThrown + stats.fumblesLost);
        }

        // Final safety check for Firestore (no NaN or Infinity)
        const sanitizedStats = Object.fromEntries(
          Object.entries(stats).map(([key, value]) => [
            key, 
            typeof value === 'number' ? (isNaN(value) || !isFinite(value) ? 0 : value) : value
          ])
        );

        const statsRef = doc(db, 'leagues', currentLeagueId, 'team_stats', statsId);
        batch.set(statsRef, {
          ...sanitizedStats,
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      alert('Standings and records synced successfully!');
    } catch (err) {
      console.error("Error syncing standings:", err);
      alert('Failed to sync standings.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogScore = (game: Game) => {
    setSelectedGame(game);
    setIsStatModalOpen(true);
  };

  const handleSaveStats = async (stats: { 
    homeScore: number; 
    awayScore: number; 
    homeStats: TeamStats; 
    awayStats: TeamStats; 
    playerStats: PlayerGameStats[];
    quarterLengthAtGame?: number 
  }) => {
    if (!selectedGame) return;
    
    const batch = writeBatch(db);
    const gameRef = doc(db, 'leagues', selectedGame.leagueId, 'games', selectedGame.id);
    const homeTeamRef = doc(db, 'leagues', selectedGame.leagueId, 'teams', selectedGame.homeTeamId);
    const awayTeamRef = doc(db, 'leagues', selectedGame.leagueId, 'teams', selectedGame.awayTeamId);

    const isNewResult = selectedGame.status !== 'final';
    const oldHomeScore = Number(selectedGame.homeScore) || 0;
    const oldAwayScore = Number(selectedGame.awayScore) || 0;
    const oldHomeWon = oldHomeScore > oldAwayScore;
    const oldAwayWon = oldAwayScore > oldHomeScore;
    
    const hScore = Number(stats.homeScore) || 0;
    const aScore = Number(stats.awayScore) || 0;
    const newHomeWon = hScore > aScore;
    const newAwayWon = aScore > hScore;

    const hPass = Number(stats.homeStats.passYards) || 0;
    const hRush = Number(stats.homeStats.rushYards) || 0;
    const aPass = Number(stats.awayStats.passYards) || 0;
    const aRush = Number(stats.awayStats.rushYards) || 0;

    const oldHPass = Number(selectedGame.homeStats?.passYards) || 0;
    const oldHRush = Number(selectedGame.homeStats?.rushYards) || 0;
    const oldAPass = Number(selectedGame.awayStats?.passYards) || 0;
    const oldARush = Number(selectedGame.awayStats?.rushYards) || 0;

    batch.update(gameRef, {
      homeScore: hScore,
      awayScore: aScore,
      homeStats: stats.homeStats,
      awayStats: stats.awayStats,
      status: 'final',
      updatedAt: serverTimestamp(),
      quarterLengthAtGame: Number(stats.quarterLengthAtGame) || 0
    });

    // Update Team Season Stats
    await updateTeamStats(
      batch,
      selectedGame.leagueId,
      selectedGame,
      hScore,
      aScore,
      stats.homeStats,
      stats.awayStats,
      isNewResult,
      leagueInfo?.settings?.quarterLength || 5
    );

    // 1. Process Player Stats (Write-Time Aggregation)
    if (stats.playerStats && stats.playerStats.length > 0) {
      stats.playerStats.forEach(ps => {
        const statId = `${selectedGame.id}_${ps.playerId}`;
        const statRef = doc(db, 'leagues', selectedGame.leagueId, 'playerStats', statId);
        const playerRef = doc(db, 'leagues', selectedGame.leagueId, 'players', ps.playerId);

        // Save the individual game stat
        batch.set(statRef, {
          ...ps,
          season: selectedGame.season,
          week: selectedGame.week,
          updatedAt: serverTimestamp()
        });

        // Increment season totals on the player document
        // Note: For simplicity in this iteration, we only aggregate on NEW results.
        // If it's an update, the user should run the "Sync Standings" utility in Admin.
        if (isNewResult) {
          batch.update(playerRef, {
            seasonPassYds: increment(ps.passYds || 0),
            seasonPassTDs: increment(ps.passTDs || 0),
            seasonPassInts: increment(ps.passInts || 0),
            seasonRushYds: increment(ps.rushYds || 0),
            seasonRushTDs: increment(ps.rushTDs || 0),
            seasonRecYds: increment(ps.recYds || 0),
            seasonRecTDs: increment(ps.recTDs || 0),
            seasonReceptions: increment(ps.receptions || 0),
            seasonTackles: increment(ps.tackles || 0),
            seasonSacks: increment(ps.sacks || 0),
            seasonInts: increment(ps.ints || 0),
            updatedAt: serverTimestamp()
          });
        }
      });
    }

    // Update Team Records (Bypass for FCS)
    const isConfGame = teams[selectedGame.homeTeamId].conference === teams[selectedGame.awayTeamId].conference;

    // Home Team Update
    if (!teams[selectedGame.homeTeamId].isFCS) {
      const homeUpdate: any = {
        pointsFor: isNewResult ? increment(hScore) : increment(hScore - oldHomeScore),
        pointsAgainst: isNewResult ? increment(aScore) : increment(aScore - oldAwayScore),
        passYards: isNewResult ? increment(hPass) : increment(hPass - oldHPass),
        rushYards: isNewResult ? increment(hRush) : increment(hRush - oldHRush),
        totalYards: isNewResult ? increment(hPass + hRush) : increment((hPass + hRush) - (oldHPass + oldHRush)),
        passYardsAllowed: isNewResult ? increment(aPass) : increment(aPass - oldAPass),
        rushYardsAllowed: isNewResult ? increment(aRush) : increment(aRush - oldARush),
        totalYardsAllowed: isNewResult ? increment(aPass + aRush) : increment((aPass + aRush) - (oldAPass + oldARush)),
        updatedAt: serverTimestamp()
      };

      if (isNewResult) {
        homeUpdate.wins = newHomeWon ? increment(1) : increment(0);
        homeUpdate.losses = newAwayWon ? increment(1) : increment(0);
        homeUpdate.schoolWins = newHomeWon ? increment(1) : increment(0);
        homeUpdate.schoolLosses = newAwayWon ? increment(1) : increment(0);
        homeUpdate.careerWins = newHomeWon ? increment(1) : increment(0);
        homeUpdate.careerLosses = newAwayWon ? increment(1) : increment(0);
        if (isConfGame) {
          if (newHomeWon) homeUpdate.confWins = increment(1);
          else if (newAwayWon) homeUpdate.confLosses = increment(1);
        }
      } else {
        // Winner changed?
        if (newHomeWon && !oldHomeWon) {
          homeUpdate.wins = increment(1);
          homeUpdate.losses = increment(-1);
          homeUpdate.schoolWins = increment(1);
          homeUpdate.schoolLosses = increment(-1);
          homeUpdate.careerWins = increment(1);
          homeUpdate.careerLosses = increment(-1);
          if (isConfGame) {
            homeUpdate.confWins = increment(1);
            homeUpdate.confLosses = increment(-1);
          }
        } else if (!newHomeWon && oldHomeWon) {
          homeUpdate.wins = increment(-1);
          homeUpdate.losses = increment(1);
          homeUpdate.schoolWins = increment(-1);
          homeUpdate.schoolLosses = increment(1);
          homeUpdate.careerWins = increment(-1);
          homeUpdate.careerLosses = increment(1);
          if (isConfGame) {
            homeUpdate.confWins = increment(-1);
            homeUpdate.confLosses = increment(1);
          }
        }
      }
      batch.update(homeTeamRef, homeUpdate);
    }

    // Away Team Update
    if (!teams[selectedGame.awayTeamId].isFCS) {
      const awayUpdate: any = {
        pointsFor: isNewResult ? increment(aScore) : increment(aScore - oldAwayScore),
        pointsAgainst: isNewResult ? increment(hScore) : increment(hScore - oldHomeScore),
        passYards: isNewResult ? increment(aPass) : increment(aPass - oldAPass),
        rushYards: isNewResult ? increment(aRush) : increment(aRush - oldARush),
        totalYards: isNewResult ? increment(aPass + aRush) : increment((aPass + aRush) - (oldAPass + oldARush)),
        passYardsAllowed: isNewResult ? increment(hPass) : increment(hPass - oldHPass),
        rushYardsAllowed: isNewResult ? increment(hRush) : increment(hRush - oldHRush),
        totalYardsAllowed: isNewResult ? increment(hPass + hRush) : increment((hPass + hRush) - (oldHPass + oldHRush)),
        updatedAt: serverTimestamp()
      };

      if (isNewResult) {
        awayUpdate.wins = newAwayWon ? increment(1) : increment(0);
        awayUpdate.losses = newHomeWon ? increment(1) : increment(0);
        awayUpdate.schoolWins = newAwayWon ? increment(1) : increment(0);
        awayUpdate.schoolLosses = newHomeWon ? increment(1) : increment(0);
        awayUpdate.careerWins = newAwayWon ? increment(1) : increment(0);
        awayUpdate.careerLosses = newHomeWon ? increment(1) : increment(0);
        if (isConfGame) {
          if (newAwayWon) awayUpdate.confWins = increment(1);
          else if (newHomeWon) awayUpdate.confLosses = increment(1);
        }
      } else {
        // Winner changed?
        if (newAwayWon && !oldAwayWon) {
          awayUpdate.wins = increment(1);
          awayUpdate.losses = increment(-1);
          awayUpdate.schoolWins = increment(1);
          awayUpdate.schoolLosses = increment(-1);
          awayUpdate.careerWins = increment(1);
          awayUpdate.careerLosses = increment(-1);
          if (isConfGame) {
            awayUpdate.confWins = increment(1);
            awayUpdate.confLosses = increment(-1);
          }
        } else if (!newAwayWon && oldAwayWon) {
          awayUpdate.wins = increment(-1);
          awayUpdate.losses = increment(1);
          awayUpdate.schoolWins = increment(-1);
          awayUpdate.schoolLosses = increment(1);
          awayUpdate.careerWins = increment(-1);
          awayUpdate.careerLosses = increment(1);
          if (isConfGame) {
            awayUpdate.confWins = increment(-1);
            awayUpdate.confLosses = increment(1);
          }
        }
      }
      batch.update(awayTeamRef, awayUpdate);
    }

    await batch.commit();
    setIsStatModalOpen(false);
  };

  const weeks = Array.from({ length: 21 }, (_, i) => i);

  if (leagueLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Week Picker */}
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 py-4 mb-6">
        <div className="flex items-center overflow-x-auto no-scrollbar px-4 gap-2">
          {weeks.map((week) => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all ${
                selectedWeek === week
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              } ${leagueInfo?.currentWeek === week ? 'ring-2 ring-orange-500/50' : ''}`}
            >
              Week {week}
              {leagueInfo?.currentWeek === week && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-500" />
            {selectedWeek === leagueInfo?.currentWeek ? 'Active Matchups' : `Week ${selectedWeek} Schedule`}
          </h2>
          <div className="flex items-center gap-2">
            {(userRole === 'Owner' || userRole === 'Commissioner') && (
              <button
                onClick={handleSyncStandings}
                disabled={isSyncing}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-black px-3 py-1.5 rounded-lg border border-zinc-800 transition-all uppercase tracking-widest disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-orange-500 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Records
              </button>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-black px-3 py-1.5 rounded-lg border border-zinc-800 transition-all uppercase tracking-widest"
            >
              <PlusCircle className="w-3.5 h-3.5 text-orange-500" />
              Add Matchup
            </button>
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500 mb-4"></div>
              <p>Loading matchups...</p>
            </div>
          ) : games.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl text-zinc-500"
            >
              <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">No games scheduled for Week {selectedWeek}</p>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  teams={teams} 
                  onLogScore={() => handleLogScore(game)}
                  userRole={userRole}
                  userId={user?.uid}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {selectedGame && (
        <>
          <UnifiedStatEntryModal
            isOpen={isStatModalOpen}
            onClose={() => setIsStatModalOpen(false)}
            game={selectedGame}
            homeTeam={teams[selectedGame.homeTeamId]}
            awayTeam={teams[selectedGame.awayTeamId]}
            onSave={handleSaveStats}
            leagueSettings={leagueInfo?.settings}
          />
        </>
      )}

      <AddMatchupModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

interface GameCardProps {
  game: Game;
  teams: Record<string, TeamAssignment>;
  onLogScore: () => void;
  userRole?: string;
  userId?: string;
}

const GameCard: React.FC<GameCardProps> = ({ game, teams, onLogScore, userRole, userId }) => {
  const [showBoxScore, setShowBoxScore] = useState(false);
  const homeTeam = teams[game.homeTeamId];
  const awayTeam = teams[game.awayTeamId];

  if (!homeTeam || !awayTeam) return null;

  const isFinal = game.status === 'final';
  const isCommissioner = userRole === 'Owner' || userRole === 'Commissioner';
  const isParticipant = homeTeam.ownerId === userId || awayTeam.ownerId === userId;
  const canLogScore = !isFinal && (isCommissioner || isParticipant);
  const canLogStats = isFinal && (isCommissioner || isParticipant);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative overflow-hidden bg-zinc-900 border rounded-3xl p-5 transition-all ${
        game.isUvU 
          ? 'border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.05)]' 
          : 'border-zinc-800'
      }`}
    >
      {game.isUvU && (
        <div className="absolute top-0 right-0">
          <div className="bg-orange-600 text-[10px] font-black text-white px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-orange-900/40 animate-pulse">
            <Trophy className="w-3 h-3" />
            High Stakes
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Away Team */}
        <div className="flex-1 flex flex-col items-center text-center gap-2">
          <TeamLogo 
            team={awayTeam} 
            size="lg"
            className={`bg-zinc-800 rounded-2xl p-2 flex items-center justify-center shadow-inner relative group ${awayTeam.isPlaceholder ? 'opacity-40 grayscale' : ''}`}
          />
          <div className="space-y-0.5">
            <h3 className={`text-sm font-bold text-white line-clamp-1 ${awayTeam.isPlaceholder ? 'text-zinc-500 italic' : ''}`}>{awayTeam.name}</h3>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter truncate max-w-[80px]">
              {awayTeam.isPlaceholder ? 'SHADOW' : (awayTeam.coachName === 'CPU Controlled' ? 'CPU' : awayTeam.coachName)}
            </p>
          </div>
        </div>

        {/* Center Info */}
        <div className="flex flex-col items-center justify-center gap-2 px-2">
          {isFinal ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-black ${ (game.awayScore || 0) > (game.homeScore || 0) ? 'text-white' : 'text-zinc-600'}`}>
                  {game.awayScore || 0}
                </span>
                <span className="text-zinc-700 font-bold text-sm italic">VS</span>
                <span className={`text-3xl font-black ${ (game.homeScore || 0) > (game.awayScore || 0) ? 'text-white' : 'text-zinc-600'}`}>
                  {game.homeScore || 0}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                Final
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
                <span className="text-xs font-black text-zinc-600 uppercase tracking-widest italic">VS</span>
              </div>
              {canLogScore && (
                <button
                  onClick={onLogScore}
                  className="flex items-center gap-1.5 bg-white text-black text-[10px] font-black px-4 py-2 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-white/5"
                >
                  <Trophy className="w-3 h-3" />
                  Log Score
                </button>
              )}
            </div>
          )}
        </div>

        {/* Home Team */}
        <div className="flex-1 flex flex-col items-center text-center gap-2">
          <TeamLogo 
            team={homeTeam} 
            size="lg"
            className={`bg-zinc-800 rounded-2xl p-2 flex items-center justify-center shadow-inner relative group ${homeTeam.isPlaceholder ? 'opacity-40 grayscale' : ''}`}
          />
          <div className="space-y-0.5">
            <h3 className={`text-sm font-bold text-white line-clamp-1 ${homeTeam.isPlaceholder ? 'text-zinc-500 italic' : ''}`}>{homeTeam.name}</h3>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter truncate max-w-[80px]">
              {homeTeam.isPlaceholder ? 'SHADOW' : (homeTeam.coachName === 'CPU Controlled' ? 'CPU' : homeTeam.coachName)}
            </p>
          </div>
        </div>
      </div>

      {isFinal && (
        <div className="mt-6 pt-6 border-t border-zinc-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowBoxScore(!showBoxScore)}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Activity className={`w-3.5 h-3.5 transition-transform ${showBoxScore ? 'rotate-180' : ''}`} />
              {showBoxScore ? 'Hide Box Score' : 'View Box Score'}
            </button>
            
            {canLogStats && (
              <button
                onClick={onLogScore}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-black px-4 py-2 rounded-xl border border-zinc-700 transition-all uppercase tracking-widest"
              >
                <PlusCircle className="w-3.5 h-3.5 text-orange-500" />
                Edit Stats
              </button>
            )}
          </div>

          <AnimatePresence>
            {showBoxScore && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <BoxScoreView game={game} homeTeam={homeTeam} awayTeam={awayTeam} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default MatchupHub;
