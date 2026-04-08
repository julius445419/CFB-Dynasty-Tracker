import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  ChevronDown, 
  ChevronUp, 
  Minus, 
  Shield, 
  Calendar, 
  Loader2, 
  ChevronRight,
  ArrowLeft,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { TeamAssignment, Poll, PollRanking, Game } from '../types';
import { TeamLogo } from '../components/common/TeamLogo';

type PollType = 'Media' | 'Coaches' | 'CFP';

export const Polls: React.FC = () => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const navigate = useNavigate();

  const [selectedWeek, setSelectedWeek] = useState<number>(leagueInfo?.currentWeek || 0);
  const [selectedPollType, setSelectedPollType] = useState<PollType>('Media');
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [prevPoll, setPrevPoll] = useState<Poll | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamAssignment>>({});
  const [games, setGames] = useState<Game[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);

  // Default Poll Logic: CFP if exists, else Media
  useEffect(() => {
    const checkCFP = async () => {
      if (!currentLeagueId || !leagueInfo) return;
      
      const pollsRef = collection(db, 'polls');
      const q = query(
        pollsRef,
        where('leagueId', '==', currentLeagueId),
        where('seasonYear', '==', leagueInfo.currentYear),
        where('pollType', '==', 'CFP'),
        orderBy('week', 'desc'),
        limit(1)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSelectedPollType('CFP');
      }
    };
    checkCFP();
  }, [currentLeagueId, leagueInfo]);

  // Fetch Available Weeks
  useEffect(() => {
    const fetchWeeks = async () => {
      if (!currentLeagueId || !leagueInfo) return;
      
      const pollsRef = collection(db, 'polls');
      const q = query(
        pollsRef,
        where('leagueId', '==', currentLeagueId),
        where('seasonYear', '==', leagueInfo.currentYear)
      );
      
      const snap = await getDocs(q);
      const weeks = Array.from(new Set(snap.docs.map(d => d.data().week))).sort((a, b) => b - a);
      setAvailableWeeks(weeks);
      
      if (weeks.length > 0 && !weeks.includes(selectedWeek)) {
        setSelectedWeek(weeks[0]);
      }
    };
    fetchWeeks();
  }, [currentLeagueId, leagueInfo]);

  // Main Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      if (!currentLeagueId || !leagueInfo) return;
      setLoading(true);

      try {
        const pollsRef = collection(db, 'polls');
        
        // Fetch Current Poll
        const qCurrent = query(
          pollsRef,
          where('leagueId', '==', currentLeagueId),
          where('seasonYear', '==', leagueInfo.currentYear),
          where('week', '==', selectedWeek),
          where('pollType', '==', selectedPollType)
        );
        const currentSnap = await getDocs(qCurrent);
        const currentPollData = currentSnap.empty ? null : { id: currentSnap.docs[0].id, ...currentSnap.docs[0].data() } as Poll;
        setPoll(currentPollData);

        // Fetch Previous Poll
        if (selectedWeek > 0) {
          const qPrev = query(
            pollsRef,
            where('leagueId', '==', currentLeagueId),
            where('seasonYear', '==', leagueInfo.currentYear),
            where('week', '==', selectedWeek - 1),
            where('pollType', '==', selectedPollType)
          );
          const prevSnap = await getDocs(qPrev);
          setPrevPoll(prevSnap.empty ? null : { id: prevSnap.docs[0].id, ...prevSnap.docs[0].data() } as Poll);
        } else {
          setPrevPoll(null);
        }

        // Fetch Teams (only needed ones)
        if (currentPollData) {
          const teamIds = new Set(currentPollData.rankings.map(r => r.teamId));
          // Also add teams from prev poll for "Dropped Out"
          // But for simplicity, let's just fetch all teams in the league if it's small
          // Or fetch by IDs. Firestore doesn't support 'in' with more than 30 IDs.
          // Let's fetch all teams in the league since it's usually ~134.
          const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
          const teamsSnap = await getDocs(teamsRef);
          const teamsMap: Record<string, TeamAssignment> = {};
          teamsSnap.docs.forEach(d => {
            teamsMap[d.id] = { id: d.id, ...d.data() } as TeamAssignment;
          });
          setTeams(teamsMap);

          // Fetch Games for the season
          const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
          const gamesSnap = await getDocs(query(gamesRef, where('season', '==', leagueInfo.currentYear)));
          setGames(gamesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
        }
      } catch (error) {
        console.error("Error fetching poll data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentLeagueId, leagueInfo, selectedWeek, selectedPollType]);

  const getTeamRankInPoll = (teamId: string, pollData: Poll | null) => {
    if (!pollData) return null;
    const ranking = pollData.rankings.find(r => r.teamId === teamId);
    return ranking ? ranking.rank : null;
  };

  const getGameResult = (teamId: string, weekNum: number) => {
    const game = games.find(g => g.week === weekNum && (g.homeTeamId === teamId || g.awayTeamId === teamId));
    if (!game || game.status !== 'final') return null;

    const isHome = game.homeTeamId === teamId;
    const teamScore = isHome ? game.homeScore : game.awayScore;
    const oppScore = isHome ? game.awayScore : game.homeScore;
    const oppId = isHome ? game.awayTeamId : game.homeTeamId;
    const opp = teams[oppId];
    const oppRank = getTeamRankInPoll(oppId, prevPoll); // Use prev poll for last week's rank context

    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'T';
    return `${result} ${teamScore}-${oppScore} ${isHome ? 'vs' : 'at'} ${oppRank ? `#${oppRank} ` : ''}${opp?.name || 'Unknown'}`;
  };

  const getUpcomingMatchup = (teamId: string, weekNum: number) => {
    const game = games.find(g => g.week === weekNum && (g.homeTeamId === teamId || g.awayTeamId === teamId));
    if (!game) return 'BYE';

    const isHome = game.homeTeamId === teamId;
    const oppId = isHome ? game.awayTeamId : game.homeTeamId;
    const opp = teams[oppId];
    const oppRank = getTeamRankInPoll(oppId, poll); // Use current poll for upcoming rank context

    return `${isHome ? '' : 'at '}${oppRank ? `#${oppRank} ` : ''}${opp?.name || 'Unknown'}`;
  };

  const droppedOut = useMemo(() => {
    if (!poll || !prevPoll) return [];
    const currentIds = new Set(poll.rankings.map(r => r.teamId));
    return prevPoll.rankings
      .filter(r => !currentIds.has(r.teamId))
      .map(r => ({ ...r, team: teams[r.teamId] }))
      .sort((a, b) => a.rank - b.rank);
  }, [poll, prevPoll, teams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 pb-24 selection:bg-orange-600/30">
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/league')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <ArrowLeft size={14} />
            League Hub
          </button>
          
          <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            {(['Media', 'Coaches', 'CFP'] as PollType[]).map(type => (
              <button
                key={type}
                onClick={() => setSelectedPollType(type)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedPollType === type 
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Trophy size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">
                Top 25 <span className="text-orange-600">Rankings</span>
              </h1>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-2">
                {selectedPollType} Poll • Season {leagueInfo?.currentYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="appearance-none bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-3 pr-12 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-orange-500 transition-all cursor-pointer"
              >
                {availableWeeks.map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {!poll ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-12 text-center">
            <Info className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-black uppercase italic text-zinc-500">No Poll Data Available</h2>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-2">
              Rankings for Week {selectedWeek} have not been released yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden bg-zinc-900/30 border border-zinc-800 rounded-[2rem]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rank</th>
                    <th className="px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">LW</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">School</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Record</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Last Week</th>
                    <th className="px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">This Week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {poll.rankings.map((ranking) => {
                    const team = teams[ranking.teamId];
                    const lwRank = getTeamRankInPoll(ranking.teamId, prevPoll);
                    const lastResult = getGameResult(ranking.teamId, selectedWeek - 1);
                    const nextMatchup = getUpcomingMatchup(ranking.teamId, selectedWeek);

                    return (
                      <motion.tr 
                        key={ranking.teamId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-zinc-900/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black italic text-white group-hover:text-orange-500 transition-colors">
                              {ranking.rank}
                            </span>
                            {lwRank && (
                              ranking.rank < lwRank ? (
                                <ChevronUp size={14} className="text-green-500 shrink-0" />
                              ) : ranking.rank > lwRank ? (
                                <ChevronDown size={14} className="text-red-500 shrink-0" />
                              ) : (
                                <Minus size={14} className="text-zinc-700 shrink-0" />
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs font-bold text-zinc-400">
                            {lwRank || 'NR'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800 group-hover:border-orange-500/50 transition-colors">
                              <TeamLogo team={team} className="w-6 h-6" />
                            </div>
                            <span className="font-black uppercase italic tracking-tight text-white group-hover:translate-x-1 transition-transform">
                              {team?.name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-zinc-400">
                            {team?.wins || 0}-{team?.losses || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            {lastResult || '--'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                            {nextMatchup}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Layout */}
            <div className="md:hidden space-y-3">
              {poll.rankings.map((ranking) => {
                const team = teams[ranking.teamId];
                const lwRank = getTeamRankInPoll(ranking.teamId, prevPoll);
                const lastResult = getGameResult(ranking.teamId, selectedWeek - 1);
                const nextMatchup = getUpcomingMatchup(ranking.teamId, selectedWeek);

                return (
                  <motion.div
                    key={ranking.teamId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 flex flex-col items-center justify-center bg-zinc-950 rounded-xl border border-zinc-800 shrink-0 relative">
                        <div className="flex items-center gap-1">
                          <span className="text-xl font-black italic text-white leading-none">{ranking.rank}</span>
                          {lwRank && (
                            ranking.rank < lwRank ? (
                              <ChevronUp size={10} className="text-green-500" />
                            ) : ranking.rank > lwRank ? (
                              <ChevronDown size={10} className="text-red-500" />
                            ) : (
                              <Minus size={10} className="text-zinc-700" />
                            )
                          )}
                        </div>
                        <span className="text-[8px] font-bold text-zinc-600 uppercase mt-1">LW: {lwRank || 'NR'}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamLogo team={team} className="w-4 h-4 shrink-0" />
                            <h3 className="font-black uppercase italic tracking-tight text-white truncate">
                              {team?.name || 'Unknown'}
                            </h3>
                          </div>
                          <span className="text-xs font-bold text-zinc-500 shrink-0">
                            {team?.wins || 0}-{team?.losses || 0}
                          </span>
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Last:</span>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase truncate max-w-[120px]">
                              {lastResult || '--'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Next:</span>
                            <span className="text-[9px] font-bold text-white uppercase">
                              {nextMatchup}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Dropped Out Footer */}
            {droppedOut.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 p-6 bg-zinc-900/20 border border-zinc-900 rounded-2xl"
              >
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">
                  Dropped Out
                </p>
                <div className="flex flex-wrap gap-2">
                  {droppedOut.map((d, idx) => (
                    <span key={d.teamId} className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      #{d.rank} {d.team?.name || 'Unknown'}{idx < droppedOut.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-12 border-t border-zinc-900 text-center">
        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">
          Official Dynasty Rankings • Calibrated for CFB 26
        </p>
      </footer>
    </div>
  );
};
