import React from 'react';
import { TeamAssignment, Game } from '../../types';

interface StatHubProps {
  team: TeamAssignment;
  games: Game[];
}

export const StatHub: React.FC<StatHubProps> = ({ team, games }) => {
  const gamesPlayed = (team.wins || 0) + (team.losses || 0);
  
  if (gamesPlayed === 0) return null;

  const avgPass = Math.round((team.passYards || 0) / gamesPlayed);
  const avgRush = Math.round((team.rushYards || 0) / gamesPlayed);
  const avgTotal = Math.round((team.totalYards || 0) / gamesPlayed);
  const avgPPG = ((team.pointsFor || 0) / gamesPlayed).toFixed(1);

  const avgPassAllowed = Math.round((team.passYardsAllowed || 0) / gamesPlayed);
  const avgRushAllowed = Math.round((team.rushYardsAllowed || 0) / gamesPlayed);
  const avgTotalAllowed = Math.round((team.totalYardsAllowed || 0) / gamesPlayed);
  const avgPPGAllowed = ((team.pointsAgainst || 0) / gamesPlayed).toFixed(1);

  const stats = [
    { label: 'Points/G', value: avgPPG, type: 'offense' },
    { label: 'Total Yds/G', value: avgTotal, type: 'offense' },
    { label: 'Pass Yds/G', value: avgPass, type: 'offense' },
    { label: 'Rush Yds/G', value: avgRush, type: 'offense' },
    { label: 'Points Allowed/G', value: avgPPGAllowed, type: 'defense' },
    { label: 'Total Allowed/G', value: avgTotalAllowed, type: 'defense' },
    { label: 'Pass Allowed/G', value: avgPassAllowed, type: 'defense' },
    { label: 'Rush Allowed/G', value: avgRushAllowed, type: 'defense' },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-black text-white">Season Averages</h3>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          {gamesPlayed} Games Played
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</p>
            <p className="text-xl font-black text-white mt-1">{stat.value}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] font-bold text-zinc-600">{stat.type === 'offense' ? 'Offense' : 'Defense'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
