import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Gamepad2,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { Game, TeamAssignment } from '../../types';
import { getTeamLogo } from '../../utils/teamAssets';

const ScheduleManagement: React.FC = () => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [isAdvancingWeek, setIsAdvancingWeek] = useState(false);
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);

  // Form State
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [week, setWeek] = useState(leagueInfo?.currentWeek || 1);
  const [isUvU, setIsUvU] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leagueInfo?.currentWeek) {
      setWeek(leagueInfo.currentWeek);
    }
  }, [leagueInfo?.currentWeek]);

  // Fetch Teams
  useEffect(() => {
    if (!currentLeagueId) return;

    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribe = onSnapshot(teamsRef, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamAssignment[];
      setTeams(teamsData);
    });

    return () => unsubscribe();
  }, [currentLeagueId]);

  // Fetch Games for current week
  useEffect(() => {
    if (!currentLeagueId || !leagueInfo) return;

    setLoading(true);
    const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
    const q = query(
      gamesRef, 
      where('week', '==', leagueInfo.currentWeek),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Game[];
      setGames(gamesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId, leagueInfo?.currentWeek]);

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!homeTeamId || !awayTeamId) {
      setError('Please select both teams.');
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError('A team cannot play itself.');
      return;
    }

    setIsAddingGame(true);

    try {
      const gamesRef = collection(db, 'leagues', currentLeagueId!, 'games');
      await addDoc(gamesRef, {
        week,
        homeTeamId,
        awayTeamId,
        homeScore: 0,
        awayScore: 0,
        isUvU,
        status: 'scheduled',
        leagueId: currentLeagueId,
        season: leagueInfo?.currentYear || 2024,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setHomeTeamId('');
      setAwayTeamId('');
      setIsUvU(false);
      setError(null);
    } catch (err) {
      console.error("Error adding game:", err);
      setError('Failed to add game. Please try again.');
    } finally {
      setIsAddingGame(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!window.confirm('Delete this game?')) return;

    try {
      const gameRef = doc(db, 'leagues', currentLeagueId!, 'games', gameId);
      await deleteDoc(gameRef);
    } catch (err) {
      console.error("Error deleting game:", err);
    }
  };

  const handleAdvanceWeek = async () => {
    setIsAdvancingWeek(true);
    try {
      const leagueRef = doc(db, 'leagues', currentLeagueId!);
      await updateDoc(leagueRef, {
        currentWeek: (leagueInfo?.currentWeek || 1) + 1,
        updatedAt: serverTimestamp()
      });
      setShowAdvanceConfirm(false);
    } catch (err) {
      console.error("Error advancing week:", err);
      alert('Failed to advance week.');
    } finally {
      setIsAdvancingWeek(false);
    }
  };

  return (
    <div className="p-6 space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Calendar className="w-8 h-8 text-orange-500" />
          Schedule Management
        </h1>
        <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-2xl">
          <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Current Week</span>
          <p className="text-xl font-black text-orange-500">{leagueInfo?.currentWeek}</p>
        </div>
      </div>

      {/* Advance Week Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Advance to Next Week</h2>
            <p className="text-sm text-zinc-500">Move the entire league to Week {(leagueInfo?.currentWeek || 1) + 1}.</p>
          </div>
          <button
            onClick={() => setShowAdvanceConfirm(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center gap-2 uppercase tracking-widest text-sm"
          >
            Advance Week
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add Game Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-xl">
        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
          <Plus className="w-6 h-6 text-orange-500" />
          Schedule New Game
        </h2>

        <form onSubmit={handleAddGame} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Away Team</label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
              >
                <option value="">Select Team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center pt-6">
              <div className="bg-zinc-950 px-4 py-2 rounded-full border border-zinc-800">
                <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">AT</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Home Team</label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
              >
                <option value="">Select Team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 pt-2">
            <div className="flex items-center gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Week</label>
                <input
                  type="number"
                  value={week}
                  onChange={(e) => setWeek(parseInt(e.target.value))}
                  className="w-24 bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-white font-bold text-center focus:border-orange-500 focus:ring-0 transition-all"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer group pt-6">
                <div 
                  onClick={() => setIsUvU(!isUvU)}
                  className={`w-12 h-6 rounded-full transition-all relative ${isUvU ? 'bg-orange-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isUvU ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors flex items-center gap-2">
                  <Gamepad2 className={`w-4 h-4 ${isUvU ? 'text-orange-500' : 'text-zinc-600'}`} />
                  User vs User
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isAddingGame}
              className="bg-zinc-100 hover:bg-white text-zinc-950 font-black px-8 py-4 rounded-2xl transition-all shadow-xl flex items-center gap-2 uppercase tracking-widest text-sm"
            >
              {isAddingGame ? (
                <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Schedule Game
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Current Week Games */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-orange-500" />
          Week {leagueInfo?.currentWeek} Games
        </h2>

        <div className="grid gap-4">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">Loading games...</div>
          ) : games.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-[32px]">
              No games scheduled for this week.
            </div>
          ) : (
            games.map(game => (
              <div 
                key={game.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-sm font-bold text-white">{teams.find(t => t.id === game.awayTeamId)?.name}</span>
                    <img src={getTeamLogo(teams.find(t => t.id === game.awayTeamId)?.name || '')} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="text-xs font-black text-zinc-700">VS</div>
                  <div className="flex items-center gap-3 flex-1">
                    <img src={getTeamLogo(teams.find(t => t.id === game.homeTeamId)?.name || '')} className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                    <span className="text-sm font-bold text-white">{teams.find(t => t.id === game.homeTeamId)?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {game.isUvU && (
                    <div className="bg-orange-500/10 text-orange-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1">
                      <Gamepad2 className="w-3 h-3" />
                      UvU
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteGame(game.id)}
                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Advance Week Confirmation Modal */}
      <AnimatePresence>
        {showAdvanceConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
              onClick={() => setShowAdvanceConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[40px] p-8 z-[110] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10 text-orange-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white">Advance Week?</h3>
                  <p className="text-zinc-400">
                    Are you sure? This will move the whole league to <span className="text-white font-bold">Week {(leagueInfo?.currentWeek || 1) + 1}</span>. 
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={handleAdvanceWeek}
                    disabled={isAdvancingWeek}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isAdvancingWeek ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        Confirm Advance
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAdvanceConfirm(false)}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl transition-all uppercase tracking-widest text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScheduleManagement;
