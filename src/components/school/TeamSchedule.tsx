import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, ChevronRight, Trophy, Clock, 
  AlertCircle, CheckCircle2, Loader2, Edit3, Eye, Plus
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, orderBy, 
  doc, writeBatch, serverTimestamp, increment 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { Game, TeamAssignment, TeamStats } from '../../types';
import { TeamLogo } from '../common/TeamLogo';
import { UnifiedStatEntryModal } from '../modals/UnifiedStatEntryModal';
import AddMatchupModal from '../modals/AddMatchupModal';

interface TeamScheduleProps {
  teamId: string;
}

export const TeamSchedule: React.FC<TeamScheduleProps> = ({ teamId }) => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isStatModalOpen, setIsStatModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedByeWeek, setSelectedByeWeek] = useState<number | null>(null);
  const [schedulingSide, setSchedulingSide] = useState<'home' | 'away'>('home');

  useEffect(() => {
    if (!currentLeagueId) return;

    // Fetch all teams for the league to get names/logos
    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      const teamsData: Record<string, TeamAssignment> = {};
      snapshot.forEach((doc) => {
        teamsData[doc.id] = { id: doc.id, ...doc.data() } as TeamAssignment;
      });
      setTeams(teamsData);
    });

    // Fetch games for this team
    const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
    const q = query(
      gamesRef, 
      orderBy('week', 'asc')
    );

    const unsubscribeGames = onSnapshot(q, (snapshot) => {
      const allGames: Game[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Game;
        if (data.homeTeamId === teamId || data.awayTeamId === teamId) {
          // Filter by season in-memory for legacy support
          if (!data.season || data.season === (leagueInfo?.currentYear || 2025)) {
            allGames.push({ id: doc.id, ...data });
          }
        }
      });
      setGames(allGames);
      setLoading(false);
    });

    return () => {
      unsubscribeTeams();
      unsubscribeGames();
    };
  }, [currentLeagueId, teamId, leagueInfo?.currentYear]);

  const handleSaveStats = async (stats: { homeScore: number; awayScore: number; homeStats: TeamStats; awayStats: TeamStats; quarterLengthAtGame?: number }) => {
    if (!selectedGame || !currentLeagueId) return;
    
    const batch = writeBatch(db);
    const gameRef = doc(db, 'leagues', currentLeagueId, 'games', selectedGame.id);
    const homeTeamRef = doc(db, 'leagues', currentLeagueId, 'teams', selectedGame.homeTeamId);
    const awayTeamRef = doc(db, 'leagues', currentLeagueId, 'teams', selectedGame.awayTeamId);

    const isNewResult = selectedGame.status !== 'final';
    const oldHomeScore = Number(selectedGame.homeScore) || 0;
    const oldAwayScore = Number(selectedGame.awayScore) || 0;
    const oldHomeWon = oldHomeScore > oldAwayScore;
    const oldAwayWon = oldAwayScore > oldHomeScore;
    
    const hScore = Number(stats.homeScore) || 0;
    const aScore = Number(stats.awayScore) || 0;
    const newHomeWon = hScore > aScore;
    const newAwayWon = aScore > hScore;

    const hPass = Number(stats.homeStats.passYards) || 0;
    const hRush = Number(stats.homeStats.rushYards) || 0;
    const aPass = Number(stats.awayStats.passYards) || 0;
    const aRush = Number(stats.awayStats.rushYards) || 0;

    const oldHPass = Number(selectedGame.homeStats?.passYards) || 0;
    const oldHRush = Number(selectedGame.homeStats?.rushYards) || 0;
    const oldAPass = Number(selectedGame.awayStats?.passYards) || 0;
    const oldARush = Number(selectedGame.awayStats?.rushYards) || 0;

    batch.update(gameRef, {
      homeScore: hScore,
      awayScore: aScore,
      homeStats: stats.homeStats,
      awayStats: stats.awayStats,
      status: 'final',
      updatedAt: serverTimestamp(),
      quarterLengthAtGame: Number(stats.quarterLengthAtGame) || 0
    });

    // Update Team Records (Bypass for FCS)
    const homeTeam = teams[selectedGame.homeTeamId];
    const awayTeam = teams[selectedGame.awayTeamId];
    const isConfGame = homeTeam?.conference === awayTeam?.conference;

    // Home Team Update
    if (homeTeam && !homeTeam.isFCS) {
      const homeUpdate: any = {
        pointsFor: isNewResult ? increment(hScore) : increment(hScore - oldHomeScore),
        pointsAgainst: isNewResult ? increment(aScore) : increment(aScore - oldAwayScore),
        passYards: isNewResult ? increment(hPass) : increment(hPass - oldHPass),
        rushYards: isNewResult ? increment(hRush) : increment(hRush - oldHRush),
        totalYards: isNewResult ? increment(hPass + hRush) : increment((hPass + hRush) - (oldHPass + oldHRush)),
        passYardsAllowed: isNewResult ? increment(aPass) : increment(aPass - oldAPass),
        rushYardsAllowed: isNewResult ? increment(aRush) : increment(aRush - oldARush),
        totalYardsAllowed: isNewResult ? increment(aPass + aRush) : increment((aPass + aRush) - (oldAPass + oldARush)),
        updatedAt: serverTimestamp()
      };

      if (isNewResult) {
        homeUpdate.wins = newHomeWon ? increment(1) : increment(0);
        homeUpdate.losses = newAwayWon ? increment(1) : increment(0);
        homeUpdate.schoolWins = newHomeWon ? increment(1) : increment(0);
        homeUpdate.schoolLosses = newAwayWon ? increment(1) : increment(0);
        homeUpdate.careerWins = newHomeWon ? increment(1) : increment(0);
        homeUpdate.careerLosses = newAwayWon ? increment(1) : increment(0);
        if (isConfGame) {
          if (newHomeWon) homeUpdate.confWins = increment(1);
          else if (newAwayWon) homeUpdate.confLosses = increment(1);
        }
      } else if (newHomeWon !== oldHomeWon) {
        // Winner changed
        homeUpdate.wins = newHomeWon ? increment(1) : increment(-1);
        homeUpdate.losses = newHomeWon ? increment(-1) : increment(1);
        homeUpdate.schoolWins = newHomeWon ? increment(1) : increment(-1);
        homeUpdate.schoolLosses = newHomeWon ? increment(-1) : increment(1);
        homeUpdate.careerWins = newHomeWon ? increment(1) : increment(-1);
        homeUpdate.careerLosses = newHomeWon ? increment(-1) : increment(1);
        if (isConfGame) {
          homeUpdate.confWins = newHomeWon ? increment(1) : increment(-1);
          homeUpdate.confLosses = newHomeWon ? increment(-1) : increment(1);
        }
      }
      batch.update(homeTeamRef, homeUpdate);
    }

    // Away Team Update
    if (awayTeam && !awayTeam.isFCS) {
      const awayUpdate: any = {
        pointsFor: isNewResult ? increment(aScore) : increment(aScore - oldAwayScore),
        pointsAgainst: isNewResult ? increment(hScore) : increment(hScore - oldHomeScore),
        passYards: isNewResult ? increment(aPass) : increment(aPass - oldAPass),
        rushYards: isNewResult ? increment(aRush) : increment(aRush - oldARush),
        totalYards: isNewResult ? increment(aPass + aRush) : increment((aPass + aRush) - (oldAPass + oldARush)),
        passYardsAllowed: isNewResult ? increment(hPass) : increment(hPass - oldHPass),
        rushYardsAllowed: isNewResult ? increment(hRush) : increment(hRush - oldHRush),
        totalYardsAllowed: isNewResult ? increment(hPass + hRush) : increment((hPass + hRush) - (oldHPass + oldHRush)),
        updatedAt: serverTimestamp()
      };

      if (isNewResult) {
        awayUpdate.wins = newAwayWon ? increment(1) : increment(0);
        awayUpdate.losses = newHomeWon ? increment(1) : increment(0);
        awayUpdate.schoolWins = newAwayWon ? increment(1) : increment(0);
        awayUpdate.schoolLosses = newHomeWon ? increment(1) : increment(0);
        awayUpdate.careerWins = newAwayWon ? increment(1) : increment(0);
        awayUpdate.careerLosses = newHomeWon ? increment(1) : increment(0);
        if (isConfGame) {
          if (newAwayWon) awayUpdate.confWins = increment(1);
          else if (newHomeWon) awayUpdate.confLosses = increment(1);
        }
      } else if (newAwayWon !== oldAwayWon) {
        // Winner changed
        awayUpdate.wins = newAwayWon ? increment(1) : increment(-1);
        awayUpdate.losses = newAwayWon ? increment(-1) : increment(1);
        awayUpdate.schoolWins = newAwayWon ? increment(1) : increment(-1);
        awayUpdate.schoolLosses = newAwayWon ? increment(-1) : increment(1);
        awayUpdate.careerWins = newAwayWon ? increment(1) : increment(-1);
        awayUpdate.careerLosses = newAwayWon ? increment(-1) : increment(1);
        if (isConfGame) {
          awayUpdate.confWins = newAwayWon ? increment(1) : increment(-1);
          awayUpdate.confLosses = newAwayWon ? increment(-1) : increment(1);
        }
      }
      batch.update(awayTeamRef, awayUpdate);
    }

    await batch.commit();
    setIsStatModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="animate-spin text-orange-500" size={32} />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Loading Schedule...</p>
      </div>
    );
  }

  // Calculate BYE weeks - Show at least 15 weeks for a standard season
  const maxScheduledWeek = games.length > 0 ? Math.max(...games.map(g => g.week)) : 0;
  const totalWeeksToShow = Math.max(maxScheduledWeek, 15);
  const scheduleRows = [];
  const nextGame = games.find(g => g.status === 'scheduled');

  for (let w = 0; w <= totalWeeksToShow; w++) {
    const game = games.find(g => g.week === w);
    if (game) {
      scheduleRows.push({ type: 'game', week: w, game });
    } else {
      scheduleRows.push({ type: 'bye', week: w });
    }
  }

  return (
    <div className="space-y-6">
      {/* Next Game Highlight */}
      {nextGame && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-3xl p-6 shadow-xl shadow-orange-900/20 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Calendar size={120} />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest">Next Matchup</span>
              <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Week {nextGame.week}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center gap-2">
                <TeamLogo 
                  team={teams[nextGame.homeTeamId]} 
                  schoolName={nextGame.homeTeamName || nextGame.homeTeamId}
                  size="lg" 
                />
                <span className="text-white font-black text-xs text-center uppercase tracking-tight">
                  {teams[nextGame.homeTeamId]?.name || nextGame.homeTeamName || nextGame.homeTeamId}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-white/40 font-black text-xl italic">VS</span>
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <TeamLogo 
                  team={teams[nextGame.awayTeamId]} 
                  schoolName={nextGame.awayTeamName || nextGame.awayTeamId}
                  size="lg" 
                />
                <span className="text-white font-black text-xs text-center uppercase tracking-tight">
                  {teams[nextGame.awayTeamId]?.name || nextGame.awayTeamName || nextGame.awayTeamId}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedGame(nextGame);
                setIsStatModalOpen(true);
              }}
              className="w-full py-3 bg-white text-orange-600 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-orange-50 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Edit3 size={18} />
              Report Score
            </button>
          </div>
        </motion.div>
      )}

      {/* Full Schedule List */}
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/50 border-b border-zinc-800">
                <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Week</th>
                <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Opponent</th>
                <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Result</th>
                <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {scheduleRows.map((row) => {
                if (row.type === 'bye') {
                  return (
                    <tr key={`bye-${row.week}`} className="bg-zinc-900/20">
                      <td className="px-4 py-4 text-sm font-bold text-zinc-500 italic">Week {row.week}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">BYE WEEK</span>
                      </td>
                      <td className="px-4 py-4"></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedByeWeek(row.week);
                              setSchedulingSide('home');
                              setIsScheduleModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1"
                          >
                            <Plus size={12} />
                            Schedule
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const game = row.game!;
                const isHome = game.homeTeamId === teamId;
                const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
                const opponentName = isHome ? game.awayTeamName : game.homeTeamName;
                const opponent = teams[opponentId];
                const isFinal = game.status === 'final';
                
                let resultText = '---';
                let resultColor = 'text-zinc-500';
                
                if (isFinal) {
                  const myScore = isHome ? game.homeScore : game.awayScore;
                  const oppScore = isHome ? game.awayScore : game.homeScore;
                  const won = myScore > oppScore;
                  resultText = `${won ? 'W' : 'L'} ${myScore}-${oppScore}`;
                  resultColor = won ? 'text-emerald-500' : 'text-red-500';
                }

                return (
                  <tr key={game.id} className={`hover:bg-zinc-800/30 transition-colors group ${game.id === nextGame?.id ? 'bg-orange-600/5' : ''}`}>
                    <td className="px-4 py-4 text-sm font-black text-zinc-400">Wk {game.week}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <TeamLogo 
                          team={opponent} 
                          schoolName={opponentName || opponentId}
                          size="sm" 
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white group-hover:text-orange-500 transition-colors uppercase tracking-tight">
                            {isHome ? 'vs' : '@'} {opponent?.name || opponentName || opponentId}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">{opponent?.conference || 'Non-Conference'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-black uppercase ${resultColor}`}>
                        {resultText}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isFinal ? (
                          <button
                            onClick={() => {
                              setSelectedGame(game);
                              setIsStatModalOpen(true);
                            }}
                            className="p-2 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-all"
                            title="Edit Stats"
                          >
                            <Edit3 size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedGame(game);
                              setIsStatModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all active:scale-95"
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stat Entry Modal */}
      {selectedGame && (
        <UnifiedStatEntryModal
          isOpen={isStatModalOpen}
          onClose={() => setIsStatModalOpen(false)}
          game={selectedGame}
          homeTeam={teams[selectedGame.homeTeamId]}
          awayTeam={teams[selectedGame.awayTeamId]}
          onSave={handleSaveStats}
        />
      )}

      {/* Inline Scheduling Modal */}
      {selectedByeWeek && (
        <AddMatchupModal
          isOpen={isScheduleModalOpen}
          onClose={() => {
            setIsScheduleModalOpen(false);
            setSelectedByeWeek(null);
          }}
          forcedWeek={selectedByeWeek}
          fixedTeam={teams[teamId]}
          initialSide={schedulingSide}
        />
      )}
    </div>
  );
};
