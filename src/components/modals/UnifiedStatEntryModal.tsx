import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, User, Plus, Trash2, Search, Activity } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment, TeamStats, LeagueSettings, Player, PlayerGameStats } from '../../types';
import { TeamLogo } from '../common/TeamLogo';

interface UnifiedStatEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
  onSave: (stats: { 
    homeScore: number; 
    awayScore: number; 
    homeStats: TeamStats; 
    awayStats: TeamStats; 
    playerStats: PlayerGameStats[];
    quarterLengthAtGame?: number 
  }) => Promise<void>;
  leagueSettings?: LeagueSettings;
}

type Tab = 'team' | 'players';

export const UnifiedStatEntryModal: React.FC<UnifiedStatEntryModalProps> = ({
  isOpen,
  onClose,
  game,
  homeTeam,
  awayTeam,
  onSave,
  leagueSettings,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('team');
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<Partial<PlayerGameStats>[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const defaultStats: TeamStats = {
    passYards: 0, rushYards: 0, turnovers: 0, takeaways: 0,
    firstDowns: 0, thirdDownMade: 0, thirdDownAtt: 0,
    ypp: 0, rushingAttempts: 0, rushingTds: 0, completions: 0,
    passingAttempts: 0, passingTds: 0, fourthDownConversions: 0,
    fourthDownAttempts: 0, twoPointConversions: 0, twoPointAttempts: 0,
    fumblesLost: 0, interceptionsThrown: 0, penalties: 0, penaltyYards: 0,
    timeOfPossession: '00:00'
  };

  const [homeScore, setHomeScore] = useState<string>(game.homeScore?.toString() || '');
  const [awayScore, setAwayScore] = useState<string>(game.awayScore?.toString() || '');
  const [homeStats, setHomeStats] = useState<TeamStats>(game.homeStats || { ...defaultStats });
  const [awayStats, setAwayStats] = useState<TeamStats>(game.awayStats || { ...defaultStats });

  useEffect(() => {
    setHomeScore(game.homeScore?.toString() || '');
    setAwayScore(game.awayScore?.toString() || '');
    setHomeStats(game.homeStats || { ...defaultStats });
    setAwayStats(game.awayStats || { ...defaultStats });
    
    if (isOpen) {
      fetchPlayers();
    }
  }, [game, isOpen]);

  const fetchPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const playersRef = collection(db, 'leagues', game.leagueId, 'players');
      
      // Fetch Home Players
      const homeQ = query(playersRef, where('teamId', '==', game.homeTeamId));
      const homeSnap = await getDocs(homeQ);
      setHomePlayers(homeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
      
      // Fetch Away Players
      const awayQ = query(playersRef, where('teamId', '==', game.awayTeamId));
      const awaySnap = await getDocs(awayQ);
      setAwayPlayers(awaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStats = (team: 'home' | 'away', field: keyof TeamStats, value: any) => {
    const setter = team === 'home' ? setHomeStats : setAwayStats;
    setter(prev => {
      const numericValue = field !== 'timeOfPossession' ? Number(value) : value;
      const updated = { ...prev, [field]: numericValue };
      
      // Auto-calculate Turnovers
      if (field === 'fumblesLost' || field === 'interceptionsThrown') {
        updated.turnovers = (Number(updated.fumblesLost) || 0) + (Number(updated.interceptionsThrown) || 0);
      }
      
      return updated;
    });
  };

  const handleTOPChange = (team: 'home' | 'away', value: string) => {
    const numericValue = value.replace(/\D/g, '');
    let cleaned = numericValue.replace(/^0+/, '');
    if (cleaned === '' && numericValue !== '') cleaned = '0';
    let formatted = cleaned;
    if (cleaned.length > 2) {
      const splitPoint = cleaned.length - 2;
      formatted = `${cleaned.slice(0, splitPoint)}:${cleaned.slice(splitPoint)}`;
    }
    updateStats(team, 'timeOfPossession', formatted);
  };

  const addPlayerStat = (playerId: string, teamId: string) => {
    const player = [...homePlayers, ...awayPlayers].find(p => p.id === playerId);
    if (!player) return;

    setPlayerStats(prev => [
      ...prev,
      {
        playerId,
        teamId,
        gameId: game.id,
        passYds: 0, passTDs: 0, passInts: 0,
        rushYds: 0, rushTDs: 0,
        recYds: 0, recTDs: 0, receptions: 0,
        tackles: 0, sacks: 0, ints: 0
      }
    ]);
  };

  const removePlayerStat = (index: number) => {
    setPlayerStats(prev => prev.filter((_, i) => i !== index));
  };

  const updatePlayerStat = (index: number, field: keyof PlayerGameStats, value: number) => {
    setPlayerStats(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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
      const finalHomeStats = { ...homeStats, takeaways: awayStats.turnovers || 0 };
      const finalAwayStats = { ...awayStats, takeaways: homeStats.turnovers || 0 };
      
      await onSave({ 
        homeScore: hScore, 
        awayScore: aScore, 
        homeStats: finalHomeStats, 
        awayStats: finalAwayStats,
        playerStats: playerStats as PlayerGameStats[],
        quarterLengthAtGame: leagueSettings?.quarterLength
      });
      onClose();
    } catch (err) {
      setError('Failed to save stats.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const teamStatFields: { label: string; field: keyof TeamStats; type?: 'number' | 'text' }[] = [
    { label: 'First Downs', field: 'firstDowns', type: 'number' },
    { label: 'YPP', field: 'ypp', type: 'number' },
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

              {/* Tabs */}
              <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl mb-8 w-fit">
                <button
                  onClick={() => setActiveTab('team')}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === 'team' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Activity size={14} />
                  Team Stats
                </button>
                <button
                  onClick={() => setActiveTab('players')}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === 'players' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <User size={14} />
                  Player Stats
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {activeTab === 'team' ? (
                  <>
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
                        {teamStatFields.map(s => (
                          <div key={s.field} className="grid grid-cols-3 gap-4 items-center col-span-3">
                            <label className="text-sm font-bold text-zinc-300 text-right">{s.label}</label>
                            <input
                              type={s.type === 'number' ? 'number' : 'text'}
                              inputMode={s.type === 'number' ? 'numeric' : undefined}
                              value={s.field === 'timeOfPossession' ? awayStats[s.field] : (awayStats[s.field] || '')}
                              onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('away', e.target.value) : updateStats('away', s.field, e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white focus:border-orange-500"
                            />
                            <input
                              type={s.type === 'number' ? 'number' : 'text'}
                              inputMode={s.type === 'number' ? 'numeric' : undefined}
                              value={s.field === 'timeOfPossession' ? homeStats[s.field] : (homeStats[s.field] || '')}
                              onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('home', e.target.value) : updateStats('home', s.field, e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white focus:border-orange-500"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Mobile View */}
                      <div className="md:hidden space-y-8">
                        <div className="space-y-4">
                          <h3 className="text-lg font-black text-orange-500 sticky top-0 bg-zinc-950 py-2 z-10">AWAY: {awayTeam.name} Stats</h3>
                          {teamStatFields.map(s => (
                            <div key={`away-${s.field}`} className="grid grid-cols-1 gap-2">
                              <label className="text-xs font-bold text-zinc-400 uppercase">{s.label}</label>
                              <input
                                type={s.type === 'number' ? 'number' : 'text'}
                                inputMode={s.type === 'number' ? 'numeric' : undefined}
                                value={s.field === 'timeOfPossession' ? awayStats[s.field] : (awayStats[s.field] || '')}
                                onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('away', e.target.value) : updateStats('away', s.field, e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-black text-orange-500 sticky top-0 bg-zinc-950 py-2 z-10">HOME: {homeTeam.name} Stats</h3>
                          {teamStatFields.map(s => (
                            <div key={`home-${s.field}`} className="grid grid-cols-1 gap-2">
                              <label className="text-xs font-bold text-zinc-400 uppercase">{s.label}</label>
                              <input
                                type={s.type === 'number' ? 'number' : 'text'}
                                inputMode={s.type === 'number' ? 'numeric' : undefined}
                                value={s.field === 'timeOfPossession' ? homeStats[s.field] : (homeStats[s.field] || '')}
                                onChange={(e) => s.field === 'timeOfPossession' ? handleTOPChange('home', e.target.value) : updateStats('home', s.field, e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Away Players */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black text-white uppercase italic">{awayTeam.name}</h3>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{awayPlayers.length} Players</span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                          <select 
                            onChange={(e) => {
                              if (e.target.value) {
                                addPlayerStat(e.target.value, game.awayTeamId);
                                e.target.value = '';
                              }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:border-orange-500 outline-none appearance-none"
                          >
                            <option value="">Add Player...</option>
                            {awayPlayers
                              .filter(p => !playerStats.some(s => s.playerId === p.id))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.pos})</option>
                              ))
                            }
                          </select>
                        </div>
                      </div>

                      {/* Home Players */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black text-white uppercase italic">{homeTeam.name}</h3>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{homePlayers.length} Players</span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                          <select 
                            onChange={(e) => {
                              if (e.target.value) {
                                addPlayerStat(e.target.value, game.homeTeamId);
                                e.target.value = '';
                              }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:border-orange-500 outline-none appearance-none"
                          >
                            <option value="">Add Player...</option>
                            {homePlayers
                              .filter(p => !playerStats.some(s => s.playerId === p.id))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.pos})</option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Player Stat Entries */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em]">Player Stat Entries</h3>
                      {playerStats.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
                          <User className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                          <p className="text-zinc-500 text-sm font-medium">Add players to log individual stats.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {playerStats.map((stat, index) => {
                            const player = [...homePlayers, ...awayPlayers].find(p => p.id === stat.playerId);
                            if (!player) return null;

                            return (
                              <motion.div 
                                key={stat.playerId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-black text-orange-500">
                                      {player.pos}
                                    </div>
                                    <div>
                                      <h4 className="font-black text-white uppercase italic">{player.name}</h4>
                                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        {player.teamId === game.homeTeamId ? homeTeam.name : awayTeam.name}
                                      </p>
                                    </div>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => removePlayerStat(index)}
                                    className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  {player.pos === 'QB' && (
                                    <>
                                      <StatInput label="Pass Yds" value={stat.passYds} onChange={(val) => updatePlayerStat(index, 'passYds', val)} />
                                      <StatInput label="Pass TDs" value={stat.passTDs} onChange={(val) => updatePlayerStat(index, 'passTDs', val)} />
                                      <StatInput label="Pass INTs" value={stat.passInts} onChange={(val) => updatePlayerStat(index, 'passInts', val)} />
                                    </>
                                  )}
                                  {(player.pos === 'HB' || player.pos === 'FB' || player.pos === 'QB') && (
                                    <>
                                      <StatInput label="Rush Yds" value={stat.rushYds} onChange={(val) => updatePlayerStat(index, 'rushYds', val)} />
                                      <StatInput label="Rush TDs" value={stat.rushTDs} onChange={(val) => updatePlayerStat(index, 'rushTDs', val)} />
                                    </>
                                  )}
                                  {(player.pos === 'WR' || player.pos === 'TE' || player.pos === 'HB') && (
                                    <>
                                      <StatInput label="Rec Yds" value={stat.recYds} onChange={(val) => updatePlayerStat(index, 'recYds', val)} />
                                      <StatInput label="Rec TDs" value={stat.recTDs} onChange={(val) => updatePlayerStat(index, 'recTDs', val)} />
                                      <StatInput label="Rec" value={stat.receptions} onChange={(val) => updatePlayerStat(index, 'receptions', val)} />
                                    </>
                                  )}
                                  {['DE', 'DT', 'LB', 'CB', 'S', 'MLB', 'LOLB', 'ROLB', 'FS', 'SS'].includes(player.pos) && (
                                    <>
                                      <StatInput label="Tackles" value={stat.tackles} onChange={(val) => updatePlayerStat(index, 'tackles', val)} />
                                      <StatInput label="Sacks" value={stat.sacks} onChange={(val) => updatePlayerStat(index, 'sacks', val)} />
                                      <StatInput label="INTs" value={stat.ints} onChange={(val) => updatePlayerStat(index, 'ints', val)} />
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-medium">
                    <Activity className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-orange-900/20">
                  {isSubmitting ? 'Saving...' : 'Confirm All Stats'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const StatInput = ({ label, value, onChange }: { label: string; value?: number; onChange: (val: number) => void }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">{label}</label>
    <input
      type="number"
      value={value || 0}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white font-bold focus:border-orange-500 outline-none transition-all"
    />
  </div>
);
