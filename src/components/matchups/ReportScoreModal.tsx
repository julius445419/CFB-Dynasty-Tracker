import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, ArrowRight, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, addDoc, collection, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment, ActivityLog } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../common/TeamLogo';

interface ReportScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
  leagueId: string;
  userTeamId: string;
  isAdmin?: boolean;
}

type Step = 'score' | 'stats';

export const ReportScoreModal: React.FC<ReportScoreModalProps> = ({
  isOpen,
  onClose,
  game,
  homeTeam,
  awayTeam,
  leagueId,
  userTeamId,
  isAdmin = false
}) => {
  const isUserHome = game.homeTeamId === userTeamId;
  const [step, setStep] = useState<Step>('score');
  const [activeStatsTab, setActiveStatsTab] = useState<'home' | 'away'>(isUserHome ? 'home' : 'away');
  const [homeScore, setHomeScore] = useState<string>(game.homeScore && !isNaN(game.homeScore) ? game.homeScore.toString() : '0');
  const [awayScore, setAwayScore] = useState<string>(game.awayScore && !isNaN(game.awayScore) ? game.awayScore.toString() : '0');
  
  // Home Stats state
  const [hPassYards, setHPassYards] = useState<string>(game.homeStats?.passYards?.toString() || '');
  const [hRushYards, setHRushYards] = useState<string>(game.homeStats?.rushYards?.toString() || '');
  const [hTurnovers, setHTurnovers] = useState<string>(game.homeStats?.turnovers?.toString() || '');
  const [hTakeaways, setHTakeaways] = useState<string>(game.homeStats?.takeaways?.toString() || '');
  const [hFirstDowns, setHFirstDowns] = useState<string>(game.homeStats?.firstDowns?.toString() || '');
  const [hThirdDownMade, setHThirdDownMade] = useState<string>(game.homeStats?.thirdDownMade?.toString() || '');
  const [hThirdDownAtt, setHThirdDownAtt] = useState<string>(game.homeStats?.thirdDownAtt?.toString() || '');
  const [hTopM, setHTopM] = useState<string>(game.homeStats?.topMinutes?.toString() || (game.homeStats?.timeOfPossession?.split(':')[0] || ''));
  const [hTopS, setHTopS] = useState<string>(game.homeStats?.topSeconds?.toString() || (game.homeStats?.timeOfPossession?.split(':')[1] || ''));

  // Away Stats state
  const [aPassYards, setAPassYards] = useState<string>(game.awayStats?.passYards?.toString() || '');
  const [aRushYards, setARushYards] = useState<string>(game.awayStats?.rushYards?.toString() || '');
  const [aTurnovers, setATurnovers] = useState<string>(game.awayStats?.turnovers?.toString() || '');
  const [aTakeaways, setATakeaways] = useState<string>(game.awayStats?.takeaways?.toString() || '');
  const [aFirstDowns, setAFirstDowns] = useState<string>(game.awayStats?.firstDowns?.toString() || '');
  const [aThirdDownMade, setAThirdDownMade] = useState<string>(game.awayStats?.thirdDownMade?.toString() || '');
  const [aThirdDownAtt, setAThirdDownAtt] = useState<string>(game.awayStats?.thirdDownAtt?.toString() || '');
  const [aTopM, setATopM] = useState<string>(game.awayStats?.topMinutes?.toString() || (game.awayStats?.timeOfPossession?.split(':')[0] || ''));
  const [aTopS, setATopS] = useState<string>(game.awayStats?.topSeconds?.toString() || (game.awayStats?.timeOfPossession?.split(':')[1] || ''));
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateScores = () => {
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError('Scores must be non-negative integers.');
      return false;
    }
    if (h === a) {
      setError('Games cannot end in a tie in college football.');
      return false;
    }
    return true;
  };

  const validateStats = () => {
    const validateTeam = (p: string, r: string, to: string, ta: string, fd: string, tdm: string, tda: string, tm: string, ts: string, teamName: string) => {
      const pi = parseInt(p || '0');
      const ri = parseInt(r || '0');
      const toi = parseInt(to || '0');
      const tai = parseInt(ta || '0');
      const fdi = parseInt(fd || '0');
      const tdmi = parseInt(tdm || '0');
      const tdai = parseInt(tda || '0');
      const tmi = parseInt(tm || '0');
      const tsi = parseInt(ts || '0');
      
      if (isNaN(pi) || isNaN(ri) || isNaN(toi) || isNaN(tai) || isNaN(fdi) || isNaN(tdmi) || isNaN(tdai) || 
          isNaN(tmi) || isNaN(tsi) ||
          pi < 0 || ri < 0 || toi < 0 || tai < 0 || fdi < 0 || tdmi < 0 || tdai < 0 || tmi < 0 || tsi < 0) {
        setError(`Stats for ${teamName} must be non-negative integers.`);
        return false;
      }

      if (tsi >= 60) {
        setError(`Seconds for ${teamName} must be less than 60.`);
        return false;
      }

      if (tdmi > tdai) {
        setError(`3rd down conversions for ${teamName} cannot exceed attempts.`);
        return false;
      }

      return true;
    };

    if (!validateTeam(hPassYards, hRushYards, hTurnovers, hTakeaways, hFirstDowns, hThirdDownMade, hThirdDownAtt, hTopM, hTopS, homeTeam.name)) return false;
    if (!validateTeam(aPassYards, aRushYards, aTurnovers, aTakeaways, aFirstDowns, aThirdDownMade, aThirdDownAtt, aTopM, aTopS, awayTeam.name)) return false;

    return true;
  };

  const handleFinalize = async (includeStats: boolean) => {
    setError(null);
    if (!validateScores()) return;
    if (includeStats && !validateStats()) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const gameRef = doc(db, 'leagues', leagueId, 'games', game.id);
      const homeTeamRef = doc(db, 'leagues', leagueId, 'teams', game.homeTeamId);
      const awayTeamRef = doc(db, 'leagues', leagueId, 'teams', game.awayTeamId);

      const hScore = parseInt(homeScore) || 0;
      const aScore = parseInt(awayScore) || 0;

      const updateData: any = {
        homeScore: hScore,
        awayScore: aScore,
        status: 'final',
        updatedAt: serverTimestamp(),
      };

      const hStats = {
        passYards: parseInt(hPassYards || '0'),
        rushYards: parseInt(hRushYards || '0'),
        turnovers: parseInt(hTurnovers || '0'),
        takeaways: parseInt(hTakeaways || '0'),
        firstDowns: parseInt(hFirstDowns || '0'),
        thirdDownMade: parseInt(hThirdDownMade || '0'),
        thirdDownAtt: parseInt(hThirdDownAtt || '0'),
        topMinutes: parseInt(hTopM || '0'),
        topSeconds: parseInt(hTopS || '0'),
        timeOfPossession: `${hTopM.padStart(2, '0')}:${hTopS.padStart(2, '0')}`,
        updatedAt: serverTimestamp(),
      };

      const aStats = {
        passYards: parseInt(aPassYards || '0'),
        rushYards: parseInt(aRushYards || '0'),
        turnovers: parseInt(aTurnovers || '0'),
        takeaways: parseInt(aTakeaways || '0'),
        firstDowns: parseInt(aFirstDowns || '0'),
        thirdDownMade: parseInt(aThirdDownMade || '0'),
        thirdDownAtt: parseInt(aThirdDownAtt || '0'),
        topMinutes: parseInt(aTopM || '0'),
        topSeconds: parseInt(aTopS || '0'),
        timeOfPossession: `${aTopM.padStart(2, '0')}:${aTopS.padStart(2, '0')}`,
        updatedAt: serverTimestamp(),
      };

      if (includeStats) {
        updateData.homeStats = hStats;
        updateData.awayStats = aStats;
      }

      batch.update(gameRef, updateData);

      // Update Team Records (Bypass for FCS)
      const isConfGame = homeTeam.conference === awayTeam.conference;
      
      // Home Team Update
      if (!homeTeam.isFCS) {
        const homeUpdate: any = {
          wins: hScore > aScore ? increment(1) : increment(0),
          losses: aScore > hScore ? increment(1) : increment(0),
          updatedAt: serverTimestamp(),
          pointsFor: increment(hScore),
          pointsAgainst: increment(aScore),
        };

        if (isConfGame) {
          if (hScore > aScore) homeUpdate.confWins = increment(1);
          else if (aScore > hScore) homeUpdate.confLosses = increment(1);
        }

        if (includeStats) {
          homeUpdate.passYards = increment(hStats.passYards);
          homeUpdate.rushYards = increment(hStats.rushYards);
          homeUpdate.totalYards = increment(hStats.passYards + hStats.rushYards);
          homeUpdate.passYardsAllowed = increment(aStats.passYards);
          homeUpdate.rushYardsAllowed = increment(aStats.rushYards);
          homeUpdate.totalYardsAllowed = increment(aStats.passYards + aStats.rushYards);
        }

        batch.update(homeTeamRef, homeUpdate);
      }

      // Away Team Update
      if (!awayTeam.isFCS) {
        const awayUpdate: any = {
          wins: aScore > hScore ? increment(1) : increment(0),
          losses: hScore > aScore ? increment(1) : increment(0),
          updatedAt: serverTimestamp(),
          pointsFor: increment(aScore),
          pointsAgainst: increment(hScore),
        };

        if (isConfGame) {
          if (aScore > hScore) awayUpdate.confWins = increment(1);
          else if (hScore > aScore) awayUpdate.confLosses = increment(1);
        }

        if (includeStats) {
          awayUpdate.passYards = increment(aStats.passYards);
          awayUpdate.rushYards = increment(aStats.rushYards);
          awayUpdate.totalYards = increment(aStats.passYards + aStats.rushYards);
          awayUpdate.passYardsAllowed = increment(hStats.passYards);
          awayUpdate.rushYardsAllowed = increment(hStats.rushYards);
          awayUpdate.totalYardsAllowed = increment(hStats.passYards + hStats.rushYards);
        }

        batch.update(awayTeamRef, awayUpdate);
      }

      await batch.commit();

      // Log Activity
      const winner = hScore > aScore ? homeTeam.name : awayTeam.name;
      const loser = hScore > aScore ? awayTeam.name : homeTeam.name;
      const winScore = Math.max(hScore, aScore);
      const loseScore = Math.min(hScore, aScore);

      const activityRef = collection(db, 'leagues', leagueId, 'activity_logs');
      await addDoc(activityRef, {
        leagueId,
        type: 'game_result',
        title: 'Game Finalized',
        description: `${winner} defeated ${loser} ${winScore}-${loseScore}`,
        timestamp: serverTimestamp(),
        metadata: {
          gameId: game.id,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          isHumanInvolved: true,
          isUvU: game.isUvU,
          week: game.week,
          season: game.season
        }
      });

      onClose();
    } catch (err) {
      console.error("Error reporting score:", err);
      setError('Failed to save score. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[40px] p-6 sm:p-8 z-[110] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 blur-[100px] -z-10" />
            
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Report Score</h2>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Week {game.week} Matchup</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {step === 'score' ? (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-8 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">VS</span>
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="space-y-4 text-center">
                    <div className={`w-20 h-20 bg-zinc-900 rounded-3xl p-3 border border-zinc-800 mx-auto ${awayTeam.isFCS ? 'opacity-40 grayscale' : ''}`}>
                      <TeamLogo schoolName={awayTeam.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase tracking-widest block ${awayTeam.isFCS ? 'text-zinc-600 italic' : 'text-zinc-500'}`}>
                        {awayTeam.name}
                        {awayTeam.isFCS && ' (FCS)'}
                      </label>
                      <input
                        type="number"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 text-center text-3xl font-black text-white focus:border-orange-500 focus:ring-0 transition-all"
                      />
                    </div>
                  </div>

                  {/* Home Team */}
                  <div className="space-y-4 text-center">
                    <div className={`w-20 h-20 bg-zinc-900 rounded-3xl p-3 border border-zinc-800 mx-auto ${homeTeam.isFCS ? 'opacity-40 grayscale' : ''}`}>
                      <TeamLogo schoolName={homeTeam.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase tracking-widest block ${homeTeam.isFCS ? 'text-zinc-600 italic' : 'text-zinc-500'}`}>
                        {homeTeam.name}
                        {homeTeam.isFCS && ' (FCS)'}
                      </label>
                      <input
                        type="number"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 text-center text-3xl font-black text-white focus:border-orange-500 focus:ring-0 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-medium">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className={`grid grid-cols-1 ${isAdmin ? '' : 'sm:grid-cols-2'} gap-4`}>
                  <button
                    onClick={() => handleFinalize(false)}
                    disabled={isSubmitting}
                    className="bg-zinc-100 hover:bg-white text-zinc-950 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Save & Finish
                      </>
                    )}
                  </button>
                  {!isAdmin && (
                    <button
                      onClick={() => {
                        if (validateScores()) setStep('stats');
                      }}
                      className="bg-zinc-900 border border-zinc-800 text-white font-black py-4 rounded-2xl hover:bg-zinc-800 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                    >
                      Add Stats
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {/* Team Tabs for Stats */}
                <div className="flex p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
                  <button
                    onClick={() => setActiveStatsTab('away')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeStatsTab === 'away' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    {awayTeam.name}
                  </button>
                  <button
                    onClick={() => setActiveStatsTab('home')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeStatsTab === 'home' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'
                    }`}
                  >
                    {homeTeam.name}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Passing Yards</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={activeStatsTab === 'home' ? hPassYards : aPassYards}
                      onChange={(e) => activeStatsTab === 'home' ? setHPassYards(e.target.value) : setAPassYards(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Rushing Yards</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={activeStatsTab === 'home' ? hRushYards : aRushYards}
                      onChange={(e) => activeStatsTab === 'home' ? setHRushYards(e.target.value) : setARushYards(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Turnovers</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={activeStatsTab === 'home' ? hTurnovers : aTurnovers}
                      onChange={(e) => activeStatsTab === 'home' ? setHTurnovers(e.target.value) : setATurnovers(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Takeaways</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={activeStatsTab === 'home' ? hTakeaways : aTakeaways}
                      onChange={(e) => activeStatsTab === 'home' ? setHTakeaways(e.target.value) : setATakeaways(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">First Downs</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={activeStatsTab === 'home' ? hFirstDowns : aFirstDowns}
                      onChange={(e) => activeStatsTab === 'home' ? setHFirstDowns(e.target.value) : setAFirstDowns(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">3rd Down (Made/Att)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="M"
                        value={activeStatsTab === 'home' ? hThirdDownMade : aThirdDownMade}
                        onChange={(e) => activeStatsTab === 'home' ? setHThirdDownMade(e.target.value) : setAThirdDownMade(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                      />
                      <span className="text-zinc-700 font-black">/</span>
                      <input
                        type="number"
                        placeholder="A"
                        value={activeStatsTab === 'home' ? hThirdDownAtt : aThirdDownAtt}
                        onChange={(e) => activeStatsTab === 'home' ? setHThirdDownAtt(e.target.value) : setAThirdDownAtt(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Time of Possession (M:S)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="MM"
                        value={activeStatsTab === 'home' ? hTopM : aTopM}
                        onChange={(e) => activeStatsTab === 'home' ? setHTopM(e.target.value) : setATopM(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                      />
                      <span className="text-zinc-700 font-black">:</span>
                      <input
                        type="number"
                        placeholder="SS"
                        value={activeStatsTab === 'home' ? hTopS : aTopS}
                        onChange={(e) => activeStatsTab === 'home' ? setHTopS(e.target.value) : setATopS(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-medium">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleFinalize(true)}
                    disabled={isSubmitting}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Trophy className="w-4 h-4" />
                        Finalize Game
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setStep('score')}
                    className="w-full text-zinc-500 hover:text-white font-bold py-2 text-[10px] uppercase tracking-widest transition-colors"
                  >
                    Back to Score
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
