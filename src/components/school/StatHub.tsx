import React from 'react';
import { TeamAssignment, Game } from '../../types';

interface StatHubProps {
  team: TeamAssignment;
  games: Game[];
}

export const StatHub: React.FC<StatHubProps> = ({ team, games }) => {
  // Calculate aggregate stats
  const finishedGames = games.filter(g => g.status === 'final');
  if (finishedGames.length === 0) return null;
  
  let totalPassYards = 0;
  let totalRushYards = 0;
  let totalPassYardsAllowed = 0;
  let totalRushYardsAllowed = 0;
  
  let gamesWithOffense = 0;
  let gamesWithDefense = 0;

  finishedGames.forEach(game => {
    const teamId = team.id || '';
    const isHome = game.homeTeamId === teamId;
    const stats = isHome ? game.homeStats : game.awayStats;
    const oppStats = isHome ? game.awayStats : game.homeStats;

    if (stats && (stats.passYards !== undefined || stats.rushYards !== undefined)) {
      totalPassYards += Number(stats.passYards || 0);
      totalRushYards += Number(stats.rushYards || 0);
      gamesWithOffense++;
    }
    if (oppStats && (oppStats.passYards !== undefined || oppStats.rushYards !== undefined)) {
      totalPassYardsAllowed += Number(oppStats.passYards || 0);
      totalRushYardsAllowed += Number(oppStats.rushYards || 0);
      gamesWithDefense++;
    }
  });

  const avgPass = gamesWithOffense > 0 ? Math.round(totalPassYards / gamesWithOffense) : 0;
  const avgRush = gamesWithOffense > 0 ? Math.round(totalRushYards / gamesWithOffense) : 0;
  const avgPassAllowed = gamesWithDefense > 0 ? Math.round(totalPassYardsAllowed / gamesWithDefense) : 0;
  const avgRushAllowed = gamesWithDefense > 0 ? Math.round(totalRushYardsAllowed / gamesWithDefense) : 0;

  const stats = [
    { label: 'Pass Yds/G', value: avgPass, type: 'offense', games: gamesWithOffense },
    { label: 'Rush Yds/G', value: avgRush, type: 'offense', games: gamesWithOffense },
    { label: 'Pass Yds Allowed/G', value: avgPassAllowed, type: 'defense', games: gamesWithDefense },
    { label: 'Rush Yds Allowed/G', value: avgRushAllowed, type: 'defense', games: gamesWithDefense },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-black text-white">Stat Hub</h3>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          {finishedGames.length} Games Played
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</p>
            <p className="text-xl font-black text-white mt-1">{stat.value}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] font-bold text-zinc-600">{stat.type === 'offense' ? 'Offense' : 'Defense'}</p>
              <p className="text-[8px] font-bold text-zinc-700">{stat.games} GP</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
