import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { doc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../common/TeamLogo';

interface ScoreEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
}

const ScoreEntryModal: React.FC<ScoreEntryModalProps> = ({
  isOpen,
  onClose,
  game,
  homeTeam,
  awayTeam
}) => {
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const hScore = parseInt(homeScore);
    const aScore = parseInt(awayScore);

    if (isNaN(hScore) || isNaN(aScore)) {
      setError('Please enter valid scores for both teams.');
      return;
    }

    if (hScore < 0 || aScore < 0) {
      setError('Scores cannot be negative.');
      return;
    }

    if (hScore === aScore) {
      setError('Games cannot end in a tie in college football.');
      return;
    }

    setIsSubmitting(true);

    try {
      const batch = writeBatch(db);
      const gameRef = doc(db, 'leagues', game.leagueId, 'games', game.id);
      const homeTeamRef = doc(db, 'leagues', game.leagueId, 'teams', game.homeTeamId);
      const awayTeamRef = doc(db, 'leagues', game.leagueId, 'teams', game.awayTeamId);

      batch.update(gameRef, {
        homeScore: hScore,
        awayScore: aScore,
        status: 'final',
        updatedAt: serverTimestamp()
      });

      // Update Team Records (Bypass for FCS)
      const isConfGame = homeTeam.conference === awayTeam.conference;

      // Home Team Update
      if (!homeTeam.isFCS) {
        const homeUpdate: any = {
          wins: hScore > aScore ? increment(1) : increment(0),
          losses: aScore > hScore ? increment(1) : increment(0),
          pointsFor: increment(hScore),
          pointsAgainst: increment(aScore),
          updatedAt: serverTimestamp()
        };
        if (isConfGame) {
          if (hScore > aScore) homeUpdate.confWins = increment(1);
          else if (aScore > hScore) homeUpdate.confLosses = increment(1);
        }
        batch.update(homeTeamRef, homeUpdate);
      }

      // Away Team Update
      if (!awayTeam.isFCS) {
        const awayUpdate: any = {
          wins: aScore > hScore ? increment(1) : increment(0),
          losses: hScore > aScore ? increment(1) : increment(0),
          pointsFor: increment(aScore),
          pointsAgainst: increment(hScore),
          updatedAt: serverTimestamp()
        };
        if (isConfGame) {
          if (aScore > hScore) awayUpdate.confWins = increment(1);
          else if (hScore > aScore) awayUpdate.confLosses = increment(1);
        }
        batch.update(awayTeamRef, awayUpdate);
      }

      await batch.commit();
      onClose();
    } catch (err) {
      console.error("Error updating score:", err);
      setError('Failed to update score. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] z-[70] max-h-[92vh] overflow-y-auto custom-scrollbar"
          >
            <div className="p-6 pb-24 max-w-lg mx-auto">
              {/* Handle */}
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-orange-500" />
                  Log Final Score
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-2 gap-6 relative">
                  {/* VS Divider */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
                      <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">VS</span>
                    </div>
                  </div>

                  {/* Away Team Input */}
                  <div className="space-y-4 text-center">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl p-3 mx-auto flex items-center justify-center shadow-xl border border-zinc-800">
                      <TeamLogo 
                        schoolName={awayTeam.name} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{awayTeam.name}</p>
                      <input
                        type="number"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl py-4 text-center text-3xl font-black text-white focus:border-orange-500 focus:ring-0 transition-all placeholder:text-zinc-800"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Home Team Input */}
                  <div className="space-y-4 text-center">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl p-3 mx-auto flex items-center justify-center shadow-xl border border-zinc-800">
                      <TeamLogo 
                        schoolName={homeTeam.name} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{homeTeam.name}</p>
                      <input
                        type="number"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl py-4 text-center text-3xl font-black text-white focus:border-orange-500 focus:ring-0 transition-all placeholder:text-zinc-800"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      Confirm Score
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ScoreEntryModal;
