import React from 'react';
import { Game, TeamAssignment } from '../../types';

interface RecentResultsWidgetProps {
  games: Game[];
  team: TeamAssignment;
  teams: TeamAssignment[];
}

export const RecentResultsWidget: React.FC<RecentResultsWidgetProps> = ({ games, team, teams }) => {
  const recentGames = games.filter(g => g.status === 'final').slice(-3).reverse();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-full">
      <h3 className="text-sm font-black text-white mb-4">Recent Results</h3>
      <div className="space-y-4">
        {recentGames.map(game => {
          const isHome = game.homeTeamId === team.id;
          const stats = isHome ? game.homeStats : game.awayStats;
          const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
          const opponent = teams.find(t => t.id === opponentId);
          const opponentName = opponent ? opponent.name : `Opponent ${opponentId}`;
          const score = isHome ? `${game.homeScore} - ${game.awayScore}` : `${game.awayScore} - ${game.homeScore}`;
          const isWin = isHome ? game.homeScore > game.awayScore : game.awayScore > game.homeScore;
          
          const passYards = stats?.passYards || 0;
          const rushYards = stats?.rushYards || 0;

          return (
            <div key={game.id} className="border-b border-zinc-800 pb-2 last:border-0">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold">vs {opponentName}</span>
                <span className={`font-black ${isWin ? 'text-green-500' : 'text-red-500'}`}>{isWin ? 'W' : 'L'} {score}</span>
              </div>
              {stats && (
                <div className="text-[10px] text-zinc-500 flex gap-2">
                  <span>{passYards} Pass</span>
                  <span>{rushYards} Rush</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
