import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  School as SchoolIcon, 
  Filter, 
  ChevronRight, 
  ArrowLeft, 
  Trophy, 
  Users, 
  MapPin, 
  Star, 
  Zap, 
  Shield,
  X,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Calendar,
  BarChart3,
  LayoutDashboard,
  Clock,
  ChevronRight as ChevronRightIcon,
  User as UserIcon,
  Hash,
  Target,
  Ruler,
  Weight,
  ChevronDown,
  LayoutGrid,
  Grid2x2,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SCHOOLS, School } from '../constants/schools';
import { DEFAULT_COACHES } from '../constants/defaultCoaches';
import { User } from 'firebase/auth';
import { 
  collection, 
  collectionGroup,
  query, 
  where, 
  onSnapshot, 
  getDocs,
  getDoc,
  addDoc, 
  updateDoc,
  doc,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { TeamAssignment, League, Player } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

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

export const Schools = () => {
  const { user } = useAuth();
  const { leagueInfo: userLeague, userRole } = useLeague();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConference, setSelectedConference] = useState<string>('All');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ROSTER' | 'SCHEDULE' | 'TEAM_STATS' | 'PLAYER_STATS'>('OVERVIEW');
  
  // Dynasty Assignment State
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
  const [schoolPlayers, setSchoolPlayers] = useState<Player[]>([]);
  const [coachName, setCoachName] = useState(user?.displayName || '');
  const [coachRole, setCoachRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolGames, setSchoolGames] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);

  const [newPlayer, setNewPlayer] = useState({
    name: '',
    pos: 'QB',
    number: 1,
    heightFeet: 6,
    heightInches: 0,
    weight: 200,
    year: 'Freshman' as 'Freshman' | 'Sophomore' | 'Junior' | 'Senior',
    redshirt: false,
    ovr: 70,
    archetype: 'Balanced'
  });

  useEffect(() => {
    if (!userLeague) {
      setLeagueTeams([]);
      setAllTeams([]);
      return;
    }

    // Fetch all teams in this league to check for assignments
    const teamsQuery = collection(db, 'leagues', userLeague.id, 'teams');
    const unsubscribeTeams = onSnapshot(teamsQuery, (teamSnapshot) => {
      const teams = teamSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeagueTeams(teams);
      setAllTeams(teams);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `leagues/${userLeague.id}/teams`);
    });

    return () => unsubscribeTeams();
  }, [userLeague]);

  useEffect(() => {
    if (!selectedSchool || !userLeague || !leagueTeams.length) {
      setSchoolPlayers([]);
      return;
    }

    const team = leagueTeams.find(t => t.name === selectedSchool.name);
    if (!team) {
      setSchoolPlayers([]);
      return;
    }

    const playersQuery = query(
      collection(db, 'leagues', userLeague.id, 'players'),
      where('teamId', '==', team.id)
    );

    const unsubscribe = onSnapshot(playersQuery, (snapshot) => {
      const players = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setSchoolPlayers(players.sort((a, b) => b.ovr - a.ovr));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `leagues/${userLeague.id}/players`);
    });

    return () => unsubscribe();
  }, [selectedSchool, userLeague, leagueTeams]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to add players.");
      return;
    }
    if (!userLeague) {
      setError("No active league found. Please ensure you are an owner or coach in a league.");
      return;
    }
    if (!selectedSchool) {
      setError("No school selected.");
      return;
    }
    if (!newPlayer.name) {
      setError("Player name is required.");
      return;
    }

    if (isNaN(newPlayer.number) || isNaN(newPlayer.weight) || isNaN(newPlayer.ovr) || isNaN(newPlayer.heightFeet) || isNaN(newPlayer.heightInches)) {
      setError("Please fill out all numeric fields correctly.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let team = leagueTeams.find(t => t.name === selectedSchool.name);
      
      // Auto-track the school as a CPU-controlled team if it's not in the league yet
      if (!team) {
        const teamRef = await addDoc(collection(db, 'leagues', userLeague.id, 'teams'), {
          name: selectedSchool.name,
          coachName: 'CPU Controlled',
          coachRole: 'HC',
          leagueId: userLeague.id,
          ownerId: 'cpu', // Mark as CPU-controlled
          conference: selectedSchool.conference,
          logoId: selectedSchool.logoId,
          color: selectedSchool.color,
          assignmentStatus: 'Active',
          contractStart: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        team = { id: teamRef.id, name: selectedSchool.name };
      }

      const formattedHeight = `${newPlayer.heightFeet}'${newPlayer.heightInches}"`;
      const { heightFeet, heightInches, ...playerData } = newPlayer;
      
      const playersPath = `leagues/${userLeague.id}/players`;
      await addDoc(collection(db, playersPath), {
        ...playerData,
        height: formattedHeight,
        teamId: team.id,
        leagueId: userLeague.id,
        createdAt: serverTimestamp()
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setIsAddPlayerModalOpen(false);
        setSaveSuccess(false);
        setNewPlayer({
          name: '',
          pos: 'QB',
          number: 1,
          heightFeet: 6,
          heightInches: 0,
          weight: 200,
          year: 'Freshman',
          redshirt: false,
          ovr: 70,
          archetype: 'Balanced'
        });
      }, 2000);
    } catch (err) {
      console.error("Error adding player:", err);
      if (err instanceof Error && err.message.includes('permission-denied')) {
        setError("Permission denied. You may not have authority to add players to this roster.");
      } else {
        setError("Failed to add player to roster. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRedshirt = async (player: Player) => {
    if (!user || !userLeague) return;
    
    try {
      const playerRef = doc(db, 'leagues', userLeague.id, 'players', player.id);
      await updateDoc(playerRef, {
        redshirt: !player.redshirt
      });
    } catch (err) {
      console.error("Error toggling redshirt:", err);
      setError("Failed to update redshirt status.");
    }
  };

  useEffect(() => {
    if (!selectedSchool || !userLeague) {
      setSchoolGames([]);
      return;
    }

    // Find the team ID for the selected school in this league
    const team = leagueTeams.find(t => t.name === selectedSchool.name);
    if (!team) {
      setSchoolGames([]);
      return;
    }

    const gamesQuery = query(
      collection(db, 'leagues', userLeague.id, 'games'),
      where('homeTeamId', '==', team.id)
    );
    
    const gamesQuery2 = query(
      collection(db, 'leagues', userLeague.id, 'games'),
      where('awayTeamId', '==', team.id)
    );

    const unsubscribe1 = onSnapshot(gamesQuery, (snapshot) => {
      const homeGames = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSchoolGames(prev => {
        const otherGames = prev.filter(g => g.homeTeamId !== team.id);
        return [...otherGames, ...homeGames].sort((a, b) => a.week - b.week);
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `leagues/${userLeague.id}/games`);
    });

    const unsubscribe2 = onSnapshot(gamesQuery2, (snapshot) => {
      const awayGames = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSchoolGames(prev => {
        const otherGames = prev.filter(g => g.awayTeamId !== team.id);
        return [...otherGames, ...awayGames].sort((a, b) => a.week - b.week);
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `leagues/${userLeague.id}/games`);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [selectedSchool, userLeague, leagueTeams]);

  const isTeamOwner = useMemo(() => {
    if (!user || !selectedSchool || !leagueTeams.length) return false;
    const team = leagueTeams.find(t => t.name === selectedSchool.name);
    return team && team.ownerId === user.uid;
  }, [user, selectedSchool, leagueTeams]);

  const isLeagueOwner = useMemo(() => {
    if (!user || !userLeague) return false;
    return userLeague.ownerId === user.uid;
  }, [user, userLeague]);

  const existingCoach = useMemo(() => {
    if (!selectedSchool || !leagueTeams.length) return null;
    return leagueTeams.find(t => t.name === selectedSchool.name);
  }, [selectedSchool, leagueTeams]);

  const isCpuCoach = useMemo(() => {
    return existingCoach?.ownerId === 'cpu';
  }, [existingCoach]);

  const defaultStaff = useMemo(() => {
    if (!selectedSchool) return [];
    return DEFAULT_COACHES.filter(c => c.school === selectedSchool.name);
  }, [selectedSchool]);

  const defaultHC = useMemo(() => {
    return defaultStaff.find(c => c.role === 'HC');
  }, [defaultStaff]);

  const handleAssignCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userLeague || !selectedSchool || !coachName) return;
    
    const isWindowOpen = userLeague.seasonPhase === 'Off Season' || userLeague.seasonPhase === 'CFP Window';
    
    // Allow assignment if there's no coach OR if the current coach is CPU
    if (existingCoach && !isCpuCoach && !isWindowOpen) {
      setError("This program is currently under contract. Assignments are only allowed during Off Season or CFP Window.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (existingCoach && isCpuCoach) {
        // Update existing CPU team to be user-controlled
        await updateDoc(doc(db, 'leagues', userLeague.id, 'teams', existingCoach.id!), {
          coachName,
          coachRole,
          ownerId: user.uid,
          assignmentStatus: 'Active',
          contractStart: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Add new team document
        await addDoc(collection(db, 'leagues', userLeague.id, 'teams'), {
          name: selectedSchool.name,
          coachName,
          coachRole,
          leagueId: userLeague.id,
          ownerId: user.uid,
          conference: selectedSchool.conference,
          logoId: selectedSchool.logoId,
          color: selectedSchool.color,
          assignmentStatus: 'Active',
          contractStart: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsTrackModalOpen(false);
        setSaveSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Error assigning coach:", err);
      setError("Failed to assign coach to this program.");
    } finally {
      setIsSaving(false);
    }
  };

  const conferences = useMemo(() => {
    const confs = Array.from(new Set(SCHOOLS.map(s => s.conference)));
    return ['All', ...confs.sort()];
  }, []);

  const filteredSchools = useMemo(() => {
    return SCHOOLS.filter(school => {
      const matchesSearch = (school.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesConference = selectedConference === 'All' || school.conference === selectedConference;
      return matchesSearch && matchesConference;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [searchQuery, selectedConference]);

  const schoolCoaches = useMemo(() => {
    const map: { [key: string]: { name: string, role: string, isUser: boolean } } = {};
    
    // First, populate with default coaches
    DEFAULT_COACHES.forEach(c => {
      if (c.role === 'HC') {
        map[c.school] = { name: `${c.firstName} ${c.lastName}`, role: 'HC', isUser: false };
      }
    });

    // Then, override with league assignments
    leagueTeams.forEach(t => {
      if (t.coachRole === 'HC') {
        map[t.name] = { name: t.coachName, role: 'HC', isUser: true };
      }
    });

    return map;
  }, [leagueTeams]);

  const getLogoUrl = (school: School) => {
    if (school.logoId) {
      return `https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`;
    }
    return null;
  };

  if (selectedSchool) {
    const logoUrl = getLogoUrl(selectedSchool);
    const existingCoach = leagueTeams.find(t => t.name === selectedSchool.name);
    const defaultHC = DEFAULT_COACHES.find(c => c.school === selectedSchool.name && c.role === 'HC');

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 sm:space-y-8 max-w-7xl mx-auto"
      >
        {/* School Hero Banner */}
        <div className="relative h-56 sm:h-80 rounded-3xl sm:rounded-[3rem] overflow-hidden glass-card glass-glow mb-6 sm:mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-transparent to-black/60 z-10" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 z-0" />
          
          <div className="absolute inset-0 flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-8 p-6 sm:p-12 z-20">
            <div className="relative group">
              <div className="absolute -inset-4 bg-orange-600/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition duration-700" />
              <div className="w-24 h-24 sm:w-40 sm:h-40 glass-surface rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-6 flex items-center justify-center relative z-10 border border-white/10">
                {logoUrl ? (
                  <img src={logoUrl} alt={selectedSchool.name} className="w-full h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
                ) : (
                  <SchoolIcon size={48} className="text-orange-600 sm:w-20 sm:h-20" />
                )}
              </div>
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-2 sm:space-y-4">
              <div className="space-y-1">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-center sm:justify-start gap-2 text-orange-500 font-black text-[10px] sm:text-xs uppercase tracking-[0.4em]"
                >
                  <Trophy size={14} />
                  {selectedSchool.conference} Conference
                </motion.div>
                <h1 className="text-3xl sm:text-6xl font-display font-black text-white tracking-tighter leading-none">
                  {selectedSchool.name.toUpperCase()}
                </h1>
              </div>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6">
                <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 glass-surface rounded-xl border border-white/10">
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Record</span>
                  <span className="text-sm sm:text-base font-black text-white">10-2</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 glass-surface rounded-xl border border-white/10">
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Rank</span>
                  <span className="text-sm sm:text-base font-black text-orange-500">#4</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 glass-surface rounded-xl border border-white/10">
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Prestige</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${s <= 5 ? 'bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.5)]' : 'bg-zinc-800'}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-6 right-6 flex gap-3">
              <button 
                onClick={() => setSelectedSchool(null)}
                className="p-2.5 sm:p-3 glass-surface hover:bg-white/10 rounded-2xl transition-all border border-white/10 group active:scale-90"
              >
                <X size={20} className="text-zinc-400 group-hover:text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 glass-surface p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar border border-white/5">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: LayoutDashboard },
            { id: 'ROSTER', label: 'Roster', icon: Users },
            { id: 'SCHEDULE', label: 'Schedule', icon: Calendar },
            { id: 'TEAM_STATS', label: 'Team Stats', icon: BarChart3 },
            { id: 'PLAYER_STATS', label: 'Player Stats', icon: Trophy },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-all duration-500 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 scale-105' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'OVERVIEW' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Stats Bento */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-[2rem] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Program Prestige</h3>
                <Star className="text-yellow-500" size={20} />
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={32} className={s <= 4 ? "text-yellow-500 fill-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" : "text-zinc-800"} />
                ))}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed font-medium">A powerhouse program with deep historical roots and a consistent track record of success in the {selectedSchool.conference}.</p>
            </div>

            <div className="glass-card p-8 rounded-[2rem] space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Roster Strength</h3>
                <Zap className="text-orange-600" size={20} />
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">OFFENSE</span>
                    <span className="text-white">88 OVR</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.4)] w-[88%]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">DEFENSE</span>
                    <span className="text-white">92 OVR</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.4)] w-[92%]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 glass-card p-8 rounded-[2rem]">
              <h3 className="text-xl font-display font-bold text-white mb-8">Coaching Staff</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['HC', 'OC', 'DC'].map(role => {
                  const userCoach = existingCoach && existingCoach.coachRole === role ? existingCoach : null;
                  const defCoach = defaultStaff.find(c => c.role === role);
                  
                  return (
                    <div key={role} className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-3 group hover:border-orange-600/30 transition-all duration-300">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{role === 'HC' ? 'Head Coach' : role === 'OC' ? 'Offensive Coord.' : 'Defensive Coord.'}</span>
                        {userCoach && <span className="px-2 py-0.5 bg-orange-600 text-[8px] font-black text-white rounded-full uppercase tracking-widest shadow-lg shadow-orange-600/20">User</span>}
                      </div>
                      <p className="text-white font-bold text-lg truncate group-hover:text-orange-600 transition-colors">
                        {userCoach ? userCoach.coachName : defCoach ? `${defCoach.firstName} ${defCoach.lastName}` : 'Vacant'}
                      </p>
                      {defCoach && !userCoach && (
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-zinc-400">Lvl {defCoach.level}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-lg uppercase font-black tracking-widest">{defCoach.prestige}</span>
                        </div>
                      )}
                      {defCoach && (
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest italic truncate opacity-60">{role === 'OC' ? defCoach.offensiveScheme : role === 'DC' ? defCoach.defensiveScheme : defCoach.archetype}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 glass-card p-8 rounded-[2rem]">
              <h3 className="text-xl font-display font-bold text-white mb-8">Recent Dynasty History</h3>
              <div className="space-y-5">
                {[
                  { season: '2024', record: '11-2', finish: 'Conference Champs', bowl: 'Rose Bowl' },
                  { season: '2023', record: '9-4', finish: '2nd in Division', bowl: 'Citrus Bowl' },
                ].map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all duration-300 group">
                    <div className="flex items-center gap-6">
                      <span className="text-2xl font-display font-black text-white group-hover:text-orange-600 transition-colors">{h.season}</span>
                      <div className="h-10 w-px bg-white/10" />
                      <div>
                        <p className="text-base text-white font-bold">{h.finish}</p>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{h.bowl}</p>
                      </div>
                    </div>
                    <span className="text-xl font-display font-black text-orange-600 tracking-tighter">{h.record}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <div className="glass-card p-8 rounded-[2rem] space-y-8">
              <h3 className="text-xl font-display font-bold text-white">Program Details</h3>
              <div className="space-y-5">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Stadium</span>
                  <span className="text-white text-sm font-bold">Memorial Stadium</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Capacity</span>
                  <span className="text-white text-sm font-bold">85,000</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Location</span>
                  <span className="text-white text-sm font-bold">College Town, USA</span>
                </div>
              </div>
              
              <div className="space-y-4 pt-2">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Primary Rivals</h4>
                <div className="flex flex-wrap gap-3">
                  {['Rival State', 'Tech University'].map(r => (
                    <span key={r} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white font-bold hover:border-orange-600/30 transition-colors cursor-default">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-orange-600/5 border border-orange-600/10 p-8 rounded-[2rem] space-y-4 relative overflow-hidden group">
              <div className="absolute -top-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                <Shield size={120} />
              </div>
              <div className="flex items-center gap-3 text-orange-600">
                <Shield size={20} />
                <span className="font-black text-xs uppercase tracking-[0.2em]">Recruiting Focus</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Currently prioritizing 4-star recruits in the local region. Pipeline strength is high in the Southeast.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'ROSTER' && (
        <motion.div
          key="roster"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="glass-card rounded-[2.5rem] overflow-hidden"
        >
          <div className="p-6 sm:p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5">
            <h3 className="text-xl font-display font-bold text-white">Active Roster</h3>
            <div className="flex items-center justify-between sm:justify-end gap-4">
              <span className="px-3 py-1 bg-zinc-950/50 rounded-full text-[10px] font-black text-zinc-500 font-mono tracking-widest border border-white/5">
                {schoolPlayers.length} / 85 SCHOLARSHIPS
              </span>
              {userLeague && (
                <button 
                  onClick={() => setIsAddPlayerModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20 active:scale-95"
                >
                  <UserPlus size={14} />
                  <span className="hidden xs:inline">Add Player</span>
                  <span className="xs:hidden">Add</span>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950/30 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">
                  <th className="px-8 py-5">#</th>
                  <th className="px-8 py-5">Player</th>
                  <th className="px-8 py-5 text-center">Pos</th>
                  <th className="px-8 py-5 text-center">Year</th>
                  <th className="px-8 py-5 text-center">RS</th>
                  <th className="px-8 py-5 text-center">OVR</th>
                  <th className="px-8 py-5 text-center">Ht/Wt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {schoolPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center text-zinc-500 font-medium italic">
                      No players currently on the roster.
                    </td>
                  </tr>
                ) : (
                  schoolPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-white/5 transition-colors group cursor-default">
                      <td className="px-8 py-5 text-zinc-500 font-mono text-xs font-bold">#{player.number}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-[10px] font-black text-zinc-500 border border-white/5 group-hover:border-orange-600/30 transition-colors">
                            {player.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <span className="text-white font-bold group-hover:text-orange-600 transition-colors block">{player.name}</span>
                            <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{player.archetype || 'Balanced'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-zinc-400 font-black text-[10px] tracking-widest bg-zinc-950/50 px-2 py-1 rounded-lg border border-white/5">
                          {player.pos}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center text-zinc-400 text-xs font-bold">
                        {player.year}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <button
                          onClick={() => handleToggleRedshirt(player)}
                          disabled={!userLeague}
                          className={`w-10 h-6 rounded-full transition-all relative mx-auto ${player.redshirt ? 'bg-orange-600' : 'bg-zinc-800'} ${!userLeague ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-orange-600/20'}`}
                          title={player.redshirt ? "Remove Redshirt" : "Set Redshirt"}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${player.redshirt ? 'left-5' : 'left-1'}`} />
                        </button>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black tracking-tighter ${
                          player.ovr >= 90 
                            ? 'bg-orange-600/20 text-orange-500 border border-orange-600/20 shadow-[0_0_15px_rgba(234,88,12,0.1)]' 
                            : 'bg-zinc-950/50 text-zinc-400 border border-white/5'
                        }`}>
                          {player.ovr}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center text-zinc-500 text-xs font-medium">{player.height} / {player.weight} lbs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'SCHEDULE' && (
        <motion.div
          key="schedule"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-8"
        >
          {schoolGames.length === 0 ? (
            <div className="text-center py-20 glass-card rounded-[2.5rem] border-dashed">
              <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto border border-white/5 mb-6">
                <Calendar className="text-zinc-700" size={32} />
              </div>
              <p className="text-white font-bold text-xl">No games scheduled</p>
              <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">Initialize the season on the Dashboard to generate a full schedule for this program.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schoolGames.map((game) => {
                const isHome = game.homeTeamId === leagueTeams.find(t => t.name === selectedSchool?.name)?.id;
                const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
                const opponent = allTeams.find(t => t.id === opponentId);
                
                return (
                  <div key={game.id} className="glass-card p-6 rounded-[2rem] group hover:-translate-y-1 transition-all">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2.5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        <div className="w-6 h-6 bg-zinc-950 rounded-lg flex items-center justify-center border border-white/5">
                          <Clock size={12} className="text-orange-600" />
                        </div>
                        Week {game.week}
                      </div>
                      {game.status === 'completed' && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${
                          (isHome && game.homeScore > game.awayScore) || (!isHome && game.awayScore > game.homeScore)
                            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          {isHome ? `${game.homeScore}-${game.awayScore}` : `${game.awayScore}-${game.homeScore}`}
                          {' '}
                          {(isHome && game.homeScore > game.awayScore) || (!isHome && game.awayScore > game.homeScore) ? 'W' : 'L'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-5">
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center p-3 border border-white/10 shadow-xl overflow-hidden bg-zinc-950 group-hover:border-orange-600/30 transition-colors"
                        style={{ backgroundColor: opponent?.color }}
                      >
                        {opponent?.logoId ? (
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${opponent.logoId}.png`} 
                            alt={opponent.name}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-white font-black text-2xl">{opponent?.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">{isHome ? 'vs' : '@'}</p>
                        <p className="text-white font-display font-bold text-xl leading-tight truncate group-hover:text-orange-600 transition-colors">{opponent?.name || 'Unknown Opponent'}</p>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1 truncate">{opponent?.conference}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'TEAM_STATS' && (
        <motion.div
          key="team_stats"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-10 rounded-[2.5rem]">
              <h3 className="text-2xl font-display font-bold text-white mb-10 flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
                  <BarChart3 className="text-orange-600" size={20} />
                </div>
                Team Season Stats
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {[
                  { label: 'Points Per Game', value: '34.5', rank: '24th', trend: '+2.1' },
                  { label: 'Yards Per Game', value: '450.2', rank: '18th', trend: '+15.4' },
                  { label: 'Passing Yards', value: '280.4', rank: '32nd', trend: '-5.2' },
                  { label: 'Rushing Yards', value: '169.8', rank: '45th', trend: '+20.6' },
                ].map((stat, i) => (
                  <div key={i} className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</span>
                      <span className="px-2 py-0.5 bg-orange-600/10 rounded text-[9px] font-black text-orange-600 uppercase tracking-widest border border-orange-600/20">
                        {stat.rank} NCAA
                      </span>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="text-4xl font-display font-black text-white tracking-tighter">{stat.value}</span>
                      <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full ${stat.trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {stat.trend}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '75%' }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="h-full bg-orange-600 shadow-[0_0_15px_rgba(234,88,12,0.4)]" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem] space-y-8">
              <h3 className="text-xl font-display font-bold text-white">Efficiency Ratings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: '3rd Down Conv.', value: '48.2%', rank: '12th' },
                  { label: 'Red Zone TD %', value: '72.5%', rank: '5th' },
                  { label: 'Turnover Margin', value: '+8', rank: '8th' },
                  { label: 'Penalty Yards', value: '42.1', rank: '15th' },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-orange-600/30 transition-all group">
                    <div>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                      <p className="text-white font-display font-bold text-2xl group-hover:text-orange-600 transition-colors">{stat.value}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest mb-1">NCAA Rank</p>
                      <p className="text-orange-600 font-display font-black text-xl tracking-tighter">{stat.rank}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'PLAYER_STATS' && (
        <motion.div
          key="player_stats"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          <div className="glass-card rounded-[2rem] p-8">
            <h3 className="text-xl font-display font-bold text-white mb-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
                <Trophy className="text-orange-600" size={20} />
              </div>
              Offensive Leaders
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Cade Klubnik', pos: 'QB', stat: '2,850 YDS', sub: '24 TD / 4 INT', img: 'CK' },
                { name: 'Phil Mafah', pos: 'RB', stat: '1,120 YDS', sub: '12 TD / 5.8 AVG', img: 'PM' },
                { name: 'Antonio Williams', pos: 'WR', stat: '840 YDS', sub: '8 TD / 62 REC', img: 'AW' },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-orange-600/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center text-[10px] font-black text-zinc-500 border border-white/5 group-hover:border-orange-600/30 transition-colors">
                      {p.img}
                    </div>
                    <div>
                      <p className="text-white font-bold group-hover:text-orange-600 transition-colors">{p.name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{p.pos}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-display font-black text-lg group-hover:text-orange-600 transition-colors">{p.stat}</p>
                    <p className="text-[10px] text-zinc-500 font-mono font-bold tracking-tighter">{p.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-8">
            <h3 className="text-xl font-display font-bold text-white mb-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
                <Shield className="text-orange-600" size={20} />
              </div>
              Defensive Leaders
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Barrett Carter', pos: 'LB', stat: '82 TKL', sub: '12.5 TFL / 4.5 SACK', img: 'BC' },
                { name: 'T.J. Parker', pos: 'DE', stat: '9.5 SACK', sub: '14 TFL / 2 FF', img: 'TP' },
                { name: 'Avieon Terrell', pos: 'CB', stat: '4 INT', sub: '12 PBU / 45 TKL', img: 'AT' },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-orange-600/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center text-[10px] font-black text-zinc-500 border border-white/5 group-hover:border-orange-600/30 transition-colors">
                      {p.img}
                    </div>
                    <div>
                      <p className="text-white font-bold group-hover:text-orange-600 transition-colors">{p.name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{p.pos}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-display font-black text-lg group-hover:text-orange-600 transition-colors">{p.stat}</p>
                    <p className="text-[10px] text-zinc-500 font-mono font-bold tracking-tighter">{p.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 glass-card rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="text-xl font-display font-bold text-white">Full Player Stats</h3>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Sort By:</span>
                <select className="bg-zinc-950 border border-white/5 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-600 transition-all">
                  <option>Yards</option>
                  <option>Touchdowns</option>
                  <option>Tackles</option>
                  <option>Sacks</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/30 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-b border-white/5">
                    <th className="px-8 py-5">Player</th>
                    <th className="px-8 py-5 text-center">POS</th>
                    <th className="px-8 py-5 text-center">GP</th>
                    <th className="px-8 py-5 text-center">YDS</th>
                    <th className="px-8 py-5 text-center">TD</th>
                    <th className="px-8 py-5 text-center">AVG</th>
                    <th className="px-8 py-5 text-center">RATING</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    { name: 'Cade Klubnik', pos: 'QB', gp: 12, yds: '2,850', td: 24, avg: '237.5', rating: 158.4 },
                    { name: 'Phil Mafah', pos: 'RB', gp: 12, yds: '1,120', td: 12, avg: '93.3', rating: 92 },
                    { name: 'Antonio Williams', pos: 'WR', gp: 11, yds: '840', td: 8, avg: '76.4', rating: 88 },
                    { name: 'Jake Briningstool', pos: 'TE', gp: 12, yds: '620', td: 6, avg: '51.7', rating: 85 },
                    { name: 'Tyler Brown', pos: 'WR', gp: 10, yds: '540', td: 4, avg: '54.0', rating: 82 },
                  ].map((p, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors group cursor-default">
                      <td className="px-8 py-5">
                        <p className="text-white font-bold group-hover:text-orange-600 transition-colors">{p.name}</p>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-zinc-400 font-black text-[10px] tracking-widest bg-zinc-950/50 px-2 py-1 rounded-lg border border-white/5">
                          {p.pos}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center text-zinc-400 text-xs font-bold">{p.gp}</td>
                      <td className="px-8 py-5 text-center text-white font-display font-black text-lg tracking-tighter">{p.yds}</td>
                      <td className="px-8 py-5 text-center text-white font-display font-black text-lg tracking-tighter">{p.td}</td>
                      <td className="px-8 py-5 text-center text-zinc-400 text-xs font-bold">{p.avg}</td>
                      <td className="px-8 py-5 text-center">
                        <span className="px-3 py-1 bg-zinc-950/50 text-zinc-300 rounded-lg text-xs font-black tracking-tighter border border-white/5">
                          {p.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="mt-12">
        <AnimatePresence>
          {isTrackModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsTrackModalOpen(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md glass-surface rounded-[2.5rem] shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-600/20">
                      <UserPlus className="text-orange-600" size={24} />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-white">Join Program</h3>
                  </div>
                  <button onClick={() => setIsTrackModalOpen(false)} className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-10 space-y-8">
                  {!user ? (
                    <div className="text-center space-y-6">
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
                        <AlertCircle className="text-zinc-500" size={40} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-white font-display font-bold text-xl">Authentication Required</p>
                        <p className="text-sm text-zinc-500 font-medium">Please log in to assign yourself to {selectedSchool.name}.</p>
                      </div>
                    </div>
                  ) : !userLeague ? (
                    <div className="text-center space-y-6">
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10">
                        <AlertCircle className="text-zinc-500" size={40} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-white font-display font-bold text-xl">No Dynasty Found</p>
                        <p className="text-sm text-zinc-500 font-medium">You need to initialize your dynasty on the Dashboard before you can assign coaches.</p>
                      </div>
                      <button 
                         onClick={() => window.location.href = '/'}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-orange-600/20"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  ) : saveSuccess ? (
                    <div className="text-center py-10 space-y-6">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20"
                      >
                        <CheckCircle2 className="text-green-500" size={48} />
                      </motion.div>
                      <div className="space-y-2">
                        <p className="text-white font-display font-bold text-2xl">Contract Signed!</p>
                        <p className="text-sm text-zinc-500 font-medium">You are now the {coachRole} of {selectedSchool.name}.</p>
                      </div>
                    </div>
                  ) : (existingCoach && !isCpuCoach && userLeague.seasonPhase === 'Regular Season') ? (
                    <div className="space-y-8">
                      <div className="p-8 bg-zinc-950/50 border border-white/5 rounded-[2rem] space-y-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-orange-600/10 rounded-2xl flex items-center justify-center border border-orange-600/20">
                            <Shield className="text-orange-600" size={28} />
                          </div>
                          <div>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Current Coach</p>
                            <p className="text-white font-display font-bold text-xl">{existingCoach.coachName}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-4 border-t border-white/5">
                          <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Role</span>
                          <span className="text-white font-mono font-bold text-sm bg-zinc-950 px-3 py-1 rounded-lg border border-white/5">{existingCoach.coachRole}</span>
                        </div>
                        <div className="p-5 bg-orange-600/5 border border-orange-600/10 rounded-2xl">
                          <p className="text-xs text-orange-600/80 leading-relaxed italic font-medium">
                            "The program is currently in the Regular Season. Coaching changes are locked until the CFP Window or Off Season."
                          </p>
                        </div>
                      </div>
                      <button 
                        disabled
                        className="w-full bg-white/5 text-zinc-600 font-bold py-5 rounded-2xl border border-white/5 cursor-not-allowed uppercase tracking-widest text-xs"
                      >
                        Season In Progress
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleAssignCoach} className="space-y-8">
                      {existingCoach && (
                        <div className="p-5 bg-orange-600/10 border border-orange-600/20 rounded-2xl flex items-center gap-4">
                          <AlertCircle className="text-orange-600 shrink-0" size={20} />
                          <p className="text-xs text-orange-600 font-bold leading-tight">
                            This will replace the current coach ({existingCoach.coachName}) during the {userLeague.seasonPhase}.
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-5 p-6 bg-white/5 rounded-[2rem] border border-white/5">
                        <div 
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl border border-white/10 overflow-hidden bg-zinc-950"
                          style={{ 
                            backgroundColor: !logoUrl ? selectedSchool.color : undefined,
                            backgroundImage: !logoUrl && selectedSchool.secondaryColor ? `linear-gradient(135deg, ${selectedSchool.color}, ${selectedSchool.secondaryColor})` : 'none'
                          }}
                        >
                          {logoUrl ? (
                            <img src={logoUrl} alt={selectedSchool.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                          ) : (
                            selectedSchool.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="text-white font-display font-bold text-xl leading-tight">{selectedSchool.name}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black mt-1">{selectedSchool.conference}</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Coach Name</label>
                          <input 
                            type="text" 
                            value={coachName}
                            onChange={(e) => setCoachName(e.target.value)}
                            placeholder="Enter your coach name"
                            className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all placeholder:text-zinc-700"
                            required
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Coaching Role</label>
                          <div className="grid grid-cols-3 gap-3">
                            {(['HC', 'OC', 'DC'] as const).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => setCoachRole(role)}
                                className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                  coachRole === role 
                                    ? 'bg-orange-600 border-orange-500 text-white shadow-xl shadow-orange-600/20' 
                                    : 'bg-zinc-950 border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-zinc-950/50 border border-white/5 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Current Phase: {userLeague.seasonPhase}</p>
                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                          Coaching assignments are currently <span className="text-green-500 font-bold">OPEN</span>. Changes made now will be effective immediately for the upcoming season.
                        </p>
                      </div>

                      {error && (
                        <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500 text-xs font-bold">
                          <AlertCircle size={18} className="shrink-0" />
                          {error}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-orange-600/30 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] uppercase tracking-[0.2em] text-xs"
                      >
                        {isSaving ? (
                          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Shield size={20} />
                            Sign Contract
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAddPlayerModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddPlayerModalOpen(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full h-[90vh] sm:h-auto sm:max-w-2xl glass-surface rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-600/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-orange-600/20">
                      <UserPlus className="text-orange-600" size={20} />
                    </div>
                    <h3 className="text-lg sm:text-2xl font-display font-bold text-white">Add Player</h3>
                  </div>
                  <button onClick={() => setIsAddPlayerModalOpen(false)} className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all active:scale-90">
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6 sm:p-10 overflow-y-auto flex-1 no-scrollbar">
                  {saveSuccess ? (
                    <div className="text-center py-10 sm:py-20 space-y-6">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20"
                      >
                        <CheckCircle2 className="text-green-500" size={40} />
                      </motion.div>
                      <div className="space-y-2">
                        <p className="text-white font-display font-bold text-xl sm:text-2xl">Player Added!</p>
                        <p className="text-sm text-zinc-500 font-medium">{newPlayer.name} has been added to the roster.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleAddPlayer} className="space-y-6 sm:space-y-8 pb-10 sm:pb-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <UserIcon size={12} className="text-orange-600" />
                            Player Name
                          </label>
                          <input 
                            type="text" 
                            value={newPlayer.name}
                            onChange={(e) => setNewPlayer(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter player name"
                            className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all placeholder:text-zinc-700 text-base"
                            required
                          />
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Hash size={12} className="text-orange-600" />
                            Jersey Number
                          </label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            min="0"
                            max="99"
                            value={isNaN(newPlayer.number) ? '' : newPlayer.number}
                            onChange={(e) => {
                              const val = e.target.value === '' ? NaN : parseInt(e.target.value);
                              setNewPlayer(prev => ({ ...prev, number: val }));
                            }}
                            className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all text-base"
                            required
                          />
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Target size={12} className="text-orange-600" />
                            Position
                          </label>
                          <div className="relative">
                            <select 
                              value={newPlayer.pos}
                              onChange={(e) => setNewPlayer(prev => ({ ...prev, pos: e.target.value }))}
                              className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all appearance-none text-base"
                            >
                              {['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                              ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Zap size={12} className="text-orange-600" />
                            Archetype
                          </label>
                          <div className="relative">
                            <select 
                              value={newPlayer.archetype}
                              onChange={(e) => setNewPlayer(prev => ({ ...prev, archetype: e.target.value }))}
                              className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all appearance-none text-base"
                            >
                              {['Balanced', 'Speed', 'Power', 'Field General', 'Scrambler', 'Deep Threat', 'Route Runner', 'Vertical Threat', 'Blocking', 'Run Stopper', 'Pass Rusher', 'Zone', 'Man to Man'].map(arch => (
                                <option key={arch} value={arch}>{arch}</option>
                              ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Ruler size={12} className="text-orange-600" />
                            Height
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                              <input 
                                type="number" 
                                inputMode="numeric"
                                min="4"
                                max="7"
                                value={isNaN(newPlayer.heightFeet) ? '' : newPlayer.heightFeet}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? NaN : parseInt(e.target.value);
                                  setNewPlayer(prev => ({ ...prev, heightFeet: val }));
                                }}
                                className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all text-base pr-10"
                                required
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">FT</span>
                            </div>
                            <div className="relative">
                              <input 
                                type="number" 
                                inputMode="numeric"
                                min="0"
                                max="11"
                                value={isNaN(newPlayer.heightInches) ? '' : newPlayer.heightInches}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? NaN : parseInt(e.target.value);
                                  setNewPlayer(prev => ({ ...prev, heightInches: val }));
                                }}
                                className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all text-base pr-10"
                                required
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">IN</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Weight size={12} className="text-orange-600" />
                            Weight (lbs)
                          </label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            value={isNaN(newPlayer.weight) ? '' : newPlayer.weight}
                            onChange={(e) => {
                              const val = e.target.value === '' ? NaN : parseInt(e.target.value);
                              setNewPlayer(prev => ({ ...prev, weight: val }));
                            }}
                            className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all text-base"
                            required
                          />
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Calendar size={12} className="text-orange-600" />
                            Year
                          </label>
                          <div className="relative">
                            <select 
                              value={newPlayer.year}
                              onChange={(e) => setNewPlayer(prev => ({ ...prev, year: e.target.value as any }))}
                              className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all appearance-none text-base"
                            >
                              {['Freshman', 'Sophomore', 'Junior', 'Senior'].map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <label className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                            <Shield size={12} className="text-orange-600" />
                            Overall Rating
                          </label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            min="40"
                            max="99"
                            value={isNaN(newPlayer.ovr) ? '' : newPlayer.ovr}
                            onChange={(e) => {
                              const val = e.target.value === '' ? NaN : parseInt(e.target.value);
                              setNewPlayer(prev => ({ ...prev, ovr: val }));
                            }}
                            className="w-full bg-zinc-950 border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 py-4 sm:py-4 text-white font-bold focus:outline-none focus:border-orange-600 transition-all text-base"
                            required
                          />
                        </div>

                        <div className="flex items-center gap-4 p-5 sm:p-6 bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 md:col-span-2">
                          <div className="flex-1">
                            <p className="text-white font-bold text-sm">Redshirt Status</p>
                            <p className="text-[10px] text-zinc-500 font-medium">Toggle if the player is currently redshirting</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewPlayer(prev => ({ ...prev, redshirt: !prev.redshirt }))}
                            className={`w-12 h-7 sm:w-14 sm:h-8 rounded-full transition-all relative ${newPlayer.redshirt ? 'bg-orange-600' : 'bg-zinc-800'}`}
                          >
                            <div className={`absolute top-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white transition-all ${newPlayer.redshirt ? 'left-6 sm:left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="p-4 sm:p-5 bg-red-500/10 border border-red-500/20 rounded-xl sm:rounded-2xl flex items-center gap-4 text-red-500 text-[10px] sm:text-xs font-bold">
                          <AlertCircle size={16} className="shrink-0" />
                          {error}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 sm:py-5 rounded-xl sm:rounded-2xl transition-all shadow-2xl shadow-orange-600/30 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] uppercase tracking-[0.2em] text-[10px] sm:text-xs"
                      >
                        {isSaving ? (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <UserPlus size={18} />
                            Add to Roster
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

  return (
    <div className="space-y-8 sm:space-y-12 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-orange-600 font-black text-xs uppercase tracking-[0.4em]"
          >
            <div className="w-8 h-[1px] bg-orange-600" />
            Dynasty Programs
          </motion.div>
          <h1 className="text-4xl sm:text-6xl font-display font-black text-white tracking-tighter">
            COLLEGE <span className="text-orange-600">FOOTBALL</span>
          </h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="relative group w-full sm:w-72">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search size={18} className="text-zinc-500 group-focus-within:text-orange-600 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search programs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-surface pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-600/20 transition-all border border-white/5 focus:border-orange-600/30"
            />
          </div>
          
          <div className="flex items-center gap-1.5 glass-surface p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'compact' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
              title="Compact View"
            >
              <Grid2x2 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
              title="List View"
            >
              <List size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-1.5 glass-surface p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
            {conferences.map((conf) => (
              <button
                key={conf}
                onClick={() => setSelectedConference(conf)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  selectedConference === conf 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                {conf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schools Grid */}
      <div className={`grid gap-4 sm:gap-6 ${
        viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
        viewMode === 'compact' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' :
        'grid-cols-1'
      }`}>
        <AnimatePresence mode="popLayout">
          {filteredSchools.map((school) => {
            const logoUrl = getLogoUrl(school);
            const coach = schoolCoaches[school.name];
            
            return (
              <motion.div
                key={school.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: viewMode === 'list' ? 0 : -8, x: viewMode === 'list' ? 8 : 0 }}
                onClick={() => setSelectedSchool(school)}
                className={`glass-card glass-glow group cursor-pointer overflow-hidden relative border border-white/5 hover:border-orange-600/30 transition-all duration-300 ${
                  viewMode === 'grid' ? 'rounded-3xl sm:rounded-[2.5rem]' :
                  viewMode === 'compact' ? 'rounded-2xl sm:rounded-3xl' :
                  'rounded-2xl flex items-center'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-transparent to-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {viewMode === 'list' ? (
                  <div className="p-4 sm:p-5 flex items-center justify-between w-full relative z-10 gap-4 sm:gap-6">
                    <div className="flex items-center gap-4 sm:gap-6 flex-1">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 glass-surface rounded-xl p-2 flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-110 transition-transform duration-500">
                        {logoUrl ? (
                          <img src={logoUrl} alt={school.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <SchoolIcon size={24} className="text-orange-600" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-base sm:text-lg font-display font-black text-white tracking-tight group-hover:text-orange-500 transition-colors">
                          {school.name.toUpperCase()}
                        </h3>
                        <p className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                          {school.conference} Conference
                        </p>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-4 flex-1 justify-center">
                      <div className="w-8 h-8 rounded-lg glass-surface flex items-center justify-center border border-white/10">
                        <Users size={14} className="text-zinc-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Head Coach</span>
                        <span className={`text-xs font-bold ${coach?.isUser ? 'text-orange-500' : 'text-white'}`}>
                          {coach ? coach.name : 'Vacant'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-8">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-orange-600 uppercase tracking-[0.2em]">Rank</span>
                        <span className="text-base sm:text-lg font-display font-black text-white">#4</span>
                      </div>
                      <ChevronRight size={18} className="text-zinc-600 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ) : (
                  <div className={`${viewMode === 'compact' ? 'p-4 sm:p-5 space-y-4' : 'p-8 space-y-6'} relative z-10`}>
                    <div className="flex items-start justify-between">
                      <div className={`${viewMode === 'compact' ? 'w-12 h-12 sm:w-14 sm:h-14 p-2 rounded-xl' : 'w-20 h-20 p-3 rounded-2xl'} glass-surface flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500`}>
                        {logoUrl ? (
                          <img src={logoUrl} alt={school.name} className="w-full h-full object-contain drop-shadow-xl" referrerPolicy="no-referrer" />
                        ) : (
                          <SchoolIcon size={viewMode === 'compact' ? 24 : 32} className="text-orange-600" />
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[8px] sm:text-[10px] font-black text-orange-600 uppercase tracking-[0.2em]">Rank</span>
                        <span className={`${viewMode === 'compact' ? 'text-lg' : 'text-2xl'} font-display font-black text-white`}>#4</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className={`${viewMode === 'compact' ? 'text-sm sm:text-base' : 'text-2xl'} font-display font-black text-white tracking-tight group-hover:text-orange-500 transition-colors line-clamp-1`}>
                        {school.name.toUpperCase()}
                      </h3>
                      <p className="text-[8px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {school.conference}
                      </p>
                    </div>

                    <div className={`${viewMode === 'compact' ? 'pt-4' : 'pt-6'} border-t border-white/5 flex items-center justify-between`}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`${viewMode === 'compact' ? 'w-6 h-6' : 'w-8 h-8'} rounded-lg glass-surface flex items-center justify-center border border-white/10`}>
                          <Users size={viewMode === 'compact' ? 12 : 14} className="text-zinc-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] sm:text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Coach</span>
                          <span className={`text-[9px] sm:text-xs font-bold line-clamp-1 ${coach?.isUser ? 'text-orange-500' : 'text-white'}`}>
                            {coach ? coach.name : 'Vacant'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-600 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredSchools.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
            <Search className="text-zinc-700" size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-white font-bold text-xl">No schools found</p>
            <p className="text-zinc-500">Try adjusting your search or conference filter.</p>
          </div>
          <button 
            onClick={() => { setSearchQuery(''); setSelectedConference('All'); }}
            className="text-orange-600 font-bold text-sm hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
};
