import React from 'react';
import { Game, TeamAssignment } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';
import { useLeague } from '../../context/LeagueContext';
import { normalizeYards } from '../../utils/statUtils';

interface NextGameWidgetProps {
  game: Game;
  team: TeamAssignment;
  opponent: TeamAssignment;
}

export const NextGameWidget: React.FC<NextGameWidgetProps> = ({ game, team, opponent }) => {
  const { leagueInfo } = useLeague();
  const quarterLength = leagueInfo?.settings?.quarterLength;

  const teamOffense = normalizeYards(team.totalYards, quarterLength);
  const opponentDefense = normalizeYards(opponent.totalYardsAllowed, quarterLength);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
      <h3 className="text-sm font-black text-white mb-4">Next Game</h3>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col items-center gap-2">
          <img src={getTeamLogo(team.name)} alt={team.name} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
          <span className="text-xs font-bold">{team.name}</span>
        </div>
        <div className="text-zinc-500 font-black text-xl">VS</div>
        <div className="flex flex-col items-center gap-2">
          <img src={getTeamLogo(opponent.name)} alt={opponent.name} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
          <span className="text-xs font-bold">{opponent.name}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-center text-xs">
        <div>
          <p className="text-zinc-500 font-bold uppercase">Offense</p>
          <p className="font-black text-white">{teamOffense} Yds</p>
        </div>
        <div>
          <p className="text-zinc-500 font-bold uppercase">Defense</p>
          <p className="font-black text-white">{opponentDefense} Yds</p>
        </div>
      </div>
    </div>
  );
};
