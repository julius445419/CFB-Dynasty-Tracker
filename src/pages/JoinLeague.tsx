import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs,
  query,
  where,
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { motion } from 'motion/react';
import { 
  Hash, 
  Lock, 
  Trophy, 
  ArrowRight, 
  AlertCircle, 
  LogOut,
  Search
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export const JoinLeague: React.FC = () => {
  const { user } = useAuth();
  const { currentLeagueId, selectLeague } = useLeague();
  const navigate = useNavigate();
  const [leagueId, setLeagueId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already in a league, redirect home
  React.useEffect(() => {
    if (currentLeagueId) {
      navigate('/', { replace: true });
    }
  }, [currentLeagueId, navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError(null);

    const normalizedInput = leagueId.trim().toUpperCase();
    const inputPasscode = passcode.trim();

    try {
      let leagueDoc: any = null;
      let leagueIdToJoin = '';

      // 1. Try to find by exact ID first
      const leagueRef = doc(db, 'leagues', normalizedInput);
      const leagueSnap = await getDoc(leagueRef);

      if (leagueSnap.exists()) {
        leagueDoc = leagueSnap;
        leagueIdToJoin = leagueSnap.id;
      } else {
        // 2. If not found by ID, try to find by Name (case-insensitive search using nameSearch field)
        const leaguesRef = collection(db, 'leagues');
        const q = query(leaguesRef, where('nameSearch', '==', normalizedInput));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
          leagueDoc = querySnap.docs[0];
          leagueIdToJoin = leagueDoc.id;
        } else {
          // 3. Fallback for older leagues: try exact name match
          const qName = query(leaguesRef, where('name', '==', leagueId.trim()));
          const querySnapName = await getDocs(qName);
          if (!querySnapName.empty) {
            leagueDoc = querySnapName.docs[0];
            leagueIdToJoin = leagueDoc.id;
          }
        }
      }

      if (!leagueDoc) {
        throw new Error('League not found. Check the ID or Name with your commissioner.');
      }

      const leagueData = leagueDoc.data();
      if (leagueData.passcode !== inputPasscode) {
        throw new Error('Invalid passcode. Access denied.');
      }

      // Add user to league members (use merge: true to update existing docs)
      const memberRef = doc(db, 'leagues', leagueIdToJoin, 'members', user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        role: 'player',
        displayName: user.displayName || 'Coach',
        joinedAt: serverTimestamp()
      }, { merge: true });

      // CRITICAL: Select the league so the context picks it up
      selectLeague(leagueIdToJoin);

      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    navigate('/login');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 relative overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center">
          <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="mx-auto h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-500 shadow-xl mb-6"
          >
            <Search size={32} />
          </motion.div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">
            Join <span className="text-orange-600">Dynasty</span>
          </h2>
          <p className="mt-2 text-zinc-400 font-medium">Enter your league credentials to enter the arena</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-zinc-800 shadow-2xl">
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">League Name or ID</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="text"
                  required
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all text-lg font-bold"
                  placeholder="e.g. SEC ELITE or ABCD"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">League Passcode</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all text-lg font-bold tracking-widest"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-500/10 p-4 rounded-2xl border border-red-500/20"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 px-6 py-5 text-lg font-black text-white shadow-xl shadow-orange-600/20 hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50 uppercase italic tracking-wider"
            >
              {loading ? 'Verifying...' : 'Join Dynasty'}
              <ArrowRight size={24} />
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-col items-center gap-4">
            <p className="text-zinc-500 text-xs font-medium">Signed in as <span className="text-zinc-300">{user?.email}</span></p>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
            >
              <LogOut size={14} />
              Switch Account
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-zinc-600">
          <Trophy size={14} />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Ready for Kickoff
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default JoinLeague;
