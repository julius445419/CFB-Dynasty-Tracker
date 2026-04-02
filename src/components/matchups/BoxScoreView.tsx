import React from 'react';
import { motion } from 'motion/react';
import { Game, TeamAssignment, TeamStats } from '../../types';
import { Activity, Clock, ShieldAlert, Trophy } from 'lucide-react';
import { getTeamColor } from '../../utils/teamAssets';

interface BoxScoreViewProps {
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
}

export const BoxScoreView: React.FC<BoxScoreViewProps> = ({ game, homeTeam, awayTeam }) => {
  const homeStats = game.homeStats;
  const awayStats = game.awayStats;

  if (!homeStats || !awayStats) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
        <Activity className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest">No Team Stats Logged Yet</p>
      </div>
    );
  }

  const homeColor = getTeamColor(homeTeam.name);
  const awayColor = getTeamColor(awayTeam.name);

  const statsList = [
    { label: 'Passing Yards', away: awayStats.passingYards, home: homeStats.passingYards },
    { label: 'Rushing Yards', away: awayStats.rushingYards, home: homeStats.rushingYards },
    { label: 'Total Yards', away: awayStats.passingYards + awayStats.rushingYards, home: homeStats.passingYards + homeStats.rushingYards },
    { label: 'First Downs', away: awayStats.firstDowns, home: homeStats.firstDowns },
    { label: 'Turnovers', away: awayStats.turnovers, home: homeStats.turnovers, lowerIsBetter: true },
    { label: '3rd Down Conv', away: `${awayStats.thirdDownMade}/${awayStats.thirdDownAtt}`, home: `${homeStats.thirdDownMade}/${homeStats.thirdDownAtt}`, 
      awayVal: awayStats.thirdDownAtt > 0 ? awayStats.thirdDownMade / awayStats.thirdDownAtt : 0,
      homeVal: homeStats.thirdDownAtt > 0 ? homeStats.thirdDownMade / homeStats.thirdDownAtt : 0
    },
    { label: 'Time of Poss', away: `${awayStats.topMinutes}:${awayStats.topSeconds.toString().padStart(2, '0')}`, home: `${homeStats.topMinutes}:${homeStats.topSeconds.toString().padStart(2, '0')}`,
      awayVal: awayStats.topMinutes * 60 + awayStats.topSeconds,
      homeVal: homeStats.topMinutes * 60 + homeStats.topSeconds
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-6 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: awayColor }} />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{awayTeam.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{homeTeam.name}</span>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: homeColor }} />
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-[2rem] border border-zinc-800 overflow-hidden">
        {statsList.map((stat, index) => {
          const isAwayBetter = stat.lowerIsBetter 
            ? (stat.awayVal ?? stat.away) < (stat.homeVal ?? stat.home)
            : (stat.awayVal ?? stat.away) > (stat.homeVal ?? stat.home);
          
          const isHomeBetter = stat.lowerIsBetter
            ? (stat.homeVal ?? stat.home) < (stat.awayVal ?? stat.away)
            : (stat.homeVal ?? stat.home) > (stat.awayVal ?? stat.away);

          return (
            <div 
              key={stat.label}
              className={`flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 last:border-0 transition-colors hover:bg-zinc-800/30`}
            >
              <div 
                className={`flex-1 text-lg font-black italic tracking-tighter ${isAwayBetter ? 'font-black' : 'text-zinc-500 font-medium'}`}
                style={{ color: isAwayBetter ? awayColor : undefined }}
              >
                {stat.away}
              </div>
              
              <div className="flex-1 text-center">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">{stat.label}</span>
              </div>

              <div 
                className={`flex-1 text-right text-lg font-black italic tracking-tighter ${isHomeBetter ? 'font-black' : 'text-zinc-500 font-medium'}`}
                style={{ color: isHomeBetter ? homeColor : undefined }}
              >
                {stat.home}
              </div>
            </div>
          );
        })}
      </div>

      {game.updatedAt && (
        <div className="flex items-center justify-center gap-2 text-zinc-700 mt-4">
          <Clock size={10} />
          <span className="text-[8px] font-black uppercase tracking-widest">
            Stats Last Updated: {new Date(game.updatedAt.toDate()).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};
