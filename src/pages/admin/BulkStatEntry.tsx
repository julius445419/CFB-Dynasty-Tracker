import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Save, 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Table as TableIcon,
  Sword,
  ShieldAlert,
  Zap,
  Target,
  RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { TeamAssignment, TeamSeasonStats } from '../../types';

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

type StatTab = 'offense' | 'defense' | 'conversions' | 'redzone' | 'turnovers';

interface LedgerRow {
  teamId: string;
  name: string;
  stats: Partial<TeamSeasonStats>;
}

export const BulkStatEntry: React.FC = () => {
  const navigate = useNavigate();
  const { currentLeagueId, leagueInfo } = useLeague();
  const [activeTab, setActiveTab] = useState<StatTab>('offense');
  const [selectedConference, setSelectedConference] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [ledger, setLedger] = useState<Record<string, Partial<TeamSeasonStats>>>({});

  const seasonYear = leagueInfo?.currentYear || 2025;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!currentLeagueId) return;
      setLoading(true);
      try {
        // 1. Fetch all teams in league
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamAssignment));
        setTeams(teamsData);

        // 2. Fetch existing stats for current season
        const statsRef = collection(db, 'leagues', currentLeagueId, 'team_stats');
        const q = query(statsRef, where('seasonYear', '==', seasonYear));
        const statsSnap = await getDocs(q);
        
        const statsMap: Record<string, Partial<TeamSeasonStats>> = {};
        statsSnap.docs.forEach(doc => {
          const data = doc.data() as TeamSeasonStats;
          statsMap[data.teamId] = data;
        });

        // Initialize ledger for all teams
        const initialLedger: Record<string, Partial<TeamSeasonStats>> = {};
        teamsData.forEach(team => {
          initialLedger[team.id] = statsMap[team.id] || {
            teamId: team.id,
            seasonYear,
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
            defSacks: 0,
            totalOffense: 0,
            totalDefense: 0,
            ypp: 0,
            defYppAllowed: 0,
            thirdDownMade: 0,
            thirdDownAtt: 0,
            fourthDownConversions: 0,
            fourthDownAttempts: 0,
            twoPointConversions: 0,
            twoPointAttempts: 0,
            redZoneAttempts: 0,
            redZoneTds: 0,
            redZoneFgs: 0,
            defRedZoneAttemptsAllowed: 0,
            defRedZoneTdsAllowed: 0,
            defRedZoneFgsAllowed: 0,
            turnovers: 0,
            takeaways: 0,
            turnoverMargin: 0
          };
        });
        setLedger(initialLedger);

      } catch (error) {
        console.error('Error fetching ledger data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentLeagueId, seasonYear]);

  const conferences = useMemo(() => {
    const confs = Array.from(new Set(teams.map(t => t.conference))).sort();
    return ['All', ...confs];
  }, [teams]);

  const filteredTeams = useMemo(() => {
    let result = teams;
    if (selectedConference !== 'All') {
      result = result.filter(t => t.conference === selectedConference);
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, selectedConference]);

  const handleInputChange = (teamId: string, field: keyof TeamSeasonStats, value: string) => {
    const numVal = (field === 'ypp' || field === 'defYppAllowed') ? parseFloat(value) || 0 : parseInt(value) || 0;
    
    setLedger(prev => {
      const currentStats = prev[teamId] || {};
      const updatedStats = { ...currentStats, [field]: numVal };

      // Auto-calculation for Turnovers
      if (['intsThrown', 'fumblesLost', 'defIntsCaught', 'defFumblesRecovered', 'gamesPlayed'].includes(field)) {
        const give = (Number(updatedStats.intsThrown) || 0) + (Number(updatedStats.fumblesLost) || 0);
        const take = (Number(updatedStats.defIntsCaught) || 0) + (Number(updatedStats.defFumblesRecovered) || 0);
        const gp = Number(updatedStats.gamesPlayed) || 1;
        const safeGp = gp === 0 ? 1 : gp;
        const margin = take - give;
        
        updatedStats.turnovers = give;
        updatedStats.takeaways = take;
        updatedStats.turnoverMargin = margin;
        updatedStats.turnoverMarginPg = Math.round((margin / safeGp) * 10) / 10;
      }

      // Auto-calculation for Efficiency
      if (['thirdDownMade', 'thirdDownAtt', 'fourthDownConversions', 'fourthDownAttempts', 'redZoneAttempts', 'redZoneTds', 'defRedZoneAttemptsAllowed', 'defRedZoneTdsAllowed'].includes(field)) {
        const round = (val: number) => Math.round(val * 10) / 10;
        
        if (['thirdDownMade', 'thirdDownAtt'].includes(field)) {
          const att = Number(updatedStats.thirdDownAtt) || 0;
          updatedStats.thirdDownPct = att > 0 ? round((Number(updatedStats.thirdDownMade || 0) / att) * 100) : 0;
        }
        if (['fourthDownConversions', 'fourthDownAttempts'].includes(field)) {
          const att = Number(updatedStats.fourthDownAttempts) || 0;
          updatedStats.fourthDownPct = att > 0 ? round((Number(updatedStats.fourthDownConversions || 0) / att) * 100) : 0;
        }
        if (['redZoneAttempts', 'redZoneTds'].includes(field)) {
          const att = Number(updatedStats.redZoneAttempts) || 0;
          updatedStats.redZoneTdPct = att > 0 ? round((Number(updatedStats.redZoneTds || 0) / att) * 100) : 0;
        }
        if (['defRedZoneAttemptsAllowed', 'defRedZoneTdsAllowed'].includes(field)) {
          const att = Number(updatedStats.defRedZoneAttemptsAllowed) || 0;
          updatedStats.defRedZoneTdPctAllowed = att > 0 ? round((Number(updatedStats.defRedZoneTdsAllowed || 0) / att) * 100) : 0;
        }
      }

      return {
        ...prev,
        [teamId]: updatedStats
      };
    });
  };

  const calculateAverages = (stats: Partial<TeamSeasonStats>): Partial<TeamSeasonStats> => {
    const gp = stats.gamesPlayed || 1;
    const safeGp = gp === 0 ? 1 : gp;

    // Offense
    const pYds = Number(stats.passYards || 0);
    const rYds = Number(stats.rushYards || 0);
    const tOff = Number(stats.totalOffense || (pYds + rYds));
    
    // Defense
    const dpYds = Number(stats.defPassYards || 0);
    const drYds = Number(stats.defRushYards || 0);
    const tDef = Number(stats.totalDefense || (dpYds + drYds));

    // Turnovers
    const give = (Number(stats.intsThrown) || 0) + (Number(stats.fumblesLost) || 0);
    const take = (Number(stats.defIntsCaught) || 0) + (Number(stats.defFumblesRecovered) || 0);
    const margin = take - give;

    const round = (val: number) => Math.round(val * 10) / 10;

    return {
      ...stats,
      // Offensive Averages
      ppg: round(Number(stats.pointsScored || 0) / safeGp),
      passYpg: round(pYds / safeGp),
      rushYpg: round(rYds / safeGp),
      totalOffYpg: round(tOff / safeGp),
      compPct: round((Number(stats.passComps || 0) / (Number(stats.passAttempts || 1))) * 100),
      rushYpc: round(Number(stats.rushYards || 0) / (Number(stats.rushAttempts || 1))),
      
      // Defensive Averages
      papg: round(Number(stats.pointsAllowed || 0) / safeGp),
      defPassYpgAllowed: round(dpYds / safeGp),
      defRushYpgAllowed: round(drYds / safeGp),
      defTotalYpgAllowed: round(tDef / safeGp),

      // Efficiency Calculations
      thirdDownPct: Number(stats.thirdDownAtt || 0) > 0 
        ? round((Number(stats.thirdDownMade || 0) / Number(stats.thirdDownAtt)) * 100) 
        : 0,
      fourthDownPct: Number(stats.fourthDownAttempts || 0) > 0 
        ? round((Number(stats.fourthDownConversions || 0) / Number(stats.fourthDownAttempts)) * 100) 
        : 0,
      redZoneTdPct: Number(stats.redZoneAttempts || 0) > 0 
        ? round((Number(stats.redZoneTds || 0) / Number(stats.redZoneAttempts)) * 100) 
        : 0,
      defRedZoneTdPctAllowed: Number(stats.defRedZoneAttemptsAllowed || 0) > 0 
        ? round((Number(stats.defRedZoneTdsAllowed || 0) / Number(stats.defRedZoneAttemptsAllowed)) * 100) 
        : 0,

      // Turnover Logic
      turnovers: give,
      takeaways: take,
      turnoverMargin: margin,
      turnoverMarginPg: round(margin / safeGp),
      
      updatedAt: serverTimestamp()
    };
  };

  const handleSave = async () => {
    if (!currentLeagueId) return;
    setSaving(true);
    setSaveStatus({ type: 'idle', message: 'Saving conference stats...' });

    try {
      const batch = writeBatch(db);
      
      // Only save teams currently in the filtered view to avoid massive batches if "All" is selected
      // Actually, the requirement says "Save Conference Stats", so we save the filtered list.
      for (const team of filteredTeams) {
        const stats = ledger[team.id];
        if (!stats) continue;

        const updatedStats = calculateAverages(stats);
        const docId = `${team.id}_${seasonYear}`;
        const docRef = doc(db, 'leagues', currentLeagueId, 'team_stats', docId);
        
        batch.set(docRef, {
          ...updatedStats,
          teamId: team.id,
          seasonYear,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      setSaveStatus({ type: 'success', message: `Successfully updated stats for ${filteredTeams.length} teams.` });
      
      // Clear status after 3 seconds
      setTimeout(() => setSaveStatus({ type: 'idle', message: '' }), 3000);
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `leagues/${currentLeagueId}/team_stats`);
      } catch (err: any) {
        setSaveStatus({ type: 'error', message: `Permission Denied: You must be a Commissioner or Owner to save stats.` });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-24 max-w-[1600px] mx-auto">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-2 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Admin
            </button>
            <h1 className="text-3xl font-black text-white flex items-center gap-3 italic uppercase tracking-tighter">
              <Database className="w-8 h-8 text-orange-600" />
              Master <span className="text-orange-600">Ledger</span>
            </h1>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Manual Season Total Overrides • {seasonYear}</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full md:w-auto px-8 py-4 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-500 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] disabled:opacity-50 shadow-xl shadow-orange-900/20 z-30"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save {selectedConference === 'All' ? 'All' : selectedConference} Stats
          </button>
        </div>

        <div className="relative group">
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl overflow-x-auto no-scrollbar flex-nowrap">
            <button
              onClick={() => setActiveTab('offense')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'offense' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Sword size={12} />
              Offense
            </button>
            <button
              onClick={() => setActiveTab('defense')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'defense' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Shield size={12} />
              Defense
            </button>
            <button
              onClick={() => setActiveTab('conversions')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'conversions' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Zap size={12} />
              Conversions
            </button>
            <button
              onClick={() => setActiveTab('redzone')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'redzone' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Target size={12} />
              Redzone
            </button>
            <button
              onClick={() => setActiveTab('turnovers')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'turnovers' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ShieldAlert size={12} />
              Turnovers
            </button>
          </div>
          {/* Fade indicator for horizontal scroll */}
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none rounded-r-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </header>

      {/* Filters: Pill Selection */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">Conference Filter</label>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1">
            {conferences.map(conf => (
              <button
                key={conf}
                onClick={() => setSelectedConference(conf)}
                className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                  selectedConference === conf
                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-900/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                {conf}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {saveStatus.type !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider ${
                saveStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
              }`}
            >
              {saveStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {saveStatus.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Spreadsheet Grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[40px] overflow-hidden shadow-2xl">
        <div className="overflow-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-30">
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="sticky top-0 left-0 z-40 bg-zinc-950 px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest min-w-[140px] max-w-[30vw] md:min-w-[240px] border-r border-zinc-800">
                  Team & GP
                </th>
                {activeTab === 'offense' && (
                  <>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">PTS</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">OFF</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">YPP</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">PASS</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">PTD</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">RUSH</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">RTD</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">FDS</th>
                  </>
                )}
                {activeTab === 'defense' && (
                  <>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">PTS</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">OFF</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">YPP</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">PASS</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">RUSH</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">SACK</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">FUM</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">INT</th>
                  </>
                )}
                {activeTab === 'conversions' && (
                  <>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">3DC</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">3DA</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">4DC</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">4DA</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">2PC</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">2PA</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">3D%</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">4D%</th>
                  </>
                )}
                {activeTab === 'redzone' && (
                  <>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">ATT</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">TD</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">FG</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">DATT</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">DTD</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">DFG</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">RZ TD%</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">DRZ TD%</th>
                  </>
                )}
                {activeTab === 'turnovers' && (
                  <>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">INT</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">FUM LOST</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">GIVE</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">D INT</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">FUM REC</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">TAKE</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">DIFF</th>
                    <th className="sticky top-0 z-30 px-4 py-4 text-[10px] font-black text-orange-500 uppercase tracking-widest text-center min-w-[100px] bg-zinc-950">DIFF/G</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredTeams.map((team) => {
                const stats = ledger[team.id] || {};
                return (
                  <tr key={team.id} className="hover:bg-zinc-800/30 transition-colors group h-16 md:h-20">
                    <td className="sticky left-0 z-10 bg-zinc-950 px-6 py-4 border-r border-zinc-800 max-w-[30vw] md:max-w-none">
                      <div className="flex items-center justify-between gap-2 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex-shrink-0 flex items-center justify-center border border-zinc-800 hidden sm:flex">
                            <span className="text-[10px] font-black text-zinc-500">{team.name.substring(0, 2).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white uppercase italic tracking-tight truncate">{team.name}</p>
                            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest truncate">{team.conference}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">GP</p>
                          <p className="text-xs font-black text-orange-500">{stats.gamesPlayed || 0}</p>
                        </div>
                      </div>
                    </td>

                    {activeTab === 'offense' && (
                      <>
                        <LedgerInput 
                          value={stats.pointsScored} 
                          onChange={(val) => handleInputChange(team.id, 'pointsScored', val)} 
                        />
                        <LedgerInput 
                          value={stats.totalOffense} 
                          onChange={(val) => handleInputChange(team.id, 'totalOffense', val)} 
                        />
                        <LedgerInput 
                          value={stats.ypp} 
                          onChange={(val) => handleInputChange(team.id, 'ypp', val)}
                          step="0.1"
                        />
                        <LedgerInput 
                          value={stats.passYards} 
                          onChange={(val) => handleInputChange(team.id, 'passYards', val)} 
                        />
                        <LedgerInput 
                          value={stats.passTds} 
                          onChange={(val) => handleInputChange(team.id, 'passTds', val)} 
                        />
                        <LedgerInput 
                          value={stats.rushYards} 
                          onChange={(val) => handleInputChange(team.id, 'rushYards', val)} 
                        />
                        <LedgerInput 
                          value={stats.rushTds} 
                          onChange={(val) => handleInputChange(team.id, 'rushTds', val)} 
                        />
                        <LedgerInput 
                          value={stats.firstDowns} 
                          onChange={(val) => handleInputChange(team.id, 'firstDowns', val)} 
                        />
                      </>
                    )}
                    {activeTab === 'defense' && (
                      <>
                        <LedgerInput 
                          value={stats.pointsAllowed} 
                          onChange={(val) => handleInputChange(team.id, 'pointsAllowed', val)} 
                        />
                        <LedgerInput 
                          value={stats.totalDefense} 
                          onChange={(val) => handleInputChange(team.id, 'totalDefense', val)} 
                        />
                        <LedgerInput 
                          value={stats.defYppAllowed} 
                          onChange={(val) => handleInputChange(team.id, 'defYppAllowed', val)}
                          step="0.1"
                        />
                        <LedgerInput 
                          value={stats.defPassYards} 
                          onChange={(val) => handleInputChange(team.id, 'defPassYards', val)} 
                        />
                        <LedgerInput 
                          value={stats.defRushYards} 
                          onChange={(val) => handleInputChange(team.id, 'defRushYards', val)} 
                        />
                        <LedgerInput 
                          value={stats.defSacks} 
                          onChange={(val) => handleInputChange(team.id, 'defSacks', val)} 
                        />
                        <LedgerInput 
                          value={stats.defFumblesRecovered} 
                          onChange={(val) => handleInputChange(team.id, 'defFumblesRecovered', val)} 
                        />
                        <LedgerInput 
                          value={stats.defIntsCaught} 
                          onChange={(val) => handleInputChange(team.id, 'defIntsCaught', val)} 
                        />
                      </>
                    )}
                    {activeTab === 'conversions' && (
                      <>
                        <LedgerInput value={stats.thirdDownMade} onChange={(val) => handleInputChange(team.id, 'thirdDownMade', val)} />
                        <LedgerInput value={stats.thirdDownAtt} onChange={(val) => handleInputChange(team.id, 'thirdDownAtt', val)} />
                        <LedgerInput value={stats.fourthDownConversions} onChange={(val) => handleInputChange(team.id, 'fourthDownConversions', val)} />
                        <LedgerInput value={stats.fourthDownAttempts} onChange={(val) => handleInputChange(team.id, 'fourthDownAttempts', val)} />
                        <LedgerInput value={stats.twoPointConversions} onChange={(val) => handleInputChange(team.id, 'twoPointConversions', val)} />
                        <LedgerInput value={stats.twoPointAttempts} onChange={(val) => handleInputChange(team.id, 'twoPointAttempts', val)} />
                        <LedgerInput value={stats.thirdDownPct} onChange={() => {}} readOnly step="0.1" />
                        <LedgerInput value={stats.fourthDownPct} onChange={() => {}} readOnly step="0.1" />
                      </>
                    )}
                    {activeTab === 'redzone' && (
                      <>
                        <LedgerInput value={stats.redZoneAttempts} onChange={(val) => handleInputChange(team.id, 'redZoneAttempts', val)} />
                        <LedgerInput value={stats.redZoneTds} onChange={(val) => handleInputChange(team.id, 'redZoneTds', val)} />
                        <LedgerInput value={stats.redZoneFgs} onChange={(val) => handleInputChange(team.id, 'redZoneFgs', val)} />
                        <LedgerInput value={stats.defRedZoneAttemptsAllowed} onChange={(val) => handleInputChange(team.id, 'defRedZoneAttemptsAllowed', val)} />
                        <LedgerInput value={stats.defRedZoneTdsAllowed} onChange={(val) => handleInputChange(team.id, 'defRedZoneTdsAllowed', val)} />
                        <LedgerInput value={stats.defRedZoneFgsAllowed} onChange={(val) => handleInputChange(team.id, 'defRedZoneFgsAllowed', val)} />
                        <LedgerInput value={stats.redZoneTdPct} onChange={() => {}} readOnly step="0.1" />
                        <LedgerInput value={stats.defRedZoneTdPctAllowed} onChange={() => {}} readOnly step="0.1" />
                      </>
                    )}
                    {activeTab === 'turnovers' && (
                      <>
                        <LedgerInput value={stats.intsThrown} onChange={(val) => handleInputChange(team.id, 'intsThrown', val)} />
                        <LedgerInput value={stats.fumblesLost} onChange={(val) => handleInputChange(team.id, 'fumblesLost', val)} />
                        <LedgerInput value={stats.turnovers} onChange={() => {}} readOnly />
                        <LedgerInput value={stats.defIntsCaught} onChange={(val) => handleInputChange(team.id, 'defIntsCaught', val)} />
                        <LedgerInput value={stats.defFumblesRecovered} onChange={(val) => handleInputChange(team.id, 'defFumblesRecovered', val)} />
                        <LedgerInput value={stats.takeaways} onChange={() => {}} readOnly />
                        <LedgerInput value={stats.turnoverMargin} onChange={() => {}} readOnly />
                        <LedgerInput value={stats.turnoverMarginPg} onChange={() => {}} readOnly step="0.1" />
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface LedgerInputProps {
  value: any;
  onChange: (val: string) => void;
  step?: string;
  readOnly?: boolean;
}

const LedgerInput: React.FC<LedgerInputProps> = ({ value, onChange, step = "1", readOnly = false }) => (
  <td className="p-0">
    <input
      type="number"
      step={step}
      value={value || 0}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className={`w-full h-full min-h-[64px] bg-transparent text-center text-sm font-mono font-bold outline-none transition-all border-none ${
        readOnly ? 'text-orange-500 bg-zinc-900/20' : 'text-zinc-400 focus:text-white focus:bg-zinc-800/50'
      }`}
    />
  </td>
);
