import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Gamepad2,
  Trophy,
  ArrowRight,
  Pencil,
  RefreshCw,
  X,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { Game, TeamAssignment } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../../components/common/TeamLogo';
import { useSearchParams } from 'react-router-dom';
import { ReportScoreModal } from '../../components/matchups/ReportScoreModal';
import { useAuth } from '../../context/AuthContext';
import { SCHOOLS } from '../../constants/schools';
import { SearchableTeamSelect } from '../../components/admin/SearchableTeamSelect';

const ScheduleManagement: React.FC = () => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const [searchParams, setSearchParams] = useSearchParams();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [isAdvancingWeek, setIsAdvancingWeek] = useState(false);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [selectedGameForReport, setSelectedGameForReport] = useState<Game | null>(null);
  const { user } = useAuth();
  const { userTeam } = useLeague();

  // Form State
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<number>(leagueInfo?.currentWeek ?? 0);
  const [week, setWeek] = useState<number>(leagueInfo?.currentWeek ?? 0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  useEffect(() => {
    if (leagueInfo?.currentWeek !== undefined && !isAddingGame && !editingGameId) {
      setSelectedWeek(leagueInfo.currentWeek);
      setWeek(leagueInfo.currentWeek);
    }
  }, [leagueInfo?.currentWeek, isAddingGame, editingGameId]);

  const [isUvU, setIsUvU] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leagueInfo?.currentWeek) {
      setSelectedWeek(leagueInfo.currentWeek);
      setWeek(leagueInfo.currentWeek);
    }
  }, [leagueInfo?.currentWeek]);

  // Fetch Teams
  useEffect(() => {
    if (!currentLeagueId) return;

    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribe = onSnapshot(teamsRef, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamAssignment[];
      setTeams(teamsData);
    });

    return () => unsubscribe();
  }, [currentLeagueId]);

  // Fetch Games for selected week
  useEffect(() => {
    if (!currentLeagueId || !leagueInfo) return;

    setLoading(true);
    const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
    const q = query(
      gamesRef, 
      where('week', '==', selectedWeek),
      where('season', '==', leagueInfo?.currentYear || 2025)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Game[];
      // Sort by createdAt desc in memory
      const sortedGames = gamesData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setGames(sortedGames);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId, leagueInfo, selectedWeek]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStep, setSyncStep] = useState<'confirm' | 'syncing' | 'success' | 'error'>('confirm');
  const [syncProgress, setSyncProgress] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSyncStandings = async () => {
    if (!currentLeagueId) return;
    
    setSyncStep('syncing');
    setSyncProgress('Initializing sync...');
    setIsSyncing(true);
    
    try {
      const batch = writeBatch(db);
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
      const playersRef = collection(db, 'leagues', currentLeagueId, 'players');
      const playerStatsRef = collection(db, 'leagues', currentLeagueId, 'playerStats');
      
      // 1. Get all teams and all final games
      setSyncProgress('Fetching teams data...');
      const teamsSnap = await getDocs(teamsRef);
      
      setSyncProgress('Fetching finalized games...');
      const finalGamesSnap = await getDocs(query(
        gamesRef, 
        where('status', '==', 'final'),
        where('season', '==', leagueInfo?.currentYear || 2025)
      ));
      
      const teamRecords: Record<string, { wins: number, losses: number, confWins: number, confLosses: number }> = {};
      
      // Initialize records for all teams in the collection
      teamsSnap.docs.forEach(doc => {
        teamRecords[doc.id] = { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      });
      
      // 2. Calculate records from games
      setSyncProgress(`Processing ${finalGamesSnap.size} games...`);
      finalGamesSnap.docs.forEach(gameDoc => {
        const game = gameDoc.data() as Game;
        const homeTeam = teamsSnap.docs.find(d => d.id === game.homeTeamId)?.data() as TeamAssignment | undefined;
        const awayTeam = teamsSnap.docs.find(d => d.id === game.awayTeamId)?.data() as TeamAssignment | undefined;
        
        if (!homeTeam || !awayTeam) return;
        
        const isConfGame = homeTeam.conference === awayTeam.conference;
        const homeWon = (game.homeScore ?? 0) > (game.awayScore ?? 0);
        
        if (!teamRecords[game.homeTeamId]) teamRecords[game.homeTeamId] = { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
        if (!teamRecords[game.awayTeamId]) teamRecords[game.awayTeamId] = { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
        
        if (homeWon) {
          teamRecords[game.homeTeamId].wins++;
          if (isConfGame) teamRecords[game.homeTeamId].confWins++;
          teamRecords[game.awayTeamId].losses++;
          if (isConfGame) teamRecords[game.awayTeamId].confLosses++;
        } else if ((game.awayScore ?? 0) > (game.homeScore ?? 0)) {
          teamRecords[game.awayTeamId].wins++;
          if (isConfGame) teamRecords[game.awayTeamId].confWins++;
          teamRecords[game.homeTeamId].losses++;
          if (isConfGame) teamRecords[game.homeTeamId].confLosses++;
        }
      });
      
      // 3. Sync Player Stats
      setSyncProgress('Fetching player stats...');
      const playerStatsSnap = await getDocs(query(
        playerStatsRef,
        where('season', '==', leagueInfo?.currentYear || 2025)
      ));

      const playerAggregates: Record<string, any> = {};
      
      setSyncProgress(`Processing ${playerStatsSnap.size} player stat entries...`);
      playerStatsSnap.docs.forEach(doc => {
        const stats = doc.data();
        const pid = stats.playerId;
        if (!playerAggregates[pid]) {
          playerAggregates[pid] = {
            seasonPassYds: 0, seasonPassTDs: 0, seasonPassInts: 0,
            seasonRushYds: 0, seasonRushTDs: 0,
            seasonRecYds: 0, seasonRecTDs: 0, seasonReceptions: 0,
            seasonTackles: 0, seasonSacks: 0, seasonInts: 0
          };
        }
        
        playerAggregates[pid].seasonPassYds += (stats.passYds || 0);
        playerAggregates[pid].seasonPassTDs += (stats.passTDs || 0);
        playerAggregates[pid].seasonPassInts += (stats.passInts || 0);
        playerAggregates[pid].seasonRushYds += (stats.rushYds || 0);
        playerAggregates[pid].seasonRushTDs += (stats.rushTDs || 0);
        playerAggregates[pid].seasonRecYds += (stats.recYds || 0);
        playerAggregates[pid].seasonRecTDs += (stats.recTDs || 0);
        playerAggregates[pid].seasonReceptions += (stats.receptions || 0);
        playerAggregates[pid].seasonTackles += (stats.tackles || 0);
        playerAggregates[pid].seasonSacks += (stats.sacks || 0);
        playerAggregates[pid].seasonInts += (stats.ints || 0);
      });

      // 4. Update all teams in batch
      setSyncProgress(`Updating ${Object.keys(teamRecords).length} team records...`);
      Object.entries(teamRecords).forEach(([teamId, records]) => {
        const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', teamId);
        batch.update(teamRef, {
          ...records,
          updatedAt: serverTimestamp()
        });
      });

      // 5. Update all players in batch (careful with 500 limit)
      setSyncProgress(`Updating ${Object.keys(playerAggregates).length} player records...`);
      let opCount = Object.keys(teamRecords).length;
      let currentBatch = batch;
      
      for (const [pid, stats] of Object.entries(playerAggregates)) {
        if (opCount >= 490) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          opCount = 0;
        }
        const playerRef = doc(db, 'leagues', currentLeagueId, 'players', pid);
        currentBatch.update(playerRef, {
          ...stats,
          updatedAt: serverTimestamp()
        });
        opCount++;
      }
      
      await currentBatch.commit();
      setSyncStep('success');
    } catch (err) {
      console.error("Error syncing standings:", err);
      setSyncError(err instanceof Error ? err.message : 'An unknown error occurred');
      setSyncStep('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const selectableTeams = useMemo(() => {
    // Start with all schools from constants
    const allSchools = SCHOOLS.map(s => ({
      id: s.name, // Use name as ID for CPU teams not yet in collection
      name: s.name,
      school: s.name,
      conference: s.conference,
      isCPU: true,
      isFCS: !!s.isFCS
    }));

    // Merge with active teams from Firestore
    const merged = [...allSchools];
    teams.forEach(activeTeam => {
      const index = merged.findIndex(s => s.name === activeTeam.name || s.name === activeTeam.school);
      if (index !== -1) {
        const base = merged[index];
        merged[index] = { 
          ...base, 
          ...activeTeam, 
          isCPU: !!activeTeam.isPlaceholder || !activeTeam.ownerId,
          isFCS: base.isFCS || !!activeTeam.isFCS // Ensure flag is preserved from constants if missing in DB
        };
      }
    });

    return merged.sort((a, b) => {
      // FCS teams at the bottom
      if (a.isFCS && !b.isFCS) return 1;
      if (!a.isFCS && b.isFCS) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [teams]);

  const handleEditClick = useCallback((game: Game) => {
    setEditingGameId(game.id);
    setHomeTeamId(game.homeTeamId);
    setAwayTeamId(game.awayTeamId);
    setWeek(game.week);
    setIsUvU(game.isUvU);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle editGameId from URL
  useEffect(() => {
    const editId = searchParams.get('editGameId');
    if (editId && games.length > 0) {
      const gameToEdit = games.find(g => g.id === editId);
      if (gameToEdit) {
        handleEditClick(gameToEdit);
        // Clear the param so it doesn't re-trigger on every render
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('editGameId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, games, handleEditClick, setSearchParams]);

  const handleSwapTeams = useCallback(() => {
    const currentHome = homeTeamId;
    const currentAway = awayTeamId;
    setHomeTeamId(currentAway);
    setAwayTeamId(currentHome);
  }, [homeTeamId, awayTeamId]);

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!homeTeamId || !awayTeamId) {
      setError('Please select both teams.');
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError('A team cannot play itself.');
      return;
    }

    setIsAddingGame(true);

    try {
      const homeTeam = selectableTeams.find(t => t.id === homeTeamId);
      const awayTeam = selectableTeams.find(t => t.id === awayTeamId);

      // FCS Validations
      if (homeTeam?.isFCS && awayTeam?.isFCS) {
        setError('FCS teams cannot play each other.');
        setIsAddingGame(false);
        return;
      }

      if (homeTeam?.isFCS) {
        setError('FCS teams must always be the Away team.');
        setIsAddingGame(false);
        return;
      }

      // Check if teams are already playing this week (unless they are FCS)
      const gamesRef = collection(db, 'leagues', currentLeagueId!, 'games');
      const weekGamesSnap = await getDocs(query(gamesRef, where('week', '==', week)));
      const weekGames = weekGamesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Game);

      const homeAlreadyPlaying = weekGames.some(g => 
        (g.homeTeamId === homeTeamId || g.awayTeamId === homeTeamId) && 
        g.id !== editingGameId
      );
      const awayAlreadyPlaying = weekGames.some(g => 
        (g.homeTeamId === awayTeamId || g.awayTeamId === awayTeamId) && 
        g.id !== editingGameId
      );

      if (homeAlreadyPlaying && !homeTeam?.isFCS) {
        setError(`${homeTeam?.name} is already playing a game in Week ${week}.`);
        setIsAddingGame(false);
        return;
      }
      if (awayAlreadyPlaying && !awayTeam?.isFCS) {
        setError(`${awayTeam?.name} is already playing a game in Week ${week}.`);
        setIsAddingGame(false);
        return;
      }

      // Ensure teams exist in the collection (for CPU teams)

      if (homeTeam?.isCPU) {
        const teamRef = doc(db, 'leagues', currentLeagueId!, 'teams', homeTeam.id);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) {
          await setDoc(teamRef, {
            name: homeTeam.name,
            school: homeTeam.name,
            conference: homeTeam.conference,
            coachName: 'CPU',
            coachRole: 'HC',
            isPlaceholder: true,
            isFCS: !!homeTeam.isFCS,
            wins: 0,
            losses: 0,
            confWins: 0,
            confLosses: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      if (awayTeam?.isCPU) {
        const teamRef = doc(db, 'leagues', currentLeagueId!, 'teams', awayTeam.id);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) {
          await setDoc(teamRef, {
            name: awayTeam.name,
            school: awayTeam.name,
            conference: awayTeam.conference,
            coachName: 'CPU',
            coachRole: 'HC',
            isPlaceholder: true,
            isFCS: !!awayTeam.isFCS,
            wins: 0,
            losses: 0,
            confWins: 0,
            confLosses: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      if (editingGameId) {
        const gameRef = doc(db, 'leagues', currentLeagueId!, 'games', editingGameId);
        await updateDoc(gameRef, {
          week,
          homeTeamId,
          awayTeamId,
          homeTeamName: homeTeam?.name || homeTeamId,
          awayTeamName: awayTeam?.name || awayTeamId,
          isUvU,
          updatedAt: serverTimestamp()
        });
        setEditingGameId(null);
      } else {
        const gamesRef = collection(db, 'leagues', currentLeagueId!, 'games');
        await addDoc(gamesRef, {
          week,
          homeTeamId,
          awayTeamId,
          homeTeamName: homeTeam?.name || homeTeamId,
          awayTeamName: awayTeam?.name || awayTeamId,
          homeScore: 0,
          awayScore: 0,
          isUvU,
          status: 'scheduled',
          leagueId: currentLeagueId,
          season: leagueInfo?.currentYear || 2025,
          createdBy: user?.uid || 'system',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      setHomeTeamId('');
      setAwayTeamId('');
      setIsUvU(false);
      setError(null);
    } catch (err) {
      console.error("Error saving game:", err);
      setError('Failed to save game. Please try again.');
    } finally {
      setIsAddingGame(false);
    }
  };

  const handleRevertScore = async (gameId: string) => {
    setIsReverting(true);
    try {
      const gameToRevert = games.find(g => g.id === gameId);
      if (!gameToRevert || gameToRevert.status !== 'final') return;

      const batch = writeBatch(db);
      const gameRef = doc(db, 'leagues', currentLeagueId!, 'games', gameId);
      const homeTeamRef = doc(db, 'leagues', currentLeagueId!, 'teams', gameToRevert.homeTeamId);
      const awayTeamRef = doc(db, 'leagues', currentLeagueId!, 'teams', gameToRevert.awayTeamId);
      const homeTeamData = teams.find(t => t.id === gameToRevert.homeTeamId);
      const awayTeamData = teams.find(t => t.id === gameToRevert.awayTeamId);
      
      const isConfGame = homeTeamData?.conference === awayTeamData?.conference;
      
      if (gameToRevert.homeScore > gameToRevert.awayScore) {
        // Revert Home Win
        batch.update(homeTeamRef, {
          wins: increment(-1),
          ...(isConfGame && { confWins: increment(-1) }),
          updatedAt: serverTimestamp()
        });
        batch.update(awayTeamRef, {
          losses: increment(-1),
          ...(isConfGame && { confLosses: increment(-1) }),
          updatedAt: serverTimestamp()
        });
      } else if (gameToRevert.awayScore > gameToRevert.homeScore) {
        // Revert Away Win
        batch.update(awayTeamRef, {
          wins: increment(-1),
          ...(isConfGame && { confWins: increment(-1) }),
          updatedAt: serverTimestamp()
        });
        batch.update(homeTeamRef, {
          losses: increment(-1),
          ...(isConfGame && { confLosses: increment(-1) }),
          updatedAt: serverTimestamp()
        });
      }

      batch.update(gameRef, {
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0,
        homeStats: null,
        awayStats: null,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      setShowRevertConfirm(null);
    } catch (err) {
      console.error("Error reverting score:", err);
    } finally {
      setIsReverting(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    setIsDeleting(true);
    try {
      const gameToDelete = games.find(g => g.id === gameId);
      if (!gameToDelete) return;

      const batch = writeBatch(db);
      const gameRef = doc(db, 'leagues', currentLeagueId!, 'games', gameId);
      
      if (gameToDelete.status === 'final') {
        const homeTeamRef = doc(db, 'leagues', currentLeagueId!, 'teams', gameToDelete.homeTeamId);
        const awayTeamRef = doc(db, 'leagues', currentLeagueId!, 'teams', gameToDelete.awayTeamId);
        const homeTeamData = teams.find(t => t.id === gameToDelete.homeTeamId);
        const awayTeamData = teams.find(t => t.id === gameToDelete.awayTeamId);
        
        const isConfGame = homeTeamData?.conference === awayTeamData?.conference;
        
        if (gameToDelete.homeScore > gameToDelete.awayScore) {
          // Revert Home Win
          batch.update(homeTeamRef, {
            wins: increment(-1),
            ...(isConfGame && { confWins: increment(-1) }),
            updatedAt: serverTimestamp()
          });
          batch.update(awayTeamRef, {
            losses: increment(-1),
            ...(isConfGame && { confLosses: increment(-1) }),
            updatedAt: serverTimestamp()
          });
        } else if (gameToDelete.awayScore > gameToDelete.homeScore) {
          // Revert Away Win
          batch.update(awayTeamRef, {
            wins: increment(-1),
            ...(isConfGame && { confWins: increment(-1) }),
            updatedAt: serverTimestamp()
          });
          batch.update(homeTeamRef, {
            losses: increment(-1),
            ...(isConfGame && { confLosses: increment(-1) }),
            updatedAt: serverTimestamp()
          });
        }
      }

      batch.delete(gameRef);
      await batch.commit();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting game:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdvanceWeek = async () => {
    setIsAdvancingWeek(true);
    try {
      const leagueRef = doc(db, 'leagues', currentLeagueId!);
      await updateDoc(leagueRef, {
        currentWeek: (leagueInfo?.currentWeek ?? 0) + 1,
        updatedAt: serverTimestamp()
      });

      // Log Activity
      const activityRef = collection(db, 'leagues', currentLeagueId!, 'activity_logs');
      await addDoc(activityRef, {
        leagueId: currentLeagueId!,
        type: 'league_event',
        title: 'Week Advanced',
        description: `The Commissioner has advanced the league to Week ${(leagueInfo?.currentWeek ?? 0) + 1}`,
        timestamp: serverTimestamp(),
        metadata: {
          week: (leagueInfo?.currentWeek ?? 0) + 1,
          season: leagueInfo?.currentYear,
          isHumanInvolved: true // Commissioner is human
        }
      });

      setShowAdvanceConfirm(false);
    } catch (err) {
      console.error("Error advancing week:", err);
      alert('Failed to advance week.');
    } finally {
      setIsAdvancingWeek(false);
    }
  };

  return (
    <div className="p-6 space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
          <Calendar className="w-8 h-8 text-orange-500" />
          Schedule Management
        </h1>
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-2xl">
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest">Current Week</span>
            <p className="text-lg sm:text-xl font-black text-orange-500">{leagueInfo?.currentWeek ?? 0}</p>
          </div>
          <button
            onClick={() => {
              setSyncStep('confirm');
              setShowSyncModal(true);
            }}
            disabled={isSyncing}
            className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 text-zinc-400 hover:text-orange-500 px-4 py-2 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 h-full"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Records</span>
            <span className="sm:hidden">Sync</span>
          </button>
        </div>
      </div>

      {/* Advance Week Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Advance to Next Week</h2>
            <p className="text-sm text-zinc-500">Move the entire league to Week {(leagueInfo?.currentWeek ?? 0) + 1}.</p>
          </div>
          <button
            onClick={() => setShowAdvanceConfirm(true)}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
          >
            Advance Week
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add/Edit Game Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            {editingGameId ? (
              <>
                <Pencil className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                Edit Game
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                Schedule New Game
              </>
            )}
          </h2>
          {editingGameId && (
            <button
              onClick={() => {
                setEditingGameId(null);
                setHomeTeamId('');
                setAwayTeamId('');
                setIsUvU(false);
              }}
              className="text-zinc-500 hover:text-white flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleAddGame} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6">
            <SearchableTeamSelect
              label="Away Team"
              value={awayTeamId}
              onChange={setAwayTeamId}
              options={selectableTeams}
              placeholder="Select Away Team"
            />

            <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:pt-6">
              <button
                type="button"
                onClick={handleSwapTeams}
                className="bg-zinc-950 p-2 sm:p-3 rounded-full border border-zinc-800 hover:border-orange-500 hover:text-orange-500 transition-all group"
                title="Swap Home/Away"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              </button>
              <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest md:hidden">Swap</span>
              <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest hidden md:block">Swap Teams</span>
            </div>

            <SearchableTeamSelect
              label="Home Team"
              value={homeTeamId}
              onChange={setHomeTeamId}
              options={selectableTeams}
              placeholder="Select Home Team"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6 pt-2">
            <div className="flex flex-wrap items-center gap-6 sm:gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Week</label>
                <input
                  type="number"
                  value={isNaN(week) ? '' : week}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setWeek(isNaN(val) ? 0 : val);
                  }}
                  className="w-20 sm:w-24 bg-zinc-950 border border-zinc-800 rounded-2xl py-2 sm:py-3 px-4 text-white font-bold text-center focus:border-orange-500 focus:ring-0 transition-all text-sm sm:text-base"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer group pt-6">
                <div 
                  onClick={() => setIsUvU(!isUvU)}
                  className={`w-10 h-5 sm:w-12 sm:h-6 rounded-full transition-all relative ${isUvU ? 'bg-orange-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-0.5 sm:top-1 w-4 h-4 rounded-full bg-white transition-all ${isUvU ? 'left-5.5 sm:left-7' : 'left-0.5 sm:left-1'}`} />
                </div>
                <span className="text-xs sm:text-sm font-bold text-zinc-400 group-hover:text-white transition-colors flex items-center gap-2">
                  <Gamepad2 className={`w-4 h-4 ${isUvU ? 'text-orange-500' : 'text-zinc-600'}`} />
                  User vs User
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isAddingGame}
              className="w-full sm:w-auto bg-zinc-100 hover:bg-white text-zinc-950 font-black px-8 py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm"
            >
              {isAddingGame ? (
                <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
              ) : (
                <>
                  {editingGameId ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {editingGameId ? 'Update Game' : 'Schedule Game'}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
        {[...Array(17)].map((_, i) => {
          const w = i;
          return (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                selectedWeek === w 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                  : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              Week {w}
            </button>
          );
        })}
      </div>

      {/* Current Week Games */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-orange-500" />
          Week {selectedWeek} Games
        </h2>

        <div className="grid gap-4">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">Loading games...</div>
          ) : games.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-[32px]">
              No games scheduled for this week.
            </div>
          ) : (
            games.map(game => (
              <div 
                key={game.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="flex items-center justify-between lg:justify-start gap-4 flex-1">
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 flex-1 justify-end text-center sm:text-right">
                    <span className="text-xs sm:text-sm font-bold text-white order-2 sm:order-1">{teams.find(t => t.id === game.awayTeamId)?.name}</span>
                    <TeamLogo schoolName={teams.find(t => t.id === game.awayTeamId)?.name || ''} className="w-8 h-8 sm:w-10 sm:h-10 object-contain order-1 sm:order-2" />
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[10px] font-black text-zinc-700 uppercase tracking-tighter">VS</div>
                    {game.isUvU && (
                      <div className="bg-orange-500/10 text-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-0.5">
                        <Gamepad2 className="w-2 h-2" />
                        UvU
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 flex-1 text-center sm:text-left">
                    <TeamLogo schoolName={teams.find(t => t.id === game.homeTeamId)?.name || ''} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                    <span className="text-xs sm:text-sm font-bold text-white">{teams.find(t => t.id === game.homeTeamId)?.name}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center sm:justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-zinc-800/50">
                  <div className="flex-1 sm:flex-none">
                    {game.status === 'scheduled' ? (
                      <button
                        onClick={() => setSelectedGameForReport(game)}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black px-4 py-2.5 rounded-xl uppercase tracking-widest transition-all"
                      >
                        <Trophy className="w-3 h-3 text-orange-500" />
                        Report Score
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowRevertConfirm(game.id)}
                        className="w-full flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 text-[10px] font-black px-4 py-2.5 rounded-xl uppercase tracking-widest transition-all group"
                        title="Click to revert score"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {game.awayScore || 0} - {game.homeScore || 0}
                        <RefreshCw className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditClick(game)}
                      className={`p-2.5 rounded-xl transition-colors ${editingGameId === game.id ? 'bg-orange-500/10 text-orange-500' : 'bg-zinc-800/50 text-zinc-500 hover:text-white'}`}
                    >
                      <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(game.id)}
                      className="p-2.5 rounded-xl bg-zinc-800/50 text-zinc-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Revert Confirmation Modal */}
      <AnimatePresence>
        {showRevertConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              onClick={() => !isReverting && setShowRevertConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[40px] p-8 z-[110] shadow-2xl"
            >
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                  <RefreshCw className="w-10 h-10 text-orange-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white">Revert Score?</h3>
                  <p className="text-zinc-400">
                    This will reset the score to 0-0 and <span className="text-orange-500 font-bold">revert the wins/losses</span> for both teams. 
                    The game will return to 'Scheduled' status.
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={() => handleRevertScore(showRevertConfirm)}
                    disabled={isReverting}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isReverting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Confirm Revert
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowRevertConfirm(null)}
                    disabled={isReverting}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              onClick={() => !isDeleting && setShowDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[40px] p-8 z-[110] shadow-2xl"
            >
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 className="w-10 h-10 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white">Delete Game?</h3>
                  <p className="text-zinc-400">
                    Are you sure? This will remove the game and <span className="text-red-500 font-bold">revert all associated records and stats</span>. 
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={() => handleDeleteGame(showDeleteConfirm)}
                    disabled={isDeleting}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-red-900/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isDeleting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Delete Game
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={isDeleting}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Advance Week Confirmation Modal */}
      <AnimatePresence>
        {showAdvanceConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              onClick={() => setShowAdvanceConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[40px] p-8 z-[110] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10 text-orange-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white">Advance Week?</h3>
                  <p className="text-zinc-400">
                    Are you sure? This will move the whole league to <span className="text-white font-bold">Week {(leagueInfo?.currentWeek ?? 0) + 1}</span>. 
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={handleAdvanceWeek}
                    disabled={isAdvancingWeek}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isAdvancingWeek ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        Confirm Advance
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAdvanceConfirm(false)}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sync Status Modal */}
      <AnimatePresence>
        {showSyncModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSyncing && setShowSyncModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[40px] p-8 z-[110] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] -z-10" />
              
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-orange-600/10 rounded-3xl flex items-center justify-center mx-auto border border-orange-600/20">
                  {syncStep === 'syncing' ? (
                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                  ) : syncStep === 'success' ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : syncStep === 'error' ? (
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  ) : (
                    <RefreshCw className="w-8 h-8 text-orange-500" />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">
                    {syncStep === 'confirm' ? 'Sync Records' : 
                     syncStep === 'syncing' ? 'Syncing...' : 
                     syncStep === 'success' ? 'Sync Complete' : 'Sync Failed'}
                  </h3>
                  <p className="text-sm text-zinc-500 font-medium">
                    {syncStep === 'confirm' ? 'This will recalculate all team records based on finalized games. Existing wins/losses will be overwritten.' : 
                     syncStep === 'syncing' ? syncProgress : 
                     syncStep === 'success' ? 'All team records have been successfully synchronized with game results.' : 
                     syncError || 'An error occurred while synchronizing records.'}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {syncStep === 'confirm' && (
                    <>
                      <button
                        onClick={handleSyncStandings}
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 uppercase tracking-widest text-xs"
                      >
                        Start Sync
                      </button>
                      <button
                        onClick={() => setShowSyncModal(false)}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {(syncStep === 'success' || syncStep === 'error') && (
                    <button
                      onClick={() => setShowSyncModal(false)}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {selectedGameForReport && currentLeagueId && (
        <ReportScoreModal
          isOpen={!!selectedGameForReport}
          onClose={() => setSelectedGameForReport(null)}
          game={selectedGameForReport}
          homeTeam={selectableTeams.find(t => t.id === selectedGameForReport.homeTeamId)! as any}
          awayTeam={selectableTeams.find(t => t.id === selectedGameForReport.awayTeamId)! as any}
          leagueId={currentLeagueId}
          userTeamId={userTeam?.id || ''}
          isAdmin={true}
          quarterLength={leagueInfo?.settings?.quarterLength}
        />
      )}
    </div>
  );
};

export default ScheduleManagement;
