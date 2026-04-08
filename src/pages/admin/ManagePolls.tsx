import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  ChevronRight, 
  Search, 
  Save, 
  Copy, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  setDoc,
  doc,
  writeBatch, 
  serverTimestamp,
  orderBy,
  limit,
  documentId
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { TeamAssignment, Poll, PollRanking } from '../../types';

export const ManagePolls: React.FC = () => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const navigate = useNavigate();
  
  const [week, setWeek] = useState<number>(leagueInfo?.currentWeek || 0);
  const [pollType, setPollType] = useState<'Media' | 'Coaches' | 'CFP'>('Media');
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [rankings, setRankings] = useState<{ teamId: string, rank: number }[]>(
    Array.from({ length: 25 }, (_, i) => ({ teamId: '', rank: i + 1 }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  useEffect(() => {
    const fetchTeams = async () => {
      if (!currentLeagueId) return;
      try {
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const snap = await getDocs(teamsRef);
        const teamsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamAssignment));
        setTeams(teamsData.sort((a, b) => a.name.localeCompare(b.name)));
        
        // Try to fetch existing poll for this week/type
        const pollsRef = collection(db, 'polls');
        const q = query(
          pollsRef, 
          where('leagueId', '==', currentLeagueId),
          where('week', '==', week),
          where('pollType', '==', pollType),
          where('seasonYear', '==', leagueInfo?.currentYear || 2025)
        );
        const pollSnap = await getDocs(q);
        if (!pollSnap.empty) {
          const pollData = pollSnap.docs[0].data() as Poll;
          const newRankings = Array.from({ length: 25 }, (_, i) => {
            const r = pollData.rankings.find(rank => rank.rank === i + 1);
            return { teamId: r?.teamId || '', rank: i + 1 };
          });
          setRankings(newRankings);
        } else {
          // Reset if no poll found
          setRankings(Array.from({ length: 25 }, (_, i) => ({ teamId: '', rank: i + 1 })));
        }
      } catch (error) {
        console.error("Error fetching teams/polls:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, [currentLeagueId, week, pollType, leagueInfo?.currentYear]);

  const handleCopyLastWeek = async () => {
    if (!currentLeagueId || week === 0) return;
    
    try {
      const pollsRef = collection(db, 'polls');
      const q = query(
        pollsRef, 
        where('leagueId', '==', currentLeagueId),
        where('week', '==', week - 1),
        where('pollType', '==', pollType),
        where('seasonYear', '==', leagueInfo?.currentYear || 2025)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const lastWeekPoll = snap.docs[0].data() as Poll;
        const newRankings = Array.from({ length: 25 }, (_, i) => {
          const r = lastWeekPoll.rankings.find(rank => rank.rank === i + 1);
          return { teamId: r?.teamId || '', rank: i + 1 };
        });
        setRankings(newRankings);
        setStatus({ type: 'success', message: `Copied rankings from Week ${week - 1}` });
      } else {
        setStatus({ type: 'error', message: `No poll found for Week ${week - 1}` });
      }
    } catch (error) {
      console.error("Error copying last week:", error);
      setStatus({ type: 'error', message: "Failed to copy last week's poll." });
    }
  };

  const handleSavePoll = async () => {
    if (!currentLeagueId || !leagueInfo) return;
    
    // Validate: all 25 ranks must have a team
    if (rankings.some(r => !r.teamId)) {
      setStatus({ type: 'error', message: "Please select a team for all 25 ranks." });
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const pollsRef = collection(db, 'polls');
      
      // Check if poll already exists to update or create
      const q = query(
        pollsRef, 
        where('leagueId', '==', currentLeagueId),
        where('week', '==', week),
        where('pollType', '==', pollType),
        where('seasonYear', '==', leagueInfo.currentYear)
      );
      const existingSnap = await getDocs(q);
      
      const pollData: Omit<Poll, 'id'> = {
        leagueId: currentLeagueId,
        seasonYear: leagueInfo.currentYear,
        week,
        pollType,
        rankings: rankings.map(r => ({ teamId: r.teamId, rank: r.rank })),
        createdAt: existingSnap.empty ? serverTimestamp() : existingSnap.docs[0].data().createdAt,
        updatedAt: serverTimestamp()
      };

      let pollId: string;
      if (existingSnap.empty) {
        const newDocRef = doc(pollsRef);
        pollId = newDocRef.id;
        batch.set(newDocRef, pollData);
      } else {
        pollId = existingSnap.docs[0].id;
        batch.set(doc(db, 'polls', pollId), pollData);
      }

      // GLOBAL BADGE SYNC LOGIC
      // If pollType is CFP, or if it's Media and no CFP poll exists for this season
      let shouldSyncBadges = false;
      if (pollType === 'CFP') {
        shouldSyncBadges = true;
      } else if (pollType === 'Media') {
        const cfpQuery = query(
          pollsRef,
          where('leagueId', '==', currentLeagueId),
          where('seasonYear', '==', leagueInfo.currentYear),
          where('pollType', '==', 'CFP')
        );
        const cfpSnap = await getDocs(cfpQuery);
        if (cfpSnap.empty) {
          shouldSyncBadges = true;
        }
      }

      if (shouldSyncBadges) {
        // 1. Clear currentRank for all teams currently ranked
        // We fetch all teams to avoid needing a composite index on currentRank
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const allTeamsSnap = await getDocs(teamsRef);
        
        allTeamsSnap.docs.forEach(teamDoc => {
          if (teamDoc.data().currentRank) {
            batch.update(teamDoc.ref, { currentRank: null });
          }
        });

        // 2. Set currentRank for the new Top 25
        rankings.forEach(r => {
          const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', r.teamId);
          batch.update(teamRef, { currentRank: r.rank });
        });
      }

      await batch.commit();
      setStatus({ type: 'success', message: "Poll saved successfully and rankings updated!" });
    } catch (error: any) {
      console.error("Error saving poll:", error);
      setStatus({ type: 'error', message: `Failed to save poll: ${error.message || 'Unknown error'}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 pb-24">
      <header className="max-w-4xl mx-auto mb-8">
        <button 
          onClick={() => navigate('/admin')}
          className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <ArrowLeft size={14} />
          Back to Admin
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20">
              <Trophy className="text-yellow-500 w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter italic">Manage <span className="text-orange-600">Polls</span></h1>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Weekly Top 25 Rankings</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLastWeek}
              disabled={week === 0 || saving}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-zinc-600 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Copy size={14} />
              Copy Last Week
            </button>
            <button
              onClick={handleSavePoll}
              disabled={saving}
              className="px-6 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-orange-600/20 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Poll
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        {/* Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Select Week</label>
            <select 
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50"
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>Week {i}</option>
              ))}
            </select>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Poll Type</label>
            <div className="flex gap-2">
              {(['Media', 'Coaches', 'CFP'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setPollType(type)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    pollType === type 
                      ? 'bg-orange-600 border-orange-500 text-white' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {status.type !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest border ${
              status.type === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {status.message}
          </motion.div>
        )}

        {/* Rankings Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Filter size={16} className="text-orange-600" />
              Top 25 Entry
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Season {leagueInfo?.currentYear} • Week {week} • {pollType}
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {rankings.map((rank, index) => (
              <div key={rank.rank} className="flex items-center gap-4 group">
                <div className="w-8 h-8 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-black text-zinc-500 group-hover:border-orange-600/50 group-hover:text-orange-500 transition-all">
                  {rank.rank}
                </div>
                <div className="flex-1">
                  <select
                    value={rank.teamId}
                    onChange={(e) => {
                      const newRankings = [...rankings];
                      newRankings[index].teamId = e.target.value;
                      setRankings(newRankings);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50 appearance-none cursor-pointer hover:border-zinc-700 transition-all"
                  >
                    <option value="">Select Team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.conference})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
