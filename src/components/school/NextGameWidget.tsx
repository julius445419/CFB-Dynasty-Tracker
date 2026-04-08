import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Shield, Target, Activity } from 'lucide-react';
import { Game, TeamAssignment } from '../../types';
import { TeamLogo } from '../common/TeamLogo';
import { useLeague } from '../../context/LeagueContext';
import { useStatLeaders } from '../../hooks/useStatLeaders';

interface NextGameWidgetProps {
  game: Game;
  team: TeamAssignment;
  opponent: TeamAssignment;
}

export const NextGameWidget: React.FC<NextGameWidgetProps> = ({ game, team, opponent }) => {
  const { leagueInfo } = useLeague();
  const { leaders, loading } = useStatLeaders();
  const [isExpanded, setIsExpanded] = useState(false);

  const scoutingStats = useMemo(() => {
    if (!leaders || leaders.length === 0) return null;

    const categories = [
      { label: 'Points Per Game', field: 'ppg', order: 'desc' },
      { label: 'Total Offense', field: 'totalOffYpg', order: 'desc' },
      { label: 'Passing YPG', field: 'passYpg', order: 'desc' },
      { label: 'Rushing YPG', field: 'rushYpg', order: 'desc' },
      { label: 'Points Allowed', field: 'papg', order: 'asc' },
      { label: 'Total Defense', field: 'defTotalYpgAllowed', order: 'asc' },
      { label: 'Pass Def YPG', field: 'defPassYpgAllowed', order: 'asc' },
      { label: 'Rush Def YPG', field: 'defRushYpgAllowed', order: 'asc' },
    ];

    return categories.map(cat => {
      const sorted = [...leaders].sort((a, b) => {
        const valA = (a as any)[cat.field] || 0;
        const valB = (b as any)[cat.field] || 0;
        return cat.order === 'desc' ? valB - valA : valA - valB;
      });

      const getTeamRank = (tid: string) => {
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
          const val = (sorted[i] as any)[cat.field] || 0;
          if (i > 0 && val !== ((sorted[i - 1] as any)[cat.field] || 0)) {
            rank = i + 1;
          }
          if (sorted[i].teamId === tid) return { rank, val };
        }
        return { rank: 'NR', val: 0 };
      };

      const teamA = getTeamRank(team.id);
      const teamB = getTeamRank(opponent.id);

      return {
        label: cat.label,
        teamA,
        teamB,
        better: cat.order === 'desc' ? (teamA.val > teamB.val ? 'A' : 'B') : (teamA.val < teamB.val ? 'A' : 'B')
      };
    });
  }, [leaders, team.id, opponent.id]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Next Game</h3>
            <p className="text-xs font-bold text-white">Week {game.week}</p>
          </div>
          <div className="bg-zinc-800 px-3 py-1 rounded-full">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Matchup Preview</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Team A */}
          <div className="flex-1 flex flex-col items-center text-center gap-2">
            <div className="relative">
              <TeamLogo team={team} size="lg" className="bg-zinc-950 p-2 rounded-2xl border border-zinc-800 shadow-xl" />
              {team.currentRank && team.currentRank <= 25 && (
                <div className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-lg border border-orange-400">
                  #{team.currentRank}
                </div>
              )}
            </div>
            <div>
              <span className="text-sm font-black text-white uppercase italic tracking-tight block leading-tight">{team.name}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">({team.wins || 0}-{team.losses || 0})</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="h-px w-8 bg-zinc-800" />
            <span className="text-zinc-700 font-black text-xl italic">VS</span>
            <div className="h-px w-8 bg-zinc-800" />
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col items-center text-center gap-2">
            <div className="relative">
              <TeamLogo team={opponent} size="lg" className="bg-zinc-950 p-2 rounded-2xl border border-zinc-800 shadow-xl" />
              {opponent.currentRank && opponent.currentRank <= 25 && (
                <div className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-lg border border-orange-400">
                  #{opponent.currentRank}
                </div>
              )}
            </div>
            <div>
              <span className="text-sm font-black text-white uppercase italic tracking-tight block leading-tight">{opponent.name}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">({opponent.wins || 0}-{opponent.losses || 0})</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-6 py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl flex items-center justify-center gap-2 transition-colors group"
        >
          <Activity size={14} className="text-orange-500 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Scouting Report</span>
          {isExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && scoutingStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800 bg-zinc-950/50"
          >
            <div className="p-6 space-y-4">
              {scoutingStats.map((stat, idx) => (
                <div key={idx} className="grid grid-cols-5 items-center gap-2">
                  {/* Team A Stat */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-[9px] font-black text-zinc-600">#{stat.teamA.rank}</span>
                    <span className={`text-xs font-black ${stat.better === 'A' ? 'text-orange-500' : 'text-zinc-400'}`}>
                      {stat.teamA.val.toFixed(1)}
                    </span>
                  </div>

                  {/* Label */}
                  <div className="text-center">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter whitespace-nowrap">
                      {stat.label}
                    </span>
                  </div>

                  {/* Team B Stat */}
                  <div className="col-span-2 flex items-center justify-start gap-2">
                    <span className={`text-xs font-black ${stat.better === 'B' ? 'text-orange-500' : 'text-zinc-400'}`}>
                      {stat.teamB.val.toFixed(1)}
                    </span>
                    <span className="text-[9px] font-black text-zinc-600">#{stat.teamB.rank}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
