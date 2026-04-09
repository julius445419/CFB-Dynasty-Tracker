import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, MapPin, Clock, Activity, Zap } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { Game, TeamAssignment } from '../../types';
import { TeamLogo } from '../common/TeamLogo';
import { getTeamColor } from '../../utils/teamAssets';
import { useStatLeaders } from '../../hooks/useStatLeaders';

export const HeroMatchup: React.FC = () => {
  const { currentLeagueId, leagueInfo, userTeam } = useLeague();
  const { leaders } = useStatLeaders();
  const [weekGames, setWeekGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamAssignment>>({});
  const [loading, setLoading] = useState(true);

  // Fetch games for the current week
  useEffect(() => {
    if (!currentLeagueId || !leagueInfo) return;

    const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
    const q = query(gamesRef, where('week', '==', leagueInfo.currentWeek));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setWeekGames(games);
    });

    return () => unsubscribe();
  }, [currentLeagueId, leagueInfo?.currentWeek]);

  // Fetch teams for mapping
  useEffect(() => {
    if (!currentLeagueId) return;

    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribe = onSnapshot(teamsRef, (snapshot) => {
      const teamsMap: Record<string, TeamAssignment> = {};
      snapshot.docs.forEach(doc => {
        teamsMap[doc.id] = { id: doc.id, ...doc.data() } as TeamAssignment;
      });
      setTeams(teamsMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId]);

  const gameOfTheWeek = useMemo(() => {
    if (weekGames.length === 0 || Object.keys(teams).length === 0) return null;

    const scoredGames = weekGames.map(game => {
      const homeTeam = teams[game.homeTeamId];
      const awayTeam = teams[game.awayTeamId];
      
      if (!homeTeam || !awayTeam) return { game, score: 999, homeTeam: null, awayTeam: null };

      const homeRank = homeTeam.currentRank || 125;
      const awayRank = awayTeam.currentRank || 125;
      
      let combinedScore = homeRank + awayRank;

      // Override logic: Prioritize user team if it's a "reasonable" matchup
      const isUserInvolved = game.homeTeamId === userTeam?.id || game.awayTeamId === userTeam?.id;
      if (isUserInvolved && combinedScore <= 150) {
        combinedScore -= 100; // Heavy boost to ensure user game is picked if it's even remotely significant
      }

      return { game, score: combinedScore, homeTeam, awayTeam };
    }).filter(g => g.homeTeam && g.awayTeam);

    if (scoredGames.length === 0) return null;

    return scoredGames.sort((a, b) => a.score - b.score)[0];
  }, [weekGames, teams, userTeam?.id]);

  if (loading) {
    return (
      <div className="w-full h-[400px] bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-600/20 border-t-orange-600 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Analyzing Matchups...</p>
        </div>
      </div>
    );
  }

  if (!gameOfTheWeek) {
    return (
      <div className="w-full h-[400px] bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] flex flex-col items-center justify-center text-center p-8">
        <Trophy className="w-16 h-16 text-zinc-800 mb-4" />
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">National Spotlight</h2>
        <p className="text-zinc-500 text-sm mt-2 max-w-md">No major matchups scheduled for Week {leagueInfo?.currentWeek}. Check back soon for the next big game.</p>
      </div>
    );
  }

  const { game, homeTeam, awayTeam } = gameOfTheWeek;
  const homeColor = getTeamColor(homeTeam!.name);
  const awayColor = getTeamColor(awayTeam!.name);

  const homeStats = leaders.find(l => l.teamId === homeTeam?.id);
  const awayStats = leaders.find(l => l.teamId === awayTeam?.id);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-950 shadow-2xl group"
      >
        {/* Atmospheric Background - Dual Team Halos & Vignette */}
        <div 
          className="absolute inset-0 opacity-60 transition-opacity group-hover:opacity-70"
          style={{
            background: `
              radial-gradient(circle at 25% 40%, ${awayColor}55 0%, transparent 70%),
              radial-gradient(circle at 75% 40%, ${homeColor}55 0%, transparent 70%),
              linear-gradient(90deg, ${awayColor}22 0%, transparent 50%, ${homeColor}22 100%)
            `
          }}
        />
        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.95)] pointer-events-none" />
        
        {/* Scanline/Noise Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

        {/* Stadium Background - Muted & Blurred */}
        <div 
          className="absolute inset-0 opacity-[0.05] blur-md pointer-events-none bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1540747913346-19e3ad6466b9?q=80&w=2000&auto=format&fit=crop')" }}
        />

        {/* Matchup Banner */}
        <div className="absolute top-0 left-0 right-0 flex justify-center z-30">
          <div className="bg-orange-600 px-6 py-1 rounded-b-xl shadow-lg shadow-orange-900/40 flex items-center gap-2">
            <Trophy className="w-2.5 h-2.5 text-white" />
            <span className="text-[9px] font-black text-white uppercase tracking-[0.3em]">
              WK {leagueInfo?.currentWeek} • Matchup of the Week
            </span>
          </div>
        </div>

        {/* Main Content Area - Cinematic Vertical Stack */}
        <div className="relative pt-6 pb-2 px-6 md:px-10 flex flex-col items-center gap-2">
          
          {/* Away Team Info - Centered */}
          <div className="w-full flex flex-col items-center text-center z-20">
            <div className="space-y-0">
              <div className="flex items-center justify-center gap-2">
                {awayTeam!.currentRank && awayTeam!.currentRank <= 25 && (
                  <span className="text-lg md:text-2xl font-black text-white italic leading-none drop-shadow-md">#{awayTeam!.currentRank}</span>
                )}
                <h2 className="text-xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-lg whitespace-nowrap">
                  {awayTeam!.name}
                </h2>
              </div>
              <p className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-[0.4em] opacity-90">
                {awayTeam!.conference}
              </p>
            </div>
          </div>

          {/* Central Logo Row - Constrained Width */}
          <div className="relative w-full max-w-xs md:max-w-md flex items-center justify-center gap-3 md:gap-6 z-10">
            {/* Away Logo */}
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <TeamLogo 
                team={awayTeam!} 
                size="xl" 
                className="w-16 h-16 md:w-28 md:h-28 drop-shadow-[0_20px_40px_rgba(0,0,0,1)] grayscale-[0.1] group-hover:grayscale-0 transition-all" 
              />
            </motion.div>

            {/* VS Divider - High Contrast Badge */}
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="z-30 bg-zinc-950/90 backdrop-blur-md border border-white/30 w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)] ring-1 ring-white/10 shrink-0"
            >
              <span className="text-[9px] md:text-base font-black text-white italic tracking-tighter uppercase drop-shadow-sm">VS</span>
            </motion.div>

            {/* Home Logo */}
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <TeamLogo 
                team={homeTeam!} 
                size="xl" 
                className="w-16 h-16 md:w-28 md:h-28 drop-shadow-[0_20px_40px_rgba(0,0,0,1)] grayscale-[0.1] group-hover:grayscale-0 transition-all" 
              />
            </motion.div>
          </div>

          {/* Home Team Info - Centered */}
          <div className="w-full flex flex-col items-center text-center z-20">
            <div className="space-y-0">
              <div className="flex items-center justify-center gap-2">
                {homeTeam!.currentRank && homeTeam!.currentRank <= 25 && (
                  <span className="text-lg md:text-2xl font-black text-white italic leading-none drop-shadow-md">#{homeTeam!.currentRank}</span>
                )}
                <h2 className="text-xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-lg whitespace-nowrap">
                  {homeTeam!.name}
                </h2>
              </div>
              <p className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-[0.4em] opacity-90">
                {homeTeam!.conference}
              </p>
            </div>
          </div>

          {/* Comparison Stats - Responsive Grid */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-12 w-full max-w-xl">
              <div className="flex items-center justify-center gap-4 w-full md:w-auto">
                <div className="flex-1 md:flex-none md:w-16 text-right">
                  <span className="text-sm md:text-xl font-black text-white tabular-nums drop-shadow-md">
                    {awayStats?.ppg?.toFixed(1) || '0.0'}
                  </span>
                </div>
                <div className="px-4 py-1 rounded-full bg-zinc-950/90 backdrop-blur-md border border-white/20 shadow-2xl min-w-[120px] text-center">
                  <span className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-sm whitespace-nowrap">Points Per Game</span>
                </div>
                <div className="flex-1 md:flex-none md:w-16 text-left">
                  <span className="text-sm md:text-xl font-black text-white tabular-nums drop-shadow-md">
                    {homeStats?.ppg?.toFixed(1) || '0.0'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-12 w-full max-w-xl opacity-70">
              <div className="flex items-center justify-center gap-4 w-full md:w-auto">
                <div className="flex-1 md:flex-none md:w-16 text-right">
                  <span className="text-[10px] md:text-base font-black text-zinc-100 tabular-nums">
                    {awayStats?.totalOffYpg?.toFixed(0) || '0'}
                  </span>
                </div>
                <div className="px-4 py-0.5 rounded-full bg-zinc-950/80 border border-white/10 min-w-[120px] text-center">
                  <span className="text-[8px] md:text-[9px] font-black text-zinc-200 uppercase tracking-tighter drop-shadow-sm whitespace-nowrap">Total Offense</span>
                </div>
                <div className="flex-1 md:flex-none md:w-16 text-left">
                  <span className="text-[10px] md:text-base font-black text-zinc-100 tabular-nums">
                    {homeStats?.totalOffYpg?.toFixed(0) || '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Broadcast Pill */}
        <div className="flex justify-center -mb-3.5 relative z-30">
          <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/10 px-5 py-2 rounded-full flex items-center gap-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            <div className="relative flex items-center justify-center">
              <Zap className="w-3 h-3 text-orange-500 fill-orange-500 relative z-10" />
              <div className="absolute inset-0 bg-orange-500 blur-lg opacity-40 animate-pulse" />
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.2em] whitespace-nowrap drop-shadow-sm">
              National Broadcast
            </span>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="mx-6 md:mx-10 border-t border-white/5" />

        {/* Bottom Footer - Centered Location Info */}
        <div className="relative z-20 px-6 md:px-10 pt-2 pb-3">
          <div className="flex flex-col items-center text-center space-y-0.5">
            <div className="flex items-center gap-2 text-white">
              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <h3 className="text-xs md:text-sm font-black uppercase tracking-tight truncate max-w-[280px] md:max-w-none">
                {homeTeam?.stadiumName?.toUpperCase() || 'CAMPUS STADIUM'}
              </h3>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
              {homeTeam?.city && homeTeam?.state 
                ? `${homeTeam.city}, ${homeTeam.state}`.toUpperCase()
                : 'LOCATION TBD'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
