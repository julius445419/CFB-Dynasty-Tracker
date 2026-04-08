import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment, TeamStats, PlayerGameStats, Player } from '../../types';
import { Activity, Clock, ShieldAlert, Trophy, User, ChevronDown, ChevronUp } from 'lucide-react';
import { getTeamColor } from '../../utils/teamAssets';
import { parseTOPToSeconds, normalizeTOP, formatSecondsToMMSS } from '../../utils/topUtils';

interface BoxScoreViewProps {
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
}

export const BoxScoreView: React.FC<BoxScoreViewProps> = ({ game, homeTeam, awayTeam }) => {
  const [playerStats, setPlayerStats] = useState<PlayerGameStats[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loading, setLoading] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(false);

  const homeStats = game.homeStats;
  const awayStats = game.awayStats;

  useEffect(() => {
    if (showPlayerStats && playerStats.length === 0) {
      fetchPlayerStats();
    }
  }, [showPlayerStats]);

  const fetchPlayerStats = async () => {
    setLoading(true);
    try {
      const statsRef = collection(db, 'leagues', game.leagueId, 'playerStats');
      const q = query(statsRef, where('gameId', '==', game.id));
      const snap = await getDocs(q);
      const stats = snap.docs.map(doc => doc.data() as PlayerGameStats);
      setPlayerStats(stats);

      // Fetch player names/info
      if (stats.length > 0) {
        const playerIds = Array.from(new Set(stats.map(s => s.playerId)));
        const playersRef = collection(db, 'leagues', game.leagueId, 'players');
        const playerMap: Record<string, Player> = {};
        
        // Firestore 'in' query limit is 30, so we might need to chunk if there are many players
        // For a single game, it's usually < 30 players with stats
        const playerSnap = await getDocs(query(playersRef, where('__name__', 'in', playerIds.slice(0, 30))));
        playerSnap.docs.forEach(doc => {
          playerMap[doc.id] = { id: doc.id, ...doc.data() } as Player;
        });
        setPlayers(playerMap);
      }
    } catch (err) {
      console.error("Error fetching player stats:", err);
    } finally {
      setLoading(false);
    }
  };

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
    { label: 'YPP', away: awayStats.ypp || 0, home: homeStats.ypp || 0 },
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

  const renderPlayerStatsTable = (teamId: string, teamName: string) => {
    const teamStats = playerStats.filter(s => s.teamId === teamId);
    if (teamStats.length === 0) return null;

    const passing = teamStats.filter(s => (s.passYds || 0) > 0 || (s.passTDs || 0) > 0);
    const rushing = teamStats.filter(s => (s.rushYds || 0) > 0 || (s.rushTDs || 0) > 0);
    const receiving = teamStats.filter(s => (s.recYds || 0) > 0 || (s.recTDs || 0) > 0);
    const defense = teamStats.filter(s => (s.tackles || 0) > 0 || (s.sacks || 0) > 0 || (s.ints || 0) > 0);

    return (
      <div className="space-y-6">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] px-2">{teamName} Individual Stats</h3>
        
        {passing.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-2">Passing</p>
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-zinc-800/50 text-zinc-500 uppercase font-black">
                  <tr>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-right">Yds</th>
                    <th className="px-4 py-2 text-right">TD</th>
                    <th className="px-4 py-2 text-right">INT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {passing.map(s => (
                    <tr key={s.playerId} className="text-zinc-300 font-bold">
                      <td className="px-4 py-2">{players[s.playerId]?.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-right">{s.passYds}</td>
                      <td className="px-4 py-2 text-right">{s.passTDs}</td>
                      <td className="px-4 py-2 text-right">{s.passInts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rushing.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-2">Rushing</p>
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-zinc-800/50 text-zinc-500 uppercase font-black">
                  <tr>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-right">Yds</th>
                    <th className="px-4 py-2 text-right">TD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {rushing.map(s => (
                    <tr key={s.playerId} className="text-zinc-300 font-bold">
                      <td className="px-4 py-2">{players[s.playerId]?.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-right">{s.rushYds}</td>
                      <td className="px-4 py-2 text-right">{s.rushTDs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {receiving.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-2">Receiving</p>
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-zinc-800/50 text-zinc-500 uppercase font-black">
                  <tr>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-right">Rec</th>
                    <th className="px-4 py-2 text-right">Yds</th>
                    <th className="px-4 py-2 text-right">TD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {receiving.map(s => (
                    <tr key={s.playerId} className="text-zinc-300 font-bold">
                      <td className="px-4 py-2">{players[s.playerId]?.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-right">{s.receptions}</td>
                      <td className="px-4 py-2 text-right">{s.recYds}</td>
                      <td className="px-4 py-2 text-right">{s.recTDs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {defense.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-2">Defense</p>
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-zinc-800/50 text-zinc-500 uppercase font-black">
                  <tr>
                    <th className="px-4 py-2">Player</th>
                    <th className="px-4 py-2 text-right">Tkl</th>
                    <th className="px-4 py-2 text-right">Sck</th>
                    <th className="px-4 py-2 text-right">INT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {defense.map(s => (
                    <tr key={s.playerId} className="text-zinc-300 font-bold">
                      <td className="px-4 py-2">{players[s.playerId]?.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-right">{s.tackles}</td>
                      <td className="px-4 py-2 text-right">{s.sacks}</td>
                      <td className="px-4 py-2 text-right">{s.ints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
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

      {/* Player Stats Section */}
      <div className="space-y-4">
        <button 
          onClick={() => setShowPlayerStats(!showPlayerStats)}
          className="w-full flex items-center justify-between px-6 py-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all"
        >
          <div className="flex items-center gap-2">
            <User size={14} className="text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Individual Player Stats</span>
          </div>
          {showPlayerStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showPlayerStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-8"
            >
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Fetching Player Stats...</p>
                </div>
              ) : playerStats.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No Individual Stats Logged</p>
                </div>
              ) : (
                <>
                  {renderPlayerStatsTable(awayTeam.id, awayTeam.name)}
                  {renderPlayerStatsTable(homeTeam.id, homeTeam.name)}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
