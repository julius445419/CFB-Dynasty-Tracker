import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Plus, 
  Users, 
  ChevronRight, 
  LogOut, 
  Search, 
  Gamepad2,
  LayoutGrid,
  Loader2,
  Sparkles
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  collectionGroup, 
  doc, 
  getDoc,
  documentId,
  limit
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { useNavigate } from 'react-router-dom';
import { CreateLeagueModal } from '../components/modals/CreateLeagueModal';

interface LeagueSummary {
  id: string;
  name: string;
  ownerId: string;
  platform?: string;
  currentYear: number;
  currentWeek: number;
  role: 'Owner' | 'Player';
  school?: string;
}

export const Portal: React.FC = () => {
  const { user } = useAuth();
  const { selectLeague } = useLeague();
  const navigate = useNavigate();
  
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchLeagues = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        const foundLeagues: Map<string, LeagueSummary> = new Map();

        // 1. Fetch leagues owned by user
        const ownedQuery = query(collection(db, 'leagues'), where('ownerId', '==', user.uid));
        const ownedSnapshot = await getDocs(ownedQuery);
        ownedSnapshot.forEach(doc => {
          const data = doc.data();
          foundLeagues.set(doc.id, {
            id: doc.id,
            name: data.name,
            ownerId: data.ownerId,
            platform: data.platform,
            currentYear: data.currentYear || 2025,
            currentWeek: data.currentWeek || 0,
            role: 'Owner'
          });
        });

        // 2. Fetch leagues where user is a member
        const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
        const membersSnapshot = await getDocs(membersQuery);

        for (const memberDoc of membersSnapshot.docs) {
          const leagueId = memberDoc.ref.parent.parent?.id;
          if (leagueId && !foundLeagues.has(leagueId)) {
            const leagueRef = doc(db, 'leagues', leagueId);
            const leagueDoc = await getDoc(leagueRef);
            
            if (leagueDoc.exists()) {
              const data = leagueDoc.data();
              const memberData = memberDoc.data();
              
              // Check if user has a team in this league to get the school name
              const teamsRef = collection(db, 'leagues', leagueId, 'teams');
              const teamQuery = query(teamsRef, where('ownerId', '==', user.uid), limit(1));
              const teamSnap = await getDocs(teamQuery);
              const teamData = !teamSnap.empty ? teamSnap.docs[0].data() : null;

              foundLeagues.set(leagueId, {
                id: leagueId,
                name: data.name,
                ownerId: data.ownerId,
                platform: data.platform,
                currentYear: data.currentYear || 2025,
                currentWeek: data.currentWeek || 0,
                role: memberData.role === 'owner' ? 'Owner' : 'Player',
                school: teamData?.school
              });
            }
          }
        }

        // 3. Fallback: Fetch leagues where user has a team (for older leagues)
        const teamsQuery = query(collectionGroup(db, 'teams'), where('ownerId', '==', user.uid));
        const teamsSnapshot = await getDocs(teamsQuery);

        for (const teamDoc of teamsSnapshot.docs) {
          const leagueId = teamDoc.ref.parent.parent?.id;
          if (leagueId && !foundLeagues.has(leagueId)) {
            const leagueRef = doc(db, 'leagues', leagueId);
            const leagueDoc = await getDoc(leagueRef);
            
            if (leagueDoc.exists()) {
              const data = leagueDoc.data();
              const teamData = teamDoc.data();
              
              foundLeagues.set(leagueId, {
                id: leagueId,
                name: data.name,
                ownerId: data.ownerId,
                platform: data.platform,
                currentYear: data.currentYear || 2025,
                currentWeek: data.currentWeek || 0,
                role: 'Player',
                school: teamData.school
              });
            }
          }
        }

        // 4. Fallback: Fetch leagues where user is in the members array (legacy)
        const legacyMembersQuery = query(collection(db, 'leagues'), where('members', 'array-contains', user.uid));
        const legacySnapshot = await getDocs(legacyMembersQuery);
        legacySnapshot.forEach(doc => {
          if (!foundLeagues.has(doc.id)) {
            const data = doc.data();
            foundLeagues.set(doc.id, {
              id: doc.id,
              name: data.name,
              ownerId: data.ownerId,
              platform: data.platform,
              currentYear: data.currentYear || 2025,
              currentWeek: data.currentWeek || 0,
              role: 'Player'
            });
          }
        });

        setLeagues(Array.from(foundLeagues.values()));
      } catch (error) {
        console.error("Error fetching leagues:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSelectLeague = (leagueId: string) => {
    selectLeague(leagueId);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Loading Dynasties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-orange-600/30">
      {/* Header */}
      <header className="px-6 pt-12 pb-8 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">DYNASTY PORTAL</h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Logged in as {user?.displayName?.split(' ')[0]}</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="px-6 pb-32 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {leagues.length > 0 ? (
            <motion.div 
              key="leagues-list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Your Active Dynasties</h2>
                <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-bold text-zinc-500">
                  {leagues.length} TOTAL
                </span>
              </div>

              {leagues.map((league, index) => (
                <motion.button
                  key={league.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleSelectLeague(league.id)}
                  className="w-full group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-between p-6 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-3xl group-hover:border-orange-600/50 transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                        league.role === 'Owner' ? 'bg-orange-600/10 border-orange-600/20' : 'bg-zinc-800 border-zinc-700'
                      }`}>
                        {league.role === 'Owner' ? (
                          <Sparkles className="text-orange-500" size={24} />
                        ) : (
                          <Users className="text-zinc-400" size={24} />
                        )}
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-black text-white group-hover:text-orange-500 transition-colors">{league.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <Gamepad2 size={10} /> {league.platform || 'PS5'}
                          </span>
                          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                            {league.school || (league.role === 'Owner' ? 'COMMISSIONER' : 'UNASSIGNED')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Season {league.currentYear}</p>
                        <p className="text-white text-xs font-black">WEEK {league.currentWeek}</p>
                      </div>
                      <ChevronRight className="text-zinc-700 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" size={24} />
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center mb-8 relative">
                <LayoutGrid size={40} className="text-zinc-700" />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center animate-pulse">
                  <Plus size={16} className="text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-black mb-3">NO DYNASTIES FOUND</h2>
              <p className="text-zinc-500 text-sm max-w-[280px] leading-relaxed mb-10">
                You haven't joined any Online Dynasties yet. Start your legacy or join an existing league.
              </p>
              
              <div className="grid grid-cols-1 gap-4 w-full">
                <button 
                  onClick={() => navigate('/join-league')}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white font-black py-5 rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Search size={20} className="text-orange-500" />
                  JOIN A DYNASTY
                </button>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Plus size={20} />
                  CREATE NEW DYNASTY
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB for users with leagues */}
      {leagues.length > 0 && (
        <div className="fixed bottom-10 left-0 right-0 px-6 flex justify-center z-40">
          <div className="flex gap-3 w-full max-w-2xl">
            <button 
              onClick={() => navigate('/join-league')}
              className="flex-1 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 text-white font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-[0.95] transition-all"
            >
              <Search size={20} className="text-orange-500" />
              JOIN
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 bg-orange-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 active:scale-[0.95] transition-all"
            >
              <Plus size={20} />
              CREATE
            </button>
          </div>
        </div>
      )}

      <CreateLeagueModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </div>
  );
};
