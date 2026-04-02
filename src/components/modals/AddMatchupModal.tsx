import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Search, AlertCircle, CheckCircle2, Gamepad2, Trophy, Loader2 } from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { useAuth } from '../../context/AuthContext';
import { SCHOOLS } from '../../constants/schools';
import { getTeamLogo } from '../../utils/teamAssets';

interface AddMatchupModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillHomeTeam?: string; // School name
}

const WEEKS = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: i + 1, label: `Week ${i + 1}` })),
  { id: 16, label: 'Conference Championships' },
  { id: 17, label: 'Bowl Season' },
  { id: 18, label: 'CFP Quarterfinals' },
  { id: 19, label: 'CFP Semifinals' },
  { id: 20, label: 'National Championship' }
];

const AddMatchupModal: React.FC<AddMatchupModalProps> = ({
  isOpen,
  onClose,
  prefillHomeTeam
}) => {
  const { user } = useAuth();
  const { currentLeagueId, leagueInfo } = useLeague();
  
  const [selectedWeek, setSelectedWeek] = useState<number>(leagueInfo?.currentWeek || 1);
  const [homeSearch, setHomeSearch] = useState(prefillHomeTeam || '');
  const [awaySearch, setAwaySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Search Results
  const homeResults = useMemo(() => {
    if (homeSearch.length < 2) return [];
    return SCHOOLS.filter(s => (s.name?.toLowerCase() || '').includes(homeSearch.toLowerCase())).slice(0, 5);
  }, [homeSearch]);

  const awayResults = useMemo(() => {
    if (awaySearch.length < 2) return [];
    return SCHOOLS.filter(s => (s.name?.toLowerCase() || '').includes(awaySearch.toLowerCase())).slice(0, 5);
  }, [awaySearch]);

  const [selectedHome, setSelectedHome] = useState(
    prefillHomeTeam ? SCHOOLS.find(s => s.name === prefillHomeTeam) || null : null
  );
  const [selectedAway, setSelectedAway] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentLeagueId) return;
    if (!selectedHome || !selectedAway) {
      setError('Please select both teams.');
      return;
    }
    if (selectedHome.name === selectedAway.name) {
      setError('A team cannot play itself.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Check for conflicts (double-booking)
      const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
      const q = query(gamesRef, where('week', '==', selectedWeek));
      const snapshot = await getDocs(q);
      
      const existingGames = snapshot.docs.map(d => d.data());
      const homeConflict = existingGames.find(g => g.homeTeamName === selectedHome.name || g.awayTeamName === selectedHome.name);
      const awayConflict = existingGames.find(g => g.homeTeamName === selectedAway.name || g.awayTeamName === selectedAway.name);

      if (homeConflict) {
        setError(`${selectedHome.name} is already scheduled for Week ${selectedWeek}.`);
        setIsSubmitting(false);
        return;
      }
      if (awayConflict) {
        setError(`${selectedAway.name} is already scheduled for Week ${selectedWeek}.`);
        setIsSubmitting(false);
        return;
      }

      // 2. Ensure both teams exist in the 'teams' collection (auto-track as CPU if missing)
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const teamsSnapshot = await getDocs(teamsRef);
      const leagueTeams = teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const getOrCreateTeam = async (school: any): Promise<{ id: string; ownerId: string }> => {
        let team = leagueTeams.find((t: any) => t.name === school.name);
        if (!team) {
          const newTeamRef = await addDoc(collection(db, 'leagues', currentLeagueId, 'teams'), {
            name: school.name,
            coachName: 'CPU Controlled',
            coachRole: 'HC',
            leagueId: currentLeagueId,
            ownerId: 'cpu',
            conference: school.conference,
            logoId: school.logoId,
            color: school.color,
            assignmentStatus: 'Active',
            contractStart: serverTimestamp(),
            createdAt: serverTimestamp()
          });
          return { id: newTeamRef.id, ownerId: 'cpu' };
        }
        return team as { id: string; ownerId: string };
      };

      const homeTeamData = await getOrCreateTeam(selectedHome);
      const awayTeamData = await getOrCreateTeam(selectedAway);

      // 3. Deterministic ID: week_[week]_[teamA]_[teamB] (sorted alphabetically)
      const sortedNames = [selectedHome.name, selectedAway.name].sort();
      const deterministicId = `week_${selectedWeek}_${sortedNames[0].replace(/\s+/g, '_')}_${sortedNames[1].replace(/\s+/g, '_')}`;

      // 4. Auto-detect UvU
      const isUvU = homeTeamData.ownerId !== 'cpu' && awayTeamData.ownerId !== 'cpu';

      // 5. Write Game Doc
      const gameRef = doc(db, 'leagues', currentLeagueId, 'games', deterministicId);
      
      // Check if it already exists (just in case)
      const existingDoc = await getDoc(gameRef);
      if (existingDoc.exists()) {
        setError('This matchup is already scheduled.');
        setIsSubmitting(false);
        return;
      }

      await setDoc(gameRef, {
        week: selectedWeek,
        homeTeamId: homeTeamData.id,
        awayTeamId: awayTeamData.id,
        homeTeamName: selectedHome.name, // Storing names for easier conflict checking
        awayTeamName: selectedAway.name,
        homeScore: 0,
        awayScore: 0,
        isUvU,
        status: 'scheduled',
        leagueId: currentLeagueId,
        season: leagueInfo?.currentYear || 2024,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSelectedAway(null);
        setAwaySearch('');
      }, 1500);

    } catch (err) {
      console.error("Error adding matchup:", err);
      setError('Failed to schedule game. Please try again.');
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
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] z-[70] max-h-[92vh] overflow-y-auto custom-scrollbar"
          >
            <div className="p-6 pb-24 max-w-lg mx-auto">
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-orange-500" />
                  Schedule Matchup
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {success ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold text-white">Matchup Scheduled!</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Week Selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Select Week</label>
                    <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
                      {WEEKS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setSelectedWeek(w.id)}
                          className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            selectedWeek === w.id
                              ? 'bg-orange-600 text-white'
                              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Team Selection */}
                  <div className="grid grid-cols-1 gap-6">
                    {/* Home Team */}
                    <div className="space-y-3 relative">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Home Team</label>
                      {selectedHome ? (
                        <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <img src={getTeamLogo(selectedHome.name)} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                            <span className="font-bold text-white">{selectedHome.name}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => { setSelectedHome(null); setHomeSearch(''); }}
                            className="text-zinc-500 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="text"
                            value={homeSearch}
                            onChange={(e) => setHomeSearch(e.target.value)}
                            placeholder="Search Home Team..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-11 pr-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                          />
                          {homeResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-20 shadow-2xl">
                              {homeResults.map(school => (
                                <button
                                  key={school.name}
                                  type="button"
                                  onClick={() => setSelectedHome(school)}
                                  className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800 text-left transition-colors"
                                >
                                  <img src={getTeamLogo(school.name)} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                                  <span className="text-sm font-bold text-white">{school.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="space-y-3 relative">
                      <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Away Team</label>
                      {selectedAway ? (
                        <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <img src={getTeamLogo(selectedAway.name)} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                            <span className="font-bold text-white">{selectedAway.name}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => { setSelectedAway(null); setAwaySearch(''); }}
                            className="text-zinc-500 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="text"
                            value={awaySearch}
                            onChange={(e) => setAwaySearch(e.target.value)}
                            placeholder="Search Away Team..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-11 pr-4 text-white font-bold focus:border-orange-500 focus:ring-0 transition-all"
                          />
                          {awayResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-20 shadow-2xl">
                              {awayResults.map(school => (
                                <button
                                  key={school.name}
                                  type="button"
                                  onClick={() => setSelectedAway(school)}
                                  className="w-full flex items-center gap-3 p-4 hover:bg-zinc-800 text-left transition-colors"
                                >
                                  <img src={getTeamLogo(school.name)} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                                  <span className="text-sm font-bold text-white">{school.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Trophy className="w-6 h-6" />
                        Schedule Game
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddMatchupModal;
