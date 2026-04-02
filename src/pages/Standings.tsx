import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Loader2, Calendar, ChevronRight, Globe, Shield, Ghost } from 'lucide-react';
import { useLeague } from '../context/LeagueContext';
import { useStandings, TeamStanding } from '../hooks/useStandings';
import { getTeamLogo } from '../utils/teamAssets';
import { SCHOOLS } from '../constants/schools';

export const Standings: React.FC = () => {
  const { currentLeagueId, userTeam, loading: leagueLoading } = useLeague();
  const { standings, loading, lastUpdated } = useStandings(currentLeagueId);
  const [selectedConference, setSelectedConference] = useState<string>('SEC');

  const conferences = useMemo(() => {
    const confs = Array.from(new Set(SCHOOLS.map(s => s.conference)));
    return confs.sort();
  }, []);

  const filteredStandings = useMemo(() => {
    return standings
      .filter(team => team.conference === selectedConference)
      .sort((a, b) => {
        if (b.confWinPct !== a.confWinPct) return b.confWinPct - a.confWinPct;
        if (b.confWins !== a.confWins) return b.confWins - a.confWins;
        if (b.totalWinPct !== a.totalWinPct) return b.totalWinPct - a.totalWinPct;
        return b.totalWins - a.totalWins;
      });
  }, [standings, selectedConference]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'No games played';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (leagueLoading || loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Calculating Standings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
            <Trophy className="text-orange-500" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight">Conference <span className="text-orange-600">Standings</span></h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Real-time League Rankings</p>
          </div>
        </div>
      </header>

      {/* Conference Navigation */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 mb-6">
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto no-scrollbar flex items-center gap-2 py-4">
          {conferences.map(conf => (
            <button
              key={conf}
              onClick={() => setSelectedConference(conf)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                selectedConference === conf
                  ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {conf}
            </button>
          ))}
        </div>
      </div>

      {/* Standings Table */}
      <main className="max-w-7xl mx-auto px-4">
        <div className="bg-zinc-900/40 backdrop-blur-xl rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800">
                  <th className="px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center w-12">Rank</th>
                  <th className="px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Team</th>
                  <th className="px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">
                    <span className="hidden sm:inline">Conference</span>
                    <span className="sm:hidden">CONF</span>
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">
                    <span className="hidden sm:inline">Overall</span>
                    <span className="sm:hidden">OVR</span>
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Streak</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="wait">
                  {filteredStandings.map((team, index) => {
                    const isUserTeam = userTeam?.school === team.name;
                    return (
                      <motion.tr
                        key={team.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                        className={`border-b border-zinc-800/50 last:border-0 transition-colors ${
                          isUserTeam ? 'bg-orange-600/5' : 'hover:bg-zinc-800/30'
                        }`}
                      >
                        <td className="px-4 py-5 text-center">
                          <span className={`text-sm font-black ${index < 4 ? 'text-orange-500' : 'text-zinc-500'}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 p-1.5">
                              <img 
                                src={getTeamLogo(team.name)} 
                                alt={team.name} 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-black uppercase tracking-tight ${isUserTeam ? 'text-orange-500' : 'text-white'}`}>
                                  {team.name}
                                </span>
                                {isUserTeam && (
                                  <span className="px-1.5 py-0.5 bg-orange-600 text-white text-[8px] font-black rounded uppercase tracking-widest">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {team.ownerId && !team.isPlaceholder ? (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                    <Users size={10} className="text-green-500" />
                                    {team.coachName}
                                  </div>
                                ) : team.isPlaceholder ? (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                    <Ghost size={10} />
                                    {team.coachName}
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">CPU</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <span className="text-sm font-black text-white">
                            {team.confWins}-{team.confLosses}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <span className="text-sm font-bold text-zinc-400">
                            {team.totalWins}-{team.totalLosses}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${
                            team.streak.startsWith('W') 
                              ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                              : team.streak.startsWith('L')
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                          }`}>
                            {team.streak}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Last Updated Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 text-zinc-600">
            <Calendar size={12} />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
              Last Updated: {formatDate(lastUpdated)}
            </p>
          </div>
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            Standings update automatically after every game
          </p>
        </div>
      </main>
    </div>
  );
};
