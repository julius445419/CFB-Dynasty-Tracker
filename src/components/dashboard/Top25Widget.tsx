import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { TeamAssignment, Poll, PollRanking } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ChevronRight, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { TeamLogo } from '../common/TeamLogo';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../../context/LeagueContext';

interface Top25WidgetProps {
  leagueId: string;
}

export const Top25Widget: React.FC<Top25WidgetProps> = ({ leagueId }) => {
  const { leagueInfo, userTeam } = useLeague();
  const [currentPoll, setCurrentPoll] = useState<Poll | null>(null);
  const [prevPoll, setPrevPoll] = useState<Poll | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamAssignment>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!leagueId || !leagueInfo) return;

    let unsubscribePoll: (() => void) | null = null;

    const setupPollListener = async () => {
      setLoading(true);
      try {
        const pollsRef = collection(db, 'polls');
        const currentWeek = leagueInfo.currentWeek;
        const seasonYear = leagueInfo.currentYear;

        // 1. Determine which poll to show (CFP priority)
        // We'll listen to both for the current week to react if a CFP poll is added
        const qCurrent = query(
          pollsRef,
          where('leagueId', '==', leagueId),
          where('seasonYear', '==', seasonYear),
          where('week', '==', currentWeek)
        );

        unsubscribePoll = onSnapshot(qCurrent, async (snapshot) => {
          const polls = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
          
          // Priority: CFP > Media > Coaches
          let activePoll = polls.find(p => p.pollType === 'CFP') || 
                          polls.find(p => p.pollType === 'Media') ||
                          polls.find(p => p.pollType === 'Coaches');

          // Fallback to previous week if nothing for current week
          if (!activePoll && currentWeek > 0) {
            const qPrev = query(
              pollsRef,
              where('leagueId', '==', leagueId),
              where('seasonYear', '==', seasonYear),
              where('week', '==', currentWeek - 1)
            );
            const prevSnap = await getDocs(qPrev);
            const prevPolls = prevSnap.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
            activePoll = prevPolls.find(p => p.pollType === 'CFP') || 
                         prevPolls.find(p => p.pollType === 'Media') ||
                         prevPolls.find(p => p.pollType === 'Coaches');
          }

          if (activePoll) {
            setCurrentPoll(activePoll);

            // Fetch Previous Poll for Trends (relative to the active poll's week)
            const qTrend = query(
              pollsRef,
              where('leagueId', '==', leagueId),
              where('seasonYear', '==', seasonYear),
              where('week', '==', activePoll.week - 1),
              where('pollType', '==', activePoll.pollType)
            );
            const trendSnap = await getDocs(qTrend);
            setPrevPoll(trendSnap.empty ? null : { id: trendSnap.docs[0].id, ...trendSnap.docs[0].data() } as Poll);

            // Fetch Team Data
            const teamsRef = collection(db, 'leagues', leagueId, 'teams');
            const teamsSnap = await getDocs(teamsRef);
            const teamsMap: Record<string, TeamAssignment> = {};
            teamsSnap.docs.forEach(doc => {
              teamsMap[doc.id] = { id: doc.id, ...doc.data() } as TeamAssignment;
            });
            setTeams(teamsMap);
          } else {
            setCurrentPoll(null);
            setPrevPoll(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error in poll listener:", error);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error setting up poll listener:", error);
        setLoading(false);
      }
    };

    setupPollListener();

    return () => {
      if (unsubscribePoll) unsubscribePoll();
    };
  }, [leagueId, leagueInfo, userTeam?.id]);

  const top10 = useMemo(() => {
    if (!currentPoll) return [];
    return currentPoll.rankings.filter(r => r.rank <= 10).sort((a, b) => a.rank - b.rank);
  }, [currentPoll]);

  const userAnchor = useMemo(() => {
    if (!currentPoll || !userTeam?.id) return null;
    const ranking = currentPoll.rankings.find(r => r.teamId === userTeam.id);
    if (ranking && ranking.rank > 10 && ranking.rank <= 25) {
      return ranking;
    }
    return null;
  }, [currentPoll, userTeam?.id]);

  const getTrend = (teamId: string, currentRank: number) => {
    if (!prevPoll) return null;
    const prevRanking = prevPoll.rankings.find(r => r.teamId === teamId);
    if (!prevRanking) return 'NEW';
    const diff = prevRanking.rank - currentRank;
    return diff;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-6 animate-pulse space-y-4">
        <div className="h-4 w-32 bg-zinc-800 rounded-full mx-auto" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
            <div className="h-4 flex-1 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!currentPoll) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 text-center">
        <Trophy className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Rankings TBD</p>
      </div>
    );
  }

  const pollTitle = currentPoll.pollType === 'CFP' ? 'CFP TOP 25' : 'MEDIA POLL';

  return (
    <section className="space-y-4">
      {/* Header Pill */}
      <div className="flex justify-center">
        <div className="bg-zinc-900 border border-white/10 px-4 py-1 rounded-full shadow-lg flex items-center gap-2">
          <Trophy className="w-2.5 h-2.5 text-orange-500" />
          <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
            {pollTitle}
          </span>
        </div>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="divide-y divide-white/5">
          {top10.map((ranking, index) => {
            const team = teams[ranking.teamId];
            const trend = getTrend(ranking.teamId, ranking.rank);
            const isUser = ranking.teamId === userTeam?.id;

            return (
              <motion.div
                key={ranking.teamId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-3 p-3 group hover:bg-white/[0.02] transition-colors ${isUser ? 'bg-orange-500/5' : ''}`}
              >
                {/* Rank & Trend */}
                <div className={`w-12 flex flex-col items-center justify-center shrink-0 transition-all ${isUser ? 'shadow-[inset_4px_0_0_0_#ea580c]' : ''}`}>
                  <span className={`text-sm font-black italic ${isUser ? 'text-orange-500' : 'text-white'}`}>
                    {ranking.rank}
                  </span>
                  <div className="h-3 flex items-center">
                    {trend === 'NEW' ? (
                      <span className="text-[7px] font-black bg-orange-600 text-white px-1 rounded">NEW</span>
                    ) : typeof trend === 'number' ? (
                      trend > 0 ? (
                        <div className="flex items-center text-green-500">
                          <ChevronUp size={8} className="fill-current" />
                          <span className="text-[8px] font-bold">{trend}</span>
                        </div>
                      ) : trend < 0 ? (
                        <div className="flex items-center text-red-500">
                          <ChevronDown size={8} className="fill-current" />
                          <span className="text-[8px] font-bold">{Math.abs(trend)}</span>
                        </div>
                      ) : (
                        <Minus size={8} className="text-zinc-700" />
                      )
                    ) : null}
                  </div>
                </div>

                {/* Sacred Gutter Logo */}
                <div className="w-10 flex justify-center shrink-0">
                  <div className="w-8 h-8 bg-black/40 rounded-lg p-1 border border-white/5 flex items-center justify-center">
                    <TeamLogo 
                      team={team} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Team Info */}
                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs font-black uppercase italic tracking-tight truncate ${isUser ? 'text-white' : 'text-zinc-100'}`}>
                    {team?.name || 'Unknown'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-zinc-500 tabular-nums">
                      {team?.wins || 0}-{team?.losses || 0}
                    </span>
                    <span className="text-[8px] font-medium text-zinc-600 uppercase tracking-wider">
                      {team?.conference}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Teaser Anchor Separator */}
          {userAnchor && (
            <>
              <div className="flex justify-center py-1 bg-black/20">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1 h-1 rounded-full bg-zinc-800" />
                  ))}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-3 bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
              >
                <div className="w-12 flex flex-col items-center justify-center shrink-0 shadow-[inset_4px_0_0_0_#ea580c]">
                  <span className="text-sm font-black italic text-orange-500">
                    {userAnchor.rank}
                  </span>
                  <div className="h-3 flex items-center">
                    {getTrend(userAnchor.teamId, userAnchor.rank) === 'NEW' ? (
                      <span className="text-[7px] font-black bg-orange-600 text-white px-1 rounded">NEW</span>
                    ) : typeof getTrend(userAnchor.teamId, userAnchor.rank) === 'number' ? (
                      (getTrend(userAnchor.teamId, userAnchor.rank) as number) > 0 ? (
                        <div className="flex items-center text-green-500">
                          <ChevronUp size={8} className="fill-current" />
                          <span className="text-[8px] font-bold">{getTrend(userAnchor.teamId, userAnchor.rank)}</span>
                        </div>
                      ) : (getTrend(userAnchor.teamId, userAnchor.rank) as number) < 0 ? (
                        <div className="flex items-center text-red-500">
                          <ChevronDown size={8} className="fill-current" />
                          <span className="text-[8px] font-bold">{Math.abs(getTrend(userAnchor.teamId, userAnchor.rank) as number)}</span>
                        </div>
                      ) : (
                        <Minus size={8} className="text-zinc-700" />
                      )
                    ) : null}
                  </div>
                </div>

                <div className="w-10 flex justify-center shrink-0">
                  <div className="w-8 h-8 bg-black/40 rounded-lg p-1 border border-white/10 flex items-center justify-center">
                    <TeamLogo 
                      team={teams[userAnchor.teamId]} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black uppercase italic tracking-tight truncate text-white">
                    {teams[userAnchor.teamId]?.name || 'Unknown'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-zinc-500 tabular-nums">
                      {teams[userAnchor.teamId]?.wins || 0}-{teams[userAnchor.teamId]?.losses || 0}
                    </span>
                    <span className="text-[8px] font-medium text-zinc-600 uppercase tracking-wider">
                      {teams[userAnchor.teamId]?.conference}
                    </span>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* View Full Rankings Button */}
        <button
          onClick={() => navigate('/polls')}
          className="w-full py-3 bg-white/[0.02] hover:bg-white/[0.05] border-t border-white/5 transition-colors flex items-center justify-center gap-2 group"
        >
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">
            View Full Top 25
          </span>
          <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-orange-500 transition-colors" />
        </button>
      </div>
    </section>
  );
};
