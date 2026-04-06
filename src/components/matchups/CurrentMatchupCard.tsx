import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Calendar, Gamepad2, ChevronRight, Pencil, CheckCircle2 } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../common/TeamLogo';
import { useNavigate } from 'react-router-dom';
import { ReportScoreModal } from './ReportScoreModal';

interface CurrentMatchupCardProps {
  leagueId: string;
  currentWeek: number;
  userTeamId: string;
  isCommissioner?: boolean;
}

export const CurrentMatchupCard: React.FC<CurrentMatchupCardProps> = ({ leagueId, currentWeek, userTeamId, isCommissioner }) => {
  const [game, setGame] = useState<Game | null>(null);
  const [homeTeam, setHomeTeam] = useState<TeamAssignment | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!leagueId || !userTeamId) return;

    setLoading(true);
    const gamesRef = collection(db, 'leagues', leagueId, 'games');
    
    // We need to find a game where week matches AND user is home OR away
    const q = query(gamesRef, where('week', '==', currentWeek));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const userGameDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.homeTeamId === userTeamId || data.awayTeamId === userTeamId;
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
  }, [leagueId, currentWeek, userTeamId]);

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
      />
    </>
  );
};
