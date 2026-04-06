import React from 'react';
import { motion } from 'motion/react';
import { Game, TeamAssignment, TeamStats } from '../../types';
import { Activity, Clock, ShieldAlert, Trophy } from 'lucide-react';
import { getTeamColor } from '../../utils/teamAssets';
import { parseTOPToSeconds, normalizeTOP, formatSecondsToMMSS } from '../../utils/topUtils';

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

  const awaySeconds = parseTOPToSeconds(awayStats.timeOfPossession);
  const homeSeconds = parseTOPToSeconds(homeStats.timeOfPossession);
  const { awayNormalized, homeNormalized } = normalizeTOP(awaySeconds, homeSeconds);

  const statsList = [
    { label: 'Passing Yards', away: awayStats.passYards || 0, home: homeStats.passYards || 0 },
    { label: 'Rushing Yards', away: awayStats.rushYards || 0, home: homeStats.rushYards || 0 },
    { label: 'Total Yards', away: Number(awayStats.passYards || 0) + Number(awayStats.rushYards || 0), home: Number(homeStats.passYards || 0) + Number(homeStats.rushYards || 0) },
    { label: 'Passing TDs', away: awayStats.passingTds || 0, home: homeStats.passingTds || 0 },
    { label: 'Rushing TDs', away: awayStats.rushingTds || 0, home: homeStats.rushingTds || 0 },
    { label: 'Completions', away: awayStats.completions || 0, home: homeStats.completions || 0 },
    { label: 'Passing Att', away: awayStats.passingAttempts || 0, home: homeStats.passingAttempts || 0 },
    { label: 'Rushing Att', away: awayStats.rushingAttempts || 0, home: homeStats.rushingAttempts || 0 },
    { label: 'Total Plays', away: awayStats.totalPlays || 0, home: homeStats.totalPlays || 0 },
    { label: 'First Downs', away: awayStats.firstDowns || 0, home: homeStats.firstDowns || 0 },
    { label: '3rd Down Conv', away: `${awayStats.thirdDownMade || 0}/${awayStats.thirdDownAtt || 0}`, home: `${homeStats.thirdDownMade || 0}/${homeStats.thirdDownAtt || 0}`, 
      awayVal: (awayStats.thirdDownAtt || 0) > 0 ? (awayStats.thirdDownMade || 0) / (awayStats.thirdDownAtt || 0) : 0,
      homeVal: (homeStats.thirdDownAtt || 0) > 0 ? (homeStats.thirdDownMade || 0) / (homeStats.thirdDownAtt || 0) : 0
    },
    { label: '4th Down Conv', away: `${awayStats.fourthDownConversions || 0}/${awayStats.fourthDownAttempts || 0}`, home: `${homeStats.fourthDownConversions || 0}/${homeStats.fourthDownAttempts || 0}`,
      awayVal: (awayStats.fourthDownAttempts || 0) > 0 ? (awayStats.fourthDownConversions || 0) / (awayStats.fourthDownAttempts || 0) : 0,
      homeVal: (homeStats.fourthDownAttempts || 0) > 0 ? (homeStats.fourthDownConversions || 0) / (homeStats.fourthDownAttempts || 0) : 0
    },
    { label: '2 Pt Conv', away: `${awayStats.twoPointConversions || 0}/${awayStats.twoPointAttempts || 0}`, home: `${homeStats.twoPointConversions || 0}/${homeStats.twoPointAttempts || 0}`,
      awayVal: (awayStats.twoPointAttempts || 0) > 0 ? (awayStats.twoPointConversions || 0) / (awayStats.twoPointAttempts || 0) : 0,
      homeVal: (homeStats.twoPointAttempts || 0) > 0 ? (homeStats.twoPointConversions || 0) / (homeStats.twoPointAttempts || 0) : 0
    },
    { label: 'Turnovers', away: awayStats.turnovers || 0, home: homeStats.turnovers || 0, lowerIsBetter: true },
    { label: 'Fumbles Lost', away: awayStats.fumblesLost || 0, home: homeStats.fumblesLost || 0, lowerIsBetter: true },
    { label: 'INTs Thrown', away: awayStats.interceptionsThrown || 0, home: homeStats.interceptionsThrown || 0, lowerIsBetter: true },
    { label: 'Penalties', away: awayStats.penalties || 0, home: homeStats.penalties || 0, lowerIsBetter: true },
    { label: 'Penalty Yards', away: awayStats.penaltyYards || 0, home: homeStats.penaltyYards || 0, lowerIsBetter: true },
    { label: 'Time of Poss', away: formatSecondsToMMSS(awayNormalized), home: formatSecondsToMMSS(homeNormalized),
      awayVal: awayNormalized,
      homeVal: homeNormalized
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
