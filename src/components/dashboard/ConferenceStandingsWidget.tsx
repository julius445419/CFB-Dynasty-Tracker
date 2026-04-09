import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStandings } from '../../hooks/useStandings';
import { TeamLogo } from '../common/TeamLogo';
import { getTeamShortName } from '../../utils/teamAssets';

interface ConferenceStandingsWidgetProps {
  leagueId: string;
  conference: string;
  userTeamId: string;
}

export const ConferenceStandingsWidget: React.FC<ConferenceStandingsWidgetProps> = ({ 
  leagueId, 
  conference,
  userTeamId
}) => {
  const { standings, loading } = useStandings(leagueId);
  const navigate = useNavigate();

  const conferenceTeams = useMemo(() => {
    if (!standings.length) return [];

    const filtered = standings.filter(t => t.conference === conference);
    
    // Check if any games have been played
    const totalGames = filtered.reduce((acc, t) => acc + t.wins + t.losses, 0);

    if (totalGames === 0) {
      // Week 1 / Preseason: Sort by currentRank (or preseason rank)
      return [...filtered].sort((a, b) => (a.currentRank || 125) - (b.currentRank || 125));
    }

    // Regular sorting
    return [...filtered].sort((a, b) => {
      // Primary: Conf Win %
      if (b.confWinPct !== a.confWinPct) return b.confWinPct - a.confWinPct;
      // Secondary: Overall Win %
      if (b.totalWinPct !== a.totalWinPct) return b.totalWinPct - a.totalWinPct;
      // Final: Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [standings, conference]);

  const displayTeams = conferenceTeams.slice(0, 6);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-6 animate-pulse space-y-4">
        <div className="h-4 w-32 bg-zinc-800 rounded-full mx-auto" />
        {[1, 2, 3, 4, 5, 6].map(i => (
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
      {/* Header Pill */}
      <div className="flex justify-center">
        <div className="bg-orange-600 px-4 py-1 rounded-full shadow-lg shadow-orange-900/20 flex items-center gap-2">
          <Trophy className="w-2.5 h-2.5 text-white" />
          <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
            {conference} Standings
          </span>
        </div>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-3 px-4 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Rank</th>
                <th className="py-3 px-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Team</th>
                <th className="py-3 px-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Conf</th>
                <th className="py-3 px-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center hidden sm:table-cell">Ovr</th>
                <th className="py-3 px-4 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-right hidden sm:table-cell">Strk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayTeams.map((team, index) => {
                const isUser = team.id === userTeamId;
                const shortName = getTeamShortName(team.name);
                
                return (
                  <motion.tr
                    key={team.id || team.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                      group transition-colors
                      ${isUser ? 'bg-orange-500/5' : index % 2 === 1 ? 'bg-white/[0.02]' : 'hover:bg-white/[0.05]'}
                    `}
                  >
                    <td className={`py-3 px-4 w-16 text-center transition-all ${isUser ? 'shadow-[inset_4px_0_0_0_#ea580c]' : ''}`}>
                      <span className={`text-xs font-black italic ${isUser ? 'text-orange-500' : 'text-zinc-500'}`}>
                        {index + 1}
                      </span>
                    </td>

                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        {/* Fixed-width logo container for perfect vertical alignment */}
                        <div className="w-10 flex justify-center shrink-0">
                          <div className="w-7 h-7 bg-black/40 rounded-lg p-1 border border-white/5 flex items-center justify-center">
                            <TeamLogo 
                              schoolName={team.name} 
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                        <span className={`text-xs font-black uppercase italic tracking-tighter ${isUser ? 'text-white' : 'text-zinc-100'}`}>
                          {shortName}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-2 text-center">
                      <span className="text-[10px] font-bold text-zinc-300 tabular-nums">
                        {team.confWins}-{team.confLosses}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-center hidden sm:table-cell">
                      <span className="text-[10px] font-bold text-zinc-500 tabular-nums">
                        {team.wins}-{team.losses}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className={`
                        text-[9px] font-black px-1.5 py-0.5 rounded uppercase
                        ${team.streak.startsWith('W') ? 'bg-green-500/10 text-green-500' : 
                          team.streak.startsWith('L') ? 'bg-red-500/10 text-red-500' : 
                          'bg-zinc-800 text-zinc-500'}
                      `}>
                        {team.streak}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* View Full Standings Button */}
        <button
          onClick={() => navigate('/standings')}
          className="w-full py-3 bg-white/[0.02] hover:bg-white/[0.05] border-t border-white/5 transition-colors flex items-center justify-center gap-2 group"
        >
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">
            View Full Standings
          </span>
          <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-orange-500 transition-colors" />
        </button>
      </div>
    </section>
  );
};
