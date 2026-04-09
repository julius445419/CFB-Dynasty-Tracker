import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { ActivityLog } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NewsfeedProps {
  leagueId: string;
  userTeamId?: string | null;
}

export const Newsfeed: React.FC<NewsfeedProps> = ({ leagueId, userTeamId }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!leagueId) return;

    const logsRef = collection(db, 'leagues', leagueId, 'activity_logs');
    // Fetch 15 to allow for prioritization, but we only display 5
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(15));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      
      // Prioritization logic: 
      // 1. User involved events (current user's team)
      // 2. Human involved events (any human team)
      // 3. Everything else
      const prioritizedLogs = [...logsData].sort((a, b) => {
        const isAUser = a.metadata?.homeTeamId === userTeamId || a.metadata?.awayTeamId === userTeamId || a.metadata?.teamId === userTeamId;
        const isBUser = b.metadata?.homeTeamId === userTeamId || b.metadata?.awayTeamId === userTeamId || b.metadata?.teamId === userTeamId;
        
        if (isAUser && !isBUser) return -1;
        if (!isAUser && isBUser) return 1;

        const aHuman = a.metadata?.isHumanInvolved ? 1 : 0;
        const bHuman = b.metadata?.isHumanInvolved ? 1 : 0;
        if (aHuman !== bHuman) return bHuman - aHuman;
        
        return 0; // Maintain firestore's timestamp sort
      });

      setLogs(prioritizedLogs.slice(0, 5));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [leagueId, userTeamId]);

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const transformLogToHeadline = (log: ActivityLog) => {
    const { type, title, description } = log;
    
    let headline = title;
    let category = 'NEWS';
    let colorClass = 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    let targetPath = '/activity';

    if (type === 'game_result') {
      category = 'FINAL SCORE';
      colorClass = 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      targetPath = '/schedule';
      if (title.includes('Results Processed')) {
        const teamName = title.replace(' Results Processed', '');
        headline = `${teamName.toUpperCase()} REPORT: Results are in as the conference race heats up.`;
      } else if (description.toLowerCase().includes('upset') || description.toLowerCase().includes('defeated')) {
        category = 'UPSET';
        colorClass = 'bg-red-500/10 text-red-500 border-red-500/20';
        headline = `SHOCKER: ${description.toUpperCase()}`;
      }
    } else if (type === 'recruiting_commit') {
      category = 'RECRUITING';
      colorClass = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      targetPath = '/recruiting';
      headline = `BIG COMMIT: ${description}`;
    } else if (type === 'league_event' || title.toLowerCase().includes('advanced')) {
      category = 'SCHEDULE';
      colorClass = 'bg-green-500/10 text-green-500 border-green-500/20';
      targetPath = '/schedule';
      if (title.toLowerCase().includes('advanced')) {
        const weekMatch = title.match(/\d+/);
        const week = weekMatch ? weekMatch[0] : '';
        headline = `WEEK ${week} KICKOFF: The road to the Playoff heats up as the mid-season grind begins.`;
      }
    } else if (title.toLowerCase().includes('moved to #') || title.toLowerCase().includes('poll')) {
      category = 'RANKINGS';
      colorClass = 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      targetPath = '/rankings';
      headline = `POLL WATCH: ${title.toUpperCase()} after dominant showing.`;
    }

    return { headline, category, colorClass, targetPath };
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin" />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Scanning News Wire...</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-orange-500 fill-orange-500" />
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">Dynasty News Wire</h2>
        </div>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="divide-y divide-white/5">
          <AnimatePresence initial={false}>
            {logs.length > 0 ? (
              logs.map((log, index) => {
                const isUserInvolved = log.metadata?.homeTeamId === userTeamId || 
                                     log.metadata?.awayTeamId === userTeamId || 
                                     log.metadata?.teamId === userTeamId;
                
                const { headline, category, colorClass, targetPath } = transformLogToHeadline(log);
                
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(targetPath)}
                    className={`
                      p-4 flex flex-col gap-2 cursor-pointer transition-all relative group
                      ${isUserInvolved ? 'bg-orange-500/5' : 'hover:bg-white/[0.03]'}
                    `}
                  >
                    {/* User Highlight Indicator */}
                    {isUserInvolved && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-600" />
                    )}
                  
                    <div className="flex items-center justify-between gap-2">
                      <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${colorClass}`}>
                        {category}
                      </div>
                      <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
                        {getRelativeTime(log.timestamp)}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-white uppercase tracking-tight leading-tight group-hover:text-orange-500 transition-colors">
                      {headline}
                    </h4>
                  </motion.div>
                );
              })
            ) : (
              <div className="p-12 text-center space-y-2">
                <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">Quiet on the Wire</p>
                <p className="text-zinc-600 text-[10px] uppercase tracking-tighter">No headlines to report at this time.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* View All News Button */}
        <button
          onClick={() => navigate('/activity')}
          className="w-full py-3 bg-white/[0.02] hover:bg-white/[0.05] border-t border-white/5 transition-colors flex items-center justify-center gap-2 group"
        >
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">
            View All News
          </span>
          <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-orange-500 transition-colors" />
        </button>
      </div>
    </section>
  );
};
