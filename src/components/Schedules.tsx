import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Search, 
  ChevronRight, 
  Trophy, 
  Users, 
  BarChart3, 
  Clock, 
  MapPin,
  Plus,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Keyboard,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  limit,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User } from 'firebase/auth';
import { SCHOOLS } from '../constants/schools';
import { Game, TeamAssignment, League, Player, TeamGameStats, PlayerGameStats } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface SchedulesProps {
  user: User | null;
}

export const Schedules = ({ user }: SchedulesProps) => {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Management Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAddGameModalOpen, setIsAddGameModalOpen] = useState(false);
  const [addGameError, setAddGameError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [activeManageTab, setActiveManageTab] = useState<'SCORE' | 'TEAM_STATS' | 'PLAYER_STATS'>('SCORE');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);

  // Add Game Form State
  const [newGames, setNewGames] = useState<{ week: number; homeTeamId: string; awayTeamId: string }[]>([
    { week: 1, homeTeamId: '', awayTeamId: '' }
  ]);
  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isAddGameModalOpen) {
      // Small delay to ensure modal animation has started
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isAddGameModalOpen]);

  useEffect(() => {
    if (isAddGameModalOpen && newGames.length > 1) {
      // Focus the first field of the last row
      const selects = document.querySelectorAll('.batch-game-row select');
      const lastRowFirstSelect = selects[(newGames.length - 1) * 3] as HTMLSelectElement;
      lastRowFirstSelect?.focus();
    }
  }, [newGames.length, isAddGameModalOpen]);

  const handleBatchKeyDown = (e: React.KeyboardEvent, index: number) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const canSubmit = !isSaving && !newGames.some(g => !g.homeTeamId || !g.awayTeamId);
      if (canSubmit) {
        e.preventDefault();
        handleAddGame();
      }
      return;
    }

    // Add new row on Alt+N
    if (e.altKey && e.key === 'n') {
      e.preventDefault();
      addNewGameRow();
      return;
    }

    // Remove row on Alt+Backspace
    if (e.altKey && e.key === 'Backspace' && newGames.length > 1) {
      e.preventDefault();
      removeNewGameRow(index);
      return;
    }

    // Auto-add row on Tab from last field if filled
    if (e.key === 'Tab' && !e.shiftKey && index === newGames.length - 1) {
      const isLastField = (e.target as HTMLElement).getAttribute('data-last-field') === 'true';
      if (isLastField && newGames[index].homeTeamId && newGames[index].awayTeamId) {
        // We don't prevent default, just add the row. 
        // The tab will naturally move to the next focusable element, 
        // which will be the first field of the newly added row if we render it fast enough.
        addNewGameRow();
      }
    }
  };

  const addNewGameRow = () => {
    const lastWeek = newGames.length > 0 ? newGames[newGames.length - 1].week : 1;
    setNewGames([...newGames, { week: lastWeek, homeTeamId: '', awayTeamId: '' }]);
  };

  const removeNewGameRow = (index: number) => {
    if (newGames.length <= 1) return;
    setNewGames(newGames.filter((_, i) => i !== index));
  };

  const updateNewGame = (index: number, field: string, value: any) => {
    const updated = [...newGames];
    updated[index] = { ...updated[index], [field]: value };
    setNewGames(updated);
  };

  // Manage Game Form State
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [homeTeamStats, setHomeTeamStats] = useState<Partial<TeamGameStats>>({});
  const [awayTeamStats, setAwayTeamStats] = useState<Partial<TeamGameStats>>({});
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<{ [teamId: string]: Player[] }>({});

  useEffect(() => {
    if (!user) return;

    // Fetch League
    const leaguesQuery = query(collection(db, 'leagues'), where('ownerId', '==', user.uid), limit(1));
    const unsubscribeLeague = onSnapshot(leaguesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const leagueDoc = snapshot.docs[0];
        const leagueData = { id: leagueDoc.id, ...leagueDoc.data() } as League;
        setLeague(leagueData);

        // Fetch Teams
        const teamsQuery = collection(db, 'leagues', leagueDoc.id, 'teams');
        onSnapshot(teamsQuery, (teamSnapshot) => {
          const teamsData = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamAssignment));
          setTeams(teamsData);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `leagues/${leagueDoc.id}/teams`);
        });

        // Fetch Games
        const gamesQuery = collection(db, 'leagues', leagueDoc.id, 'games');
        onSnapshot(gamesQuery, (gameSnapshot) => {
          const gamesData = gameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
          setGames(gamesData.sort((a: Game, b: Game) => a.week - b.week));
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `leagues/${leagueDoc.id}/games`);
        });
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leagues');
    });

    return () => unsubscribeLeague();
  }, [user]);

  const handleAddGame = async () => {
    setAddGameError(null);
    if (!league || newGames.some(g => !g.homeTeamId || !g.awayTeamId)) {
      setAddGameError("Please fill out all team selections.");
      return;
    }

    // Map selected school names to league team IDs if they exist
    const getFinalTeamId = (selectedId: string) => {
      const leagueTeam = teams.find(t => t.name === selectedId || t.id === selectedId);
      return leagueTeam ? leagueTeam.id! : selectedId;
    };

    const getSchoolName = (teamId: string) => {
      const team = teams.find(t => t.id === teamId);
      return team ? team.name : teamId;
    };

    const isFBSSchool = (schoolName: string) => {
      const school = SCHOOLS.find(s => s.name === schoolName);
      return school && school.conference !== 'FCS';
    };

    // Validate all games
    const processedGames = newGames.map(g => ({
      ...g,
      homeTeamId: getFinalTeamId(g.homeTeamId),
      awayTeamId: getFinalTeamId(g.awayTeamId)
    }));

    // Check for internal conflicts (same team twice in same week in the new list)
    const weekConflicts = new Map<number, Set<string>>();
    for (const g of processedGames) {
      if (g.homeTeamId === g.awayTeamId) {
        setAddGameError(`Home and Away teams must be different (Week ${g.week}).`);
        return;
      }

      if (!weekConflicts.has(g.week)) weekConflicts.set(g.week, new Set());
      const weekTeams = weekConflicts.get(g.week)!;

      const homeName = getSchoolName(g.homeTeamId);
      const awayName = getSchoolName(g.awayTeamId);

      if (isFBSSchool(homeName)) {
        if (weekTeams.has(homeName)) {
          setAddGameError(`${homeName} is scheduled multiple times in Week ${g.week} in your new list.`);
          return;
        }
        weekTeams.add(homeName);
      }

      if (isFBSSchool(awayName)) {
        if (weekTeams.has(awayName)) {
          setAddGameError(`${awayName} is scheduled multiple times in Week ${g.week} in your new list.`);
          return;
        }
        weekTeams.add(awayName);
      }
    }

    // Check against existing games
    for (const g of processedGames) {
      const homeName = getSchoolName(g.homeTeamId);
      const awayName = getSchoolName(g.awayTeamId);

      if (isFBSSchool(homeName)) {
        const alreadyScheduled = games.some(eg => 
          eg.week === g.week && 
          (getSchoolName(eg.homeTeamId) === homeName || getSchoolName(eg.awayTeamId) === homeName)
        );
        if (alreadyScheduled) {
          setAddGameError(`${homeName} is already scheduled for Week ${g.week} in the existing schedule.`);
          return;
        }
      }

      if (isFBSSchool(awayName)) {
        const alreadyScheduled = games.some(eg => 
          eg.week === g.week && 
          (getSchoolName(eg.homeTeamId) === awayName || getSchoolName(eg.awayTeamId) === awayName)
        );
        if (alreadyScheduled) {
          setAddGameError(`${awayName} is already scheduled for Week ${g.week} in the existing schedule.`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const batch = processedGames.map(g => {
        const gameData: Partial<Game> = {
          week: g.week,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          homeScore: 0,
          awayScore: 0,
          status: 'scheduled',
          leagueId: league.id,
          season: league.currentYear,
          createdAt: serverTimestamp() as any,
          updatedAt: serverTimestamp() as any,
        };
        return addDoc(collection(db, 'leagues', league.id, 'games'), gameData);
      });

      await Promise.all(batch);
      
      setIsAddGameModalOpen(false);
      setNewGames([{ week: 1, homeTeamId: '', awayTeamId: '' }]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `leagues/${league.id}/games`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManageGame = async (game: Game) => {
    setSelectedGame(game);
    setHomeScore(game.homeScore || 0);
    setAwayScore(game.awayScore || 0);
    setIsManageModalOpen(true);
    setActiveManageTab('SCORE');
    setSaveSuccess(false);

    // Fetch existing stats if any
    const teamStatsQuery = query(collection(db, 'leagues', league!.id, 'teamStats'), where('gameId', '==', game.id));
    const teamStatsSnapshot = await getDocs(teamStatsQuery);
    teamStatsSnapshot.docs.forEach(doc => {
      const data = doc.data() as TeamGameStats;
      if (data.teamId === game.homeTeamId) setHomeTeamStats(data);
      if (data.teamId === game.awayTeamId) setAwayTeamStats(data);
    });

    const playerStatsQuery = query(collection(db, 'leagues', league!.id, 'playerStats'), where('gameId', '==', game.id));
    const playerStatsSnapshot = await getDocs(playerStatsQuery);
    setPlayerStats(playerStatsSnapshot.docs.map(doc => doc.data() as PlayerGameStats));

    // Fetch players for both teams
    const fetchPlayers = async (teamId: string) => {
      const playersQuery = query(collection(db, 'leagues', league!.id, 'players'), where('teamId', '==', teamId));
      const snapshot = await getDocs(playersQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
    };

    const homePlayers = await fetchPlayers(game.homeTeamId);
    const awayPlayers = await fetchPlayers(game.awayTeamId);
    setTeamPlayers({
      [game.homeTeamId]: homePlayers,
      [game.awayTeamId]: awayPlayers
    });
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!league) return;
    
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'leagues', league.id, 'games', gameId));
      setIsDeleteConfirmOpen(false);
      setGameToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leagues/${league.id}/games/${gameId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGame = async () => {
    if (!selectedGame || !league) return;
    setIsSaving(true);

    try {
      // 1. Update Game Score and Status
      const gameRef = doc(db, 'leagues', league.id, 'games', selectedGame.id);
      try {
        await updateDoc(gameRef, {
          homeScore,
          awayScore,
          status: 'completed',
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `leagues/${league.id}/games/${selectedGame.id}`);
      }

      // 2. Save Team Stats
      const saveTeamStats = async (teamId: string, stats: Partial<TeamGameStats>) => {
        const statsRef = doc(db, 'leagues', league.id, 'teamStats', `${selectedGame.id}_${teamId}`);
        try {
          await setDoc(statsRef, {
            ...stats,
            gameId: selectedGame.id,
            teamId,
            score: teamId === selectedGame.homeTeamId ? homeScore : awayScore,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `leagues/${league.id}/teamStats/${selectedGame.id}_${teamId}`);
        }
      };

      await saveTeamStats(selectedGame.homeTeamId, homeTeamStats);
      await saveTeamStats(selectedGame.awayTeamId, awayTeamStats);

      // 3. Save Player Stats
      for (const ps of playerStats) {
        const psRef = doc(db, 'leagues', league.id, 'playerStats', `${selectedGame.id}_${ps.playerId}`);
        try {
          await setDoc(psRef, {
            ...ps,
            gameId: selectedGame.id,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `leagues/${league.id}/playerStats/${selectedGame.id}_${ps.playerId}`);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsManageModalOpen(false);
        setSelectedGame(null);
      }, 1500);
    } catch (err) {
      console.error("Error saving game stats:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getTeam = (teamId: string) => {
    const leagueTeam = teams.find(t => t.id === teamId);
    if (leagueTeam) return leagueTeam;
    
    const school = SCHOOLS.find(s => s.name === teamId);
    if (school) {
      return {
        id: school.name,
        name: school.name,
        conference: school.conference,
        color: school.color,
        logoId: school.logoId,
        assignmentStatus: 'Inactive'
      } as TeamAssignment;
    }
    return null;
  };

  const filteredGames = games.filter(game => {
    const matchesWeek = selectedWeek === 'All' || game.week === selectedWeek;
    const homeTeam = getTeam(game.homeTeamId);
    const awayTeam = getTeam(game.awayTeamId);
    const matchesSearch = !searchQuery || 
      homeTeam?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      awayTeam?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWeek && matchesSearch;
  });

  const weeks = Array.from(new Set(games.map(g => g.week))).sort((a: number, b: number) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
          <Calendar className="text-zinc-700" size={32} />
        </div>
        <div className="space-y-1">
          <p className="text-white font-bold text-xl">No Dynasty Found</p>
          <p className="text-zinc-500">Initialize your dynasty on the Dashboard to view schedules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-orange-600 font-black text-[10px] uppercase tracking-[0.2em]">
            <Calendar size={14} />
            League Schedule
          </div>
          <h1 className="text-5xl font-display font-black text-white tracking-tight leading-none">Schedules</h1>
          <p className="text-zinc-500 font-medium">View and manage all games for the {league.currentYear} season.</p>
        </header>

        <button 
          onClick={() => setIsAddGameModalOpen(true)}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-2xl shadow-orange-600/30 active:scale-95"
        >
          <Plus size={20} />
          Add Game
        </button>
      </div>

      {/* Filters & Navigation */}
      <div className="space-y-6 sticky top-16 z-20 bg-[#050505]/80 backdrop-blur-xl pt-6 pb-4 -mx-4 px-4 md:-mx-10 md:px-10 border-b border-white/5 shadow-2xl shadow-black/50">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input 
              type="text" 
              placeholder="Search teams or matchups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl pl-14 pr-6 py-4 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600/50 transition-all font-medium"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1">
            <div className="flex glass-surface p-1.5 rounded-2xl">
              <button
                onClick={() => setSelectedWeek('All')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${
                  selectedWeek === 'All' 
                    ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                All Weeks
              </button>
              <div className="w-px h-6 bg-white/5 self-center mx-2" />
              {weeks.map((week) => (
                <button
                  key={week}
                  onClick={() => setSelectedWeek(week)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${
                    selectedWeek === week 
                      ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  Wk {week}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="space-y-12">
        {(selectedWeek === 'All' ? weeks : [selectedWeek]).map(week => {
          const weekGames = filteredGames.filter(g => g.week === week);
          if (weekGames.length === 0) return null;

          return (
            <div key={week} className="space-y-6">
              <div className="flex items-center gap-6">
                <h2 className="text-2xl font-display font-black text-white tracking-tight">Week {week}</h2>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {weekGames.map(game => {
                  const homeTeam = getTeam(game.homeTeamId);
                  const awayTeam = getTeam(game.awayTeamId);
                  const isUserGame = homeTeam?.ownerId === user?.uid || awayTeam?.ownerId === user?.uid || league.ownerId === user?.uid;

                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={game.id}
                      className="glass-card rounded-[2.5rem] p-8 hover:border-orange-600/30 transition-all duration-500 group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Trophy size={120} />
                      </div>

                      <div className="flex items-center justify-between mb-8 relative z-10">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${
                          game.status === 'completed' 
                            ? 'bg-green-500/5 text-green-500 border-green-500/20' 
                            : 'bg-orange-600/5 text-orange-600 border-orange-600/20'
                        }`}>
                          {game.status}
                        </span>
                        {isUserGame && (
                          <div className="flex items-center gap-6">
                            <button 
                              onClick={() => handleManageGame(game)}
                              className="text-[10px] font-black text-orange-600 hover:text-orange-500 flex items-center gap-2 transition-all uppercase tracking-widest active:scale-95"
                            >
                              <BarChart3 size={14} />
                              Manage
                            </button>
                            <button 
                              onClick={() => {
                                setGameToDelete(game.id!);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className="text-[10px] font-black text-zinc-600 hover:text-red-500 flex items-center gap-2 transition-all uppercase tracking-widest active:scale-95"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-6 relative z-10">
                        {/* Away Team */}
                        <div className="flex flex-col items-center gap-4 flex-1 text-center">
                          <div 
                            className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl border-4 border-[#050505] overflow-hidden bg-zinc-900 group-hover:scale-110 transition-transform duration-500"
                            style={{ backgroundColor: awayTeam?.color }}
                          >
                            {awayTeam?.name.charAt(0)}
                          </div>
                          <div className="space-y-1">
                            <p className="text-white font-black text-sm uppercase tracking-widest truncate w-full max-w-[140px]">{awayTeam?.name}</p>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] opacity-60">{awayTeam?.conference}</p>
                          </div>
                        </div>

                        {/* Score / VS */}
                        <div className="flex flex-col items-center gap-3 px-4">
                          {game.status === 'completed' ? (
                            <div className="flex items-center gap-6">
                              <span className={`text-4xl font-display font-black tracking-tighter ${game.awayScore! > game.homeScore! ? 'text-white' : 'text-zinc-700'}`}>
                                {game.awayScore}
                              </span>
                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                              <span className={`text-4xl font-display font-black tracking-tighter ${game.homeScore! > game.awayScore! ? 'text-white' : 'text-zinc-700'}`}>
                                {game.homeScore}
                              </span>
                            </div>
                          ) : (
                            <div className="text-3xl font-display font-black text-zinc-800 italic tracking-tighter">VS</div>
                          )}
                          <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-black uppercase tracking-[0.3em]">
                            <Clock size={12} />
                            {game.status === 'completed' ? 'Final' : 'Scheduled'}
                          </div>
                        </div>

                        {/* Home Team */}
                        <div className="flex flex-col items-center gap-4 flex-1 text-center">
                          <div 
                            className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl border-4 border-[#050505] overflow-hidden bg-zinc-900 group-hover:scale-110 transition-transform duration-500"
                            style={{ backgroundColor: homeTeam?.color }}
                          >
                            {homeTeam?.name.charAt(0)}
                          </div>
                          <div className="space-y-1">
                            <p className="text-white font-black text-sm uppercase tracking-widest truncate w-full max-w-[140px]">{homeTeam?.name}</p>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] opacity-60">{homeTeam?.conference}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manage Game Modal */}
      <AnimatePresence>
        {isManageModalOpen && selectedGame && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManageModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl glass-surface border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 md:p-10 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-600/20 shadow-lg shadow-orange-600/5">
                    <BarChart3 className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-black text-white tracking-tight leading-none">Manage Game Results</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black mt-2">Week {selectedGame.week} • {getTeam(selectedGame.awayTeamId)?.name} @ {getTeam(selectedGame.homeTeamId)?.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsManageModalOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex items-center gap-1.5 glass-surface p-1.5 border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
                {[
                  { id: 'SCORE', label: 'Final Score', icon: Trophy },
                  { id: 'TEAM_STATS', label: 'Team Stats', icon: BarChart3 },
                  { id: 'PLAYER_STATS', label: 'Player Stats', icon: Users },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveManageTab(tab.id as any)}
                    className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeManageTab === tab.id 
                        ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
                {saveSuccess ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 shadow-2xl shadow-green-500/10"
                    >
                      <CheckCircle2 className="text-green-500" size={48} />
                    </motion.div>
                    <div className="text-center space-y-2">
                      <p className="text-white font-display font-black text-3xl tracking-tight">Results Committed!</p>
                      <p className="text-zinc-500 font-medium">The dynasty history has been updated successfully.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {activeManageTab === 'SCORE' && (
                      <div className="max-w-xl mx-auto space-y-10">
                        <div className="grid grid-cols-2 gap-16">
                          <div className="space-y-6 text-center">
                            <div 
                              className="w-24 h-24 rounded-[2rem] flex items-center justify-center text-white font-black text-4xl shadow-2xl border-8 border-[#050505] overflow-hidden bg-zinc-900 mx-auto"
                              style={{ backgroundColor: getTeam(selectedGame.awayTeamId)?.color }}
                            >
                              {getTeam(selectedGame.awayTeamId)?.name.charAt(0)}
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Away Score</label>
                              <input 
                                type="number" 
                                value={awayScore}
                                onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                                className="w-full bg-white/5 border border-white/5 rounded-[2.5rem] px-6 py-8 text-center text-6xl font-display font-black text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-6 text-center">
                            <div 
                              className="w-24 h-24 rounded-[2rem] flex items-center justify-center text-white font-black text-4xl shadow-2xl border-8 border-[#050505] overflow-hidden bg-zinc-900 mx-auto"
                              style={{ backgroundColor: getTeam(selectedGame.homeTeamId)?.color }}
                            >
                              {getTeam(selectedGame.homeTeamId)?.name.charAt(0)}
                            </div>
                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Home Score</label>
                              <input 
                                type="number" 
                                value={homeScore}
                                onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                                className="w-full bg-white/5 border border-white/5 rounded-[2.5rem] px-6 py-8 text-center text-6xl font-display font-black text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeManageTab === 'TEAM_STATS' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        {/* Away Team Stats */}
                        <div className="space-y-8">
                          <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-black border border-white/10">
                              {getTeam(selectedGame.awayTeamId)?.name.charAt(0)}
                            </div>
                            <h4 className="text-white font-display font-bold text-lg">{getTeam(selectedGame.awayTeamId)?.name} Stats</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            {[
                              { label: 'Total Yards', key: 'totalYards' },
                              { label: 'Passing Yards', key: 'passingYards' },
                              { label: 'Rushing Yards', key: 'rushingYards' },
                              { label: 'Turnovers', key: 'turnovers' },
                              { label: 'First Downs', key: 'firstDowns' },
                              { label: 'TOP', key: 'timeOfPossession', type: 'text' },
                            ].map(field => (
                              <div key={field.key} className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{field.label}</label>
                                <input 
                                  type={field.type || 'number'} 
                                  value={(awayTeamStats as any)[field.key] || ''}
                                  onChange={(e) => setAwayTeamStats({ ...awayTeamStats, [field.key]: e.target.value })}
                                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Home Team Stats */}
                        <div className="space-y-8">
                          <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-black border border-white/10">
                              {getTeam(selectedGame.homeTeamId)?.name.charAt(0)}
                            </div>
                            <h4 className="text-white font-display font-bold text-lg">{getTeam(selectedGame.homeTeamId)?.name} Stats</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            {[
                              { label: 'Total Yards', key: 'totalYards' },
                              { label: 'Passing Yards', key: 'passingYards' },
                              { label: 'Rushing Yards', key: 'rushingYards' },
                              { label: 'Turnovers', key: 'turnovers' },
                              { label: 'First Downs', key: 'firstDowns' },
                              { label: 'TOP', key: 'timeOfPossession', type: 'text' },
                            ].map(field => (
                              <div key={field.key} className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{field.label}</label>
                                <input 
                                  type={field.type || 'number'} 
                                  value={(homeTeamStats as any)[field.key] || ''}
                                  onChange={(e) => setHomeTeamStats({ ...homeTeamStats, [field.key]: e.target.value })}
                                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeManageTab === 'PLAYER_STATS' && (
                      <div className="space-y-12">
                        {[selectedGame.awayTeamId, selectedGame.homeTeamId].map(teamId => {
                          const team = getTeam(teamId);
                          const players = teamPlayers[teamId] || [];
                          
                          return (
                            <div key={teamId} className="space-y-6">
                              <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white font-black text-xs border border-white/10">
                                  {team?.name.charAt(0)}
                                </div>
                                <h4 className="text-white font-display font-bold text-base">{team?.name} Player Performance</h4>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-4">
                                {players.map(player => {
                                  const stats = playerStats.find(ps => ps.playerId === player.id) || {
                                    gameId: selectedGame.id,
                                    playerId: player.id,
                                    teamId: teamId,
                                  };

                                  const updatePlayerStat = (key: string, val: any) => {
                                    const existing = playerStats.findIndex(ps => ps.playerId === player.id);
                                    const newStat = { ...stats, [key]: val };
                                    if (existing >= 0) {
                                      const updated = [...playerStats];
                                      updated[existing] = newStat;
                                      setPlayerStats(updated);
                                    } else {
                                      setPlayerStats([...playerStats, newStat]);
                                    }
                                  };

                                  return (
                                    <div key={player.id} className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-white/5 rounded-[1.5rem] border border-white/5 hover:border-orange-600/20 transition-all group">
                                      <div className="w-40 shrink-0">
                                        <p className="text-white font-black text-sm uppercase tracking-widest truncate group-hover:text-orange-600 transition-colors">{player.name}</p>
                                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1 opacity-60">{player.pos}</p>
                                      </div>
                                      
                                      <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-4 w-full">
                                        {player.pos === 'QB' ? (
                                          <>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Pass Yds</label>
                                              <input type="number" value={stats.passYds || ''} onChange={(e) => updatePlayerStat('passYds', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">TDs</label>
                                              <input type="number" value={stats.passTDs || ''} onChange={(e) => updatePlayerStat('passTDs', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">INTs</label>
                                              <input type="number" value={stats.passInts || ''} onChange={(e) => updatePlayerStat('passInts', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                          </>
                                        ) : ['RB', 'WR', 'TE'].includes(player.pos) ? (
                                          <>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Rush Yds</label>
                                              <input type="number" value={stats.rushYds || ''} onChange={(e) => updatePlayerStat('rushYds', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Rec Yds</label>
                                              <input type="number" value={stats.recYds || ''} onChange={(e) => updatePlayerStat('recYds', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">TDs</label>
                                              <input type="number" value={stats.rushTDs || stats.recTDs || ''} onChange={(e) => updatePlayerStat(player.pos === 'RB' ? 'rushTDs' : 'recTDs', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Tackles</label>
                                              <input type="number" value={stats.tackles || ''} onChange={(e) => updatePlayerStat('tackles', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Sacks</label>
                                              <input type="number" value={stats.sacks || ''} onChange={(e) => updatePlayerStat('sacks', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">INTs</label>
                                              <input type="number" value={stats.ints || ''} onChange={(e) => updatePlayerStat('ints', parseInt(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50" />
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-white/5 bg-white/5 flex items-center justify-between">
                <button 
                  onClick={() => setIsManageModalOpen(false)}
                  className="text-zinc-500 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveGame}
                  disabled={isSaving || saveSuccess}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] uppercase tracking-[0.2em] px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-orange-600/30 disabled:opacity-50 flex items-center gap-3 active:scale-95"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={18} />
                      Commit Results
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Game Modal */}
      <AnimatePresence>
        {isAddGameModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddGameModalOpen(false);
                setAddGameError(null);
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl glass-surface border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-600/20">
                    <Plus className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black text-white tracking-tight leading-none">Batch Schedule Games</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-2">Add multiple matchups at once</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsAddGameModalOpen(false);
                    setAddGameError(null);
                  }}
                  className="p-3 text-zinc-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-6 overflow-y-auto no-scrollbar">
                {addGameError && (
                  <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-[1.5rem] flex items-center gap-4 text-red-500 text-xs font-black uppercase tracking-widest">
                    <AlertCircle size={20} />
                    {addGameError}
                  </div>
                )}
                {newGames.map((game, index) => (
                  <div key={index} className="batch-game-row grid grid-cols-2 lg:grid-cols-[140px_1fr_60px_1fr_60px] items-end gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5 relative group hover:border-orange-600/20 transition-all">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Week</label>
                      <select 
                        ref={index === 0 ? firstInputRef : null}
                        value={game.week}
                        onChange={(e) => updateNewGame(index, 'week', parseInt(e.target.value))}
                        onKeyDown={(e) => handleBatchKeyDown(e, index)}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all appearance-none"
                      >
                        {[...Array(20)].map((_, i) => (
                          <option key={i + 1} value={i + 1} className="bg-zinc-900">Wk {i + 1}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Away Team</label>
                      <select 
                        value={game.awayTeamId}
                        onChange={(e) => updateNewGame(index, 'awayTeamId', e.target.value)}
                        onKeyDown={(e) => handleBatchKeyDown(e, index)}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all appearance-none"
                      >
                        <option value="" className="bg-zinc-900">Select Away</option>
                        <optgroup label="League Teams" className="bg-zinc-900">
                          {teams.map(team => (
                            <option key={team.id} value={team.id} className="bg-zinc-900">{team.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="All Schools" className="bg-zinc-900">
                          {SCHOOLS.filter(s => !teams.some(t => t.name === s.name)).sort((a, b) => a.name.localeCompare(b.name)).map(school => (
                            <option key={school.name} value={school.name} className="bg-zinc-900">{school.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="hidden lg:flex items-center justify-center pb-4">
                      <span className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em] italic">VS</span>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Home Team</label>
                      <select 
                        value={game.homeTeamId}
                        onChange={(e) => updateNewGame(index, 'homeTeamId', e.target.value)}
                        onKeyDown={(e) => handleBatchKeyDown(e, index)}
                        data-last-field="true"
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all appearance-none"
                      >
                        <option value="" className="bg-zinc-900">Select Home</option>
                        <optgroup label="League Teams" className="bg-zinc-900">
                          {teams.map(team => (
                            <option key={team.id} value={team.id} className="bg-zinc-900">{team.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="All Schools" className="bg-zinc-900">
                          {SCHOOLS.filter(s => !teams.some(t => t.name === s.name)).sort((a, b) => a.name.localeCompare(b.name)).map(school => (
                            <option key={school.name} value={school.name} className="bg-zinc-900">{school.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="flex items-center justify-center pb-1">
                      <button 
                        onClick={() => removeNewGameRow(index)}
                        disabled={newGames.length === 1}
                        className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all disabled:opacity-0"
                        title="Remove game"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addNewGameRow}
                  className="w-full py-6 border-2 border-dashed border-white/5 rounded-[2rem] text-zinc-500 hover:text-white hover:border-orange-600/30 hover:bg-white/5 transition-all flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <Plus size={20} />
                  Add Another Matchup
                </button>
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-white/5 bg-white/5 flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-zinc-500 font-medium">
                    <span className="text-white font-black">{newGames.length}</span> {newGames.length === 1 ? 'game' : 'games'} to be scheduled
                  </div>
                  <div className="flex items-center gap-4 text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 font-sans">⌘↵</kbd> Submit
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 font-sans">⌥N</kbd> Add Row
                    </div>
                    <div className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 font-sans">Tab</kbd> Auto-Add
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => {
                      setIsAddGameModalOpen(false);
                      setAddGameError(null);
                    }}
                    className="text-zinc-500 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddGame}
                    disabled={isSaving || newGames.some(g => !g.homeTeamId || !g.awayTeamId)}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] uppercase tracking-[0.2em] px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-orange-600/30 disabled:opacity-50 flex items-center gap-3 active:scale-95"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Calendar size={18} />
                        Schedule All Games
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                setGameToDelete(null);
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-surface border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden p-10 text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/10">
                <Trash2 className="text-red-500" size={36} />
              </div>
              <h2 className="text-3xl font-display font-black text-white mb-3 tracking-tight">Delete Game?</h2>
              <p className="text-zinc-500 font-medium mb-10 leading-relaxed">This action cannot be undone. All stats associated with this game will be lost forever.</p>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setGameToDelete(null);
                  }}
                  className="flex-1 px-8 py-4 bg-white/5 text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => gameToDelete && handleDeleteGame(gameToDelete)}
                  disabled={isSaving}
                  className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-2xl shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
