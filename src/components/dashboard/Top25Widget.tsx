import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { TeamAssignment } from '../../types';
import { motion } from 'motion/react';
import { Trophy, ChevronRight } from 'lucide-react';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../common/TeamLogo';
import { useNavigate } from 'react-router-dom';

interface Top25WidgetProps {
  leagueId: string;
}

export const Top25Widget: React.FC<Top25WidgetProps> = ({ leagueId }) => {
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!leagueId) return;

    const teamsRef = collection(db, 'leagues', leagueId, 'teams');
    // Query teams with a rank, sorted by rank ascending, limited to 5
    const q = query(
      teamsRef, 
      orderBy('rank', 'asc'), 
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as TeamAssignment))
        .filter(team => team.rank && team.rank > 0);
      
      setTeams(teamsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching Top 25:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 animate-pulse space-y-4">
        <div className="h-4 w-24 bg-zinc-800 rounded" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
            <div className="h-4 flex-1 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">National Top 5</h2>
        <button 
          onClick={() => navigate('/rankings')}
          className="text-[10px] font-black text-orange-500 uppercase tracking-widest hover:text-orange-400 transition-colors flex items-center gap-1"
        >
          Full Rankings
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden">
        {teams.length > 0 ? (
          <div className="divide-y divide-zinc-800/50">
            {teams.map((team) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 flex items-center gap-4 hover:bg-zinc-800/30 transition-colors group"
              >
                <div className="w-6 text-center">
                  <span className="text-xs font-black text-zinc-500 group-hover:text-orange-500 transition-colors">
                    {team.rank || 0}
                  </span>
                </div>
                
                <div className="w-10 h-10 bg-zinc-950 rounded-xl p-2 border border-zinc-800 flex items-center justify-center shrink-0">
                  <TeamLogo 
                    schoolName={team.name} 
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate uppercase italic tracking-tight">
                    {team.name}
                  </h4>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {team.wins || 0}-{team.losses || 0}
                  </p>
                </div>

                {team.rank === 1 && (
                  <Trophy className="w-4 h-4 text-orange-500 shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center space-y-2">
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Rankings TBD</p>
            <p className="text-[10px] text-zinc-600">Polls will be released soon.</p>
          </div>
        )}
      </div>
    </section>
  );
};
