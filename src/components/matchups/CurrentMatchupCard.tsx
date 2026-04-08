import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, Gamepad2, ChevronRight, Pencil, CheckCircle2, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment, League } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../common/TeamLogo';
import { useNavigate } from 'react-router-dom';
import { ReportScoreModal } from './ReportScoreModal';
import { useStatLeaders } from '../../hooks/useStatLeaders';

interface CurrentMatchupCardProps {
  leagueId: string;
  currentWeek: number;
  userTeamId: string;
  isCommissioner?: boolean;
  leagueInfo?: League | null;
}

export const CurrentMatchupCard: React.FC<CurrentMatchupCardProps> = ({ leagueId, currentWeek, userTeamId, isCommissioner, leagueInfo }) => {
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<TeamAssignment | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { leaders } = useStatLeaders();
  const navigate = useNavigate();

  useEffect(() => {
    if (!leagueId || !userTeamId) return;

    setLoading(true);
    const gamesRef = collection(db, 'leagues', leagueId, 'games');
    
    // We need to find a game where week matches AND user is home OR away
    const q = query(
      gamesRef, 
      where('week', '==', currentWeek)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const userGameDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        const isUserTeam = data.homeTeamId === userTeamId || data.awayTeamId === userTeamId;
        const isCurrentSeason = !data.season || data.season === (leagueInfo?.currentYear || 2025);
        return isUserTeam && isCurrentSeason;
      });

      if (userGameDoc) {
        const gameData = { id: userGameDoc.id, ...userGameDoc.data() } as Game;
        setGame(gameData);

        // Fetch team details
        const homeRef = doc(db, 'leagues', leagueId, 'teams', gameData.homeTeamId);
        const awayRef = doc(db, 'leagues', leagueId, 'teams', gameData.awayTeamId);

        const [homeSnap, awaySnap] = await Promise.all([getDoc(homeRef), getDoc(awayRef)]);

        if (homeSnap.exists()) setHomeTeam({ id: homeSnap.id, ...homeSnap.data() } as TeamAssignment);
        if (awaySnap.exists()) setAwayTeam({ id: awaySnap.id, ...awaySnap.data() } as TeamAssignment);
      } else {
        setGame(null);
        setHomeTeam(null);
        setAwayTeam(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching current matchup:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [leagueId, currentWeek, userTeamId, leagueInfo?.currentYear]);

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-8 animate-pulse">
        <div className="h-4 w-24 bg-zinc-800 rounded mb-4" />
        <div className="flex items-center justify-between">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl" />
          <div className="w-8 h-4 bg-zinc-800 rounded" />
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!game || !homeTeam || !awayTeam) {
    return (
      <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center">
          <Calendar className="w-8 h-8 text-zinc-600" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white uppercase italic">Bye Week</h3>
          <p className="text-zinc-500 font-medium">No matchup scheduled for Week {currentWeek}.</p>
        </div>
      </div>
    );
  }

  const isUserHome = game.homeTeamId === userTeamId;
  const opponent = isUserHome ? awayTeam : homeTeam;
  const userTeamData = isUserHome ? homeTeam : awayTeam;
  const isFinal = game.status === 'final';

  const scoutingStats = useMemo(() => {
    if (!leaders || leaders.length === 0 || !homeTeam || !awayTeam) return null;

    const categories = [
      { label: 'Points Per Game', field: 'ppg', order: 'desc' },
      { label: 'Total Offense', field: 'totalOffYpg', order: 'desc' },
      { label: 'Passing YPG', field: 'passYpg', order: 'desc' },
      { label: 'Rushing YPG', field: 'rushYpg', order: 'desc' },
      { label: 'Points Allowed', field: 'papg', order: 'asc' },
      { label: 'Total Defense', field: 'defTotalYpgAllowed', order: 'asc' },
      { label: 'Pass Def YPG', field: 'defPassYpgAllowed', order: 'asc' },
      { label: 'Rush Def YPG', field: 'defRushYpgAllowed', order: 'asc' },
    ];

    return categories.map(cat => {
      const sorted = [...leaders].sort((a, b) => {
        const valA = (a as any)[cat.field] || 0;
        const valB = (b as any)[cat.field] || 0;
        return cat.order === 'desc' ? valB - valA : valA - valB;
      });

      const getTeamRank = (tid: string) => {
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
          const val = (sorted[i] as any)[cat.field] || 0;
          if (i > 0 && val !== ((sorted[i - 1] as any)[cat.field] || 0)) {
            rank = i + 1;
          }
          if (sorted[i].teamId === tid) return { rank, val };
        }
        return { rank: 'NR', val: 0 };
      };

      const teamA = getTeamRank(homeTeam.id);
      const teamB = getTeamRank(awayTeam.id);

      return {
        label: cat.label,
        teamA,
        teamB,
        better: cat.order === 'desc' ? (teamA.val > teamB.val ? 'A' : 'B') : (teamA.val < teamB.val ? 'A' : 'B')
      };
    });
  }, [leaders, homeTeam?.id, awayTeam?.id]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-2xl group"
      >
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] -z-10" />
        
        <div className="flex flex-col space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 ${isFinal ? 'bg-green-600/10 text-green-500 border-green-600/20' : 'bg-orange-600/10 text-orange-500 border-orange-600/20'} text-[10px] font-black rounded-full uppercase tracking-widest border flex items-center gap-1`}>
                {isFinal && <CheckCircle2 className="w-3 h-3" />}
                {isFinal ? 'Final Score' : `Week ${currentWeek} Matchup`}
              </span>
              {game.isUvU && (
                <span className="px-3 py-1 bg-blue-600/10 text-blue-500 text-[10px] font-black rounded-full uppercase tracking-widest border border-blue-600/20 flex items-center gap-1">
                  <Gamepad2 className="w-3 h-3" />
                  User vs User
                </span>
              )}
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              {isUserHome ? 'Home Game' : 'Away Game'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* User Team */}
            <div className="flex-1 flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 bg-zinc-950 rounded-3xl p-3 border border-zinc-800 shadow-inner group-hover:scale-105 transition-transform relative">
                <TeamLogo 
                  schoolName={userTeamData.name} 
                  className="w-full h-full object-contain"
                />
                {isFinal && (
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full border-2 border-zinc-900 flex items-center justify-center font-black text-xs ${isUserHome ? ((game.homeScore || 0) > (game.awayScore || 0) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400') : ((game.awayScore || 0) > (game.homeScore || 0) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400')}`}>
                    {isUserHome ? (game.homeScore || 0) : (game.awayScore || 0)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white uppercase italic tracking-tight">{userTeamData.name}</h4>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Your Team</p>
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <span className="text-2xl font-black text-zinc-700 italic">VS</span>
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
            </div>

            {/* Opponent Team */}
            <div className="flex-1 flex flex-col items-center text-center space-y-3">
              <div className="w-20 h-20 bg-zinc-950 rounded-3xl p-3 border border-zinc-800 shadow-inner group-hover:scale-105 transition-transform relative">
                <TeamLogo 
                  schoolName={opponent.name} 
                  className="w-full h-full object-contain"
                />
                {isFinal && (
                  <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full border-2 border-zinc-900 flex items-center justify-center font-black text-xs ${!isUserHome ? ((game.homeScore || 0) > (game.awayScore || 0) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400') : ((game.awayScore || 0) > (game.homeScore || 0) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400')}`}>
                    {!isUserHome ? (game.homeScore || 0) : (game.awayScore || 0)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white uppercase italic tracking-tight">{opponent.name}</h4>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                  {opponent.coachName === 'CPU Controlled' ? 'CPU' : opponent.coachName}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            {!isFinal && (
              <>
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full py-3 bg-zinc-950/50 hover:bg-zinc-950 rounded-xl flex items-center justify-center gap-2 transition-colors group border border-zinc-800/50"
                >
                  <Activity size={14} className="text-orange-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Scouting Report</span>
                  {isExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                </button>

                <AnimatePresence>
                  {isExpanded && scoutingStats && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="py-4 space-y-3 bg-zinc-950/30 rounded-xl border border-zinc-800/30 px-4 mt-1">
                        {scoutingStats.map((stat, idx) => (
                          <div key={idx} className="grid grid-cols-5 items-center gap-2">
                            {/* Home Team Stat */}
                            <div className="col-span-2 flex items-center justify-end gap-2">
                              <span className="text-[9px] font-black text-zinc-600">#{stat.teamA.rank}</span>
                              <span className={`text-xs font-black ${stat.better === 'A' ? 'text-orange-500' : 'text-zinc-400'}`}>
                                {stat.teamA.val.toFixed(1)}
                              </span>
                            </div>

                            {/* Label */}
                            <div className="text-center px-1">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">
                                {stat.label}
                              </span>
                            </div>

                            {/* Away Team Stat */}
                            <div className="col-span-2 flex items-center justify-start gap-2">
                              <span className={`text-xs font-black ${stat.better === 'B' ? 'text-orange-500' : 'text-zinc-400'}`}>
                                {stat.teamB.val.toFixed(1)}
                              </span>
                              <span className="text-[9px] font-black text-zinc-600">#{stat.teamB.rank}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {!isFinal ? (
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="w-full bg-white text-zinc-950 font-black py-4 rounded-2xl hover:bg-zinc-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl shadow-white/5"
              >
                <Trophy className="w-4 h-4" />
                Report Score
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-600/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Game Completed</p>
                    <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Stats have been recorded</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-white italic">
                    {game.homeScore || 0} - {game.awayScore || 0}
                  </p>
                </div>
              </div>
            )}
            
            {isCommissioner && (
              <button 
                onClick={() => navigate(`/admin/schedule?editGameId=${game.id}`)}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-black py-3 rounded-2xl hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
              >
                <Pencil className="w-3 h-3" />
                Edit Matchup
              </button>
            )}

            {!isFinal && (
              <p className="text-[10px] text-center text-zinc-500 font-bold uppercase tracking-widest">
                Score reporting opens once game starts
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <ReportScoreModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        game={game}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        leagueId={leagueId}
        userTeamId={userTeamId}
        quarterLength={leagueInfo?.settings?.quarterLength}
      />
    </>
  );
};
