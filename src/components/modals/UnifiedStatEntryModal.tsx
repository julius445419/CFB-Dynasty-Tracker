import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy } from 'lucide-react';
import { Game, TeamAssignment, TeamStats, LeagueSettings } from '../../types';
import { TeamLogo } from '../common/TeamLogo';

interface UnifiedStatEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
  onSave: (stats: { homeScore: number; awayScore: number; homeStats: TeamStats; awayStats: TeamStats; quarterLengthAtGame?: number }) => Promise<void>;
  leagueSettings?: LeagueSettings;
}

export const UnifiedStatEntryModal: React.FC<UnifiedStatEntryModalProps> = ({
  isOpen,
  onClose,
  game,
  homeTeam,
  awayTeam,
  onSave,
  leagueSettings,
}) => {
  const defaultStats: TeamStats = {
    passYards: 0, rushYards: 0, turnovers: 0, takeaways: 0,
    firstDowns: 0, thirdDownMade: 0, thirdDownAtt: 0,
    totalPlays: 0, rushingAttempts: 0, rushingTds: 0, completions: 0,
    passingAttempts: 0, passingTds: 0, fourthDownConversions: 0,
    fourthDownAttempts: 0, twoPointConversions: 0, twoPointAttempts: 0,
    fumblesLost: 0, interceptionsThrown: 0, penalties: 0, penaltyYards: 0,
    timeOfPossession: '00:00'
  };

  const [homeScore, setHomeScore] = useState<string>(game.homeScore?.toString() || '');
  const [awayScore, setAwayScore] = useState<string>(game.awayScore?.toString() || '');
  const [homeStats, setHomeStats] = useState<TeamStats>(game.homeStats || { ...defaultStats });
  const [awayStats, setAwayStats] = useState<TeamStats>(game.awayStats || { ...defaultStats });

  React.useEffect(() => {
    setHomeScore(game.homeScore?.toString() || '');
    setAwayScore(game.awayScore?.toString() || '');
    setHomeStats(game.homeStats || { ...defaultStats });
    setAwayStats(game.awayStats || { ...defaultStats });
  }, [game]);


  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStats = (team: 'home' | 'away', field: keyof TeamStats, value: any) => {
    const setter = team === 'home' ? setHomeStats : setAwayStats;
    setter(prev => {
      const numericValue = field !== 'timeOfPossession' ? Number(value) : value;
      const updated = { ...prev, [field]: numericValue };
      
      // Auto-calculate Total Plays
      if (field === 'rushingAttempts' || field === 'passingAttempts') {
        updated.totalPlays = (Number(updated.rushingAttempts) || 0) + (Number(updated.passingAttempts) || 0);
      }
      
      // Auto-calculate Turnovers
      if (field === 'fumblesLost' || field === 'interceptionsThrown') {
        updated.turnovers = (Number(updated.fumblesLost) || 0) + (Number(updated.interceptionsThrown) || 0);
      }
      
      return updated;
    });
  };

  const handleTOPChange = (team: 'home' | 'away', value: string) => {
    // 1. Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    
    // 2. Remove leading zeros, but keep at least one digit if the value is 0
    let cleaned = numericValue.replace(/^0+/, '');
    if (cleaned === '' && numericValue !== '') cleaned = '0';

    // 3. Format
    let formatted = cleaned;
    if (cleaned.length > 2) {
      // Place colon 2 digits from the right
      const splitPoint = cleaned.length - 2;
      formatted = `${cleaned.slice(0, splitPoint)}:${cleaned.slice(splitPoint)}`;
    }
    
    updateStats(team, 'timeOfPossession', formatted);
  };

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
      // Calculate takeaways based on opponent turnovers
      const finalHomeStats = { ...homeStats, takeaways: awayStats.turnovers || 0 };
      const finalAwayStats = { ...awayStats, takeaways: homeStats.turnovers || 0 };
      await onSave({ 
        homeScore: hScore, 
        awayScore: aScore, 
        homeStats: finalHomeStats, 
        awayStats: finalAwayStats,
        quarterLengthAtGame: leagueSettings?.quarterLength
      });
      onClose();
    } catch (err) {
      setError('Failed to save stats.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statFields: { label: string; field: keyof TeamStats; type?: 'number' | 'text' }[] = [
    { label: 'First Downs', field: 'firstDowns', type: 'number' },
    { label: 'Total Plays', field: 'totalPlays', type: 'number' },
    { label: 'Rushing Attempts', field: 'rushingAttempts', type: 'number' },
    { label: 'Rushing Yards', field: 'rushYards', type: 'number' },
    { label: 'Rushing TDs', field: 'rushingTds', type: 'number' },
    { label: 'Completions', field: 'completions', type: 'number' },
    { label: 'Passing Attempts', field: 'passingAttempts', type: 'number' },
    { label: 'Passing TDs', field: 'passingTds', type: 'number' },
    { label: 'Passing Yards', field: 'passYards', type: 'number' },
    { label: '3rd Down Attempts', field: 'thirdDownAtt', type: 'number' },
    { label: '3rd Down Conversions', field: 'thirdDownMade', type: 'number' },
    { label: '4th Down Attempts', field: 'fourthDownAttempts', type: 'number' },
    { label: '4th Down Conversions', field: 'fourthDownConversions', type: 'number' },
    { label: '2 Point Attempts', field: 'twoPointAttempts', type: 'number' },
    { label: '2 Point Conversions', field: 'twoPointConversions', type: 'number' },
    { label: 'Fumbles Lost', field: 'fumblesLost', type: 'number' },
    { label: 'Interceptions Thrown', field: 'interceptionsThrown', type: 'number' },
    { label: 'Penalties', field: 'penalties', type: 'number' },
    { label: 'Penalty Yards', field: 'penaltyYards', type: 'number' },
    { label: 'Time of Possession', field: 'timeOfPossession', type: 'text' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] z-[70] max-h-[92vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 pb-24 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-orange-500" />
                  Log Final Stats
                </h2>
                <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-center block">{awayTeam.name} Score</label>
                    <input
                      type="number"
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      placeholder="0"
                      className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl py-4 text-center text-3xl font-black text-white focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider text-center block">{homeTeam.name} Score</label>
                    <input
                      type="number"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      placeholder="0"
                      className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl py-4 text-center text-3xl font-black text-white focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Desktop/Tablet View */}
                  <div className="hidden md:grid grid-cols-3 gap-4">
                    {statFields.map(s => (
                      <div key={s.field} className="grid grid-cols-3 gap-4 items-center col-span-3">
                        <label className="text-sm font-bold text-zinc-300 text-right">{s.label}</label>
                        <input
                          type={s.type === 'number' ? 'number' : 'text'}
                          inputMode={s.type === 'number' ? 'numeric' : undefined}
                          value={s.field === 'timeOfPossession' ? awayStats[s.field] : (awayStats[s.field] || '')}
                          onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('away', e.target.value) : updateStats('away', s.field, e.target.value)}
                          readOnly={s.field === 'totalPlays'}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white focus:border-orange-500"
                        />
                        <input
                          type={s.type === 'number' ? 'number' : 'text'}
                          inputMode={s.type === 'number' ? 'numeric' : undefined}
                          value={s.field === 'timeOfPossession' ? homeStats[s.field] : (homeStats[s.field] || '')}
                          onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('home', e.target.value) : updateStats('home', s.field, e.target.value)}
                          readOnly={s.field === 'totalPlays'}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white focus:border-orange-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-8">
                    {/* Away Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-orange-500 sticky top-0 bg-zinc-950 py-2 z-10">AWAY: {awayTeam.name} Stats</h3>
                      {statFields.map(s => (
                        <div key={`away-${s.field}`} className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase">{s.label}</label>
                          <input
                            type={s.type === 'number' ? 'number' : 'text'}
                            inputMode={s.type === 'number' ? 'numeric' : undefined}
                            value={s.field === 'timeOfPossession' ? awayStats[s.field] : (awayStats[s.field] || '')}
                            onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('away', e.target.value) : updateStats('away', s.field, e.target.value)}
                            readOnly={s.field === 'totalPlays'}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500"
                          />
                          {s.field === 'timeOfPossession' && (
                            <p className="text-[10px] text-zinc-500 mt-1">Note: TOP will be automatically normalized to a 60-minute standard in the final box score.</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Home Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-orange-500 sticky top-0 bg-zinc-950 py-2 z-10">HOME: {homeTeam.name} Stats</h3>
                      {statFields.map(s => (
                        <div key={`home-${s.field}`} className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase">{s.label}</label>
                          <input
                            type={s.type === 'number' ? 'number' : 'text'}
                            inputMode={s.type === 'number' ? 'numeric' : undefined}
                            value={s.field === 'timeOfPossession' ? homeStats[s.field] : (homeStats[s.field] || '')}
                            onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('home', e.target.value) : updateStats('home', s.field, e.target.value)}
                            readOnly={s.field === 'totalPlays'}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500"
                          />
                          {s.field === 'timeOfPossession' && (
                            <p className="text-[10px] text-zinc-500 mt-1">Note: TOP will be automatically normalized to a 60-minute standard in the final box score.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl transition-all">
                  {isSubmitting ? 'Saving...' : 'Confirm Stats'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
