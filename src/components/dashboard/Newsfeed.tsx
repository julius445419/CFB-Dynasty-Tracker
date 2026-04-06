import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { ActivityLog } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, UserPlus, Calendar, Clock, ChevronRight } from 'lucide-react';

interface NewsfeedProps {
  leagueId: string;
  userTeamId?: string | null;
}

export const Newsfeed: React.FC<NewsfeedProps> = ({ leagueId, userTeamId }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;

    const logsRef = collection(db, 'leagues', leagueId, 'activity_logs');
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

      setLogs(prioritizedLogs);
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'game_result': return <Trophy className="w-4 h-4 text-orange-500" />;
      case 'recruiting_commit': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'league_event': return <Calendar className="w-4 h-4 text-green-500" />;
      default: return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin" />
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Loading Feed...</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Latest Activity</h2>
        <button className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors flex items-center gap-1">
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden">
        <div className="divide-y divide-zinc-800/50">
          <AnimatePresence initial={false}>
            {logs.length > 0 ? (
              logs.map((log) => {
                const isUserInvolved = log.metadata?.homeTeamId === userTeamId || 
                                     log.metadata?.awayTeamId === userTeamId || 
                                     log.metadata?.teamId === userTeamId;
                
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-5 flex gap-4 hover:bg-zinc-800/30 transition-colors relative group ${isUserInvolved ? 'bg-orange-600/5' : ''}`}
                  >
                    {isUserInvolved && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-600" />
                    )}
                  
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    log.type === 'game_result' ? 'bg-orange-600/10' : 
                    log.type === 'recruiting_commit' ? 'bg-blue-600/10' : 
                    'bg-green-600/10'
                  }`}>
                    {getIcon(log.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">
                        {log.title}
                      </h4>
                      <span className="text-[10px] font-bold text-zinc-600 whitespace-nowrap">
                        {getRelativeTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                      {log.description}
                    </p>
                  </div>
                </motion.div>
              );
            })
          ) : (
              <div className="p-12 text-center space-y-2">
                <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">No activity yet</p>
                <p className="text-zinc-600 text-xs">Events will appear here as the season progresses.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
