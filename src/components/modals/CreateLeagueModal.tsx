import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Shield, Gamepad2, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLeague } from '../../context/LeagueContext';

interface CreateLeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { selectLeague } = useLeague();
  const [leagueName, setLeagueName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [platform, setPlatform] = useState<'PS5' | 'Xbox'>('PS5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const shortId = generateShortId();
      const leagueData = {
        name: leagueName.trim(),
        nameSearch: leagueName.trim().toUpperCase(),
        passcode: passcode.trim(),
        platform,
        ownerId: user.uid,
        ownerEmail: user.email,
        createdAt: serverTimestamp(),
        currentYear: 2025,
        currentWeek: 0,
        seasonPhase: 'Off Season',
        commissioners: [user.uid]
      };

      await setDoc(doc(db, 'leagues', shortId), leagueData);

      // Create member document for the owner
      await setDoc(doc(db, 'leagues', shortId, 'members', user.uid), {
        userId: user.uid,
        role: 'owner',
        displayName: user.displayName || 'Coach',
        joinedAt: serverTimestamp()
      });
      
      alert(`Dynasty Created! Your League ID is: ${shortId}. Share this and your passcode with your members.`);

      // Auto-select the new league
      selectLeague(shortId);
      onClose();
    } catch (err: any) {
      console.error("Error creating league:", err);
      setError(err.message || "Failed to create dynasty. Please try again.");
    } finally {
      setLoading(false);
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
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-[32px] border-t border-zinc-800 max-h-[92vh] overflow-y-auto custom-scrollbar p-6 pb-24 sm:max-w-lg sm:mx-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-600/20 rounded-xl">
                  <Trophy className="text-orange-500" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">New Dynasty</h2>
                  <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Establish your legacy</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Dynasty Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. SEC Elite"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Entry Passcode</label>
                <div className="relative">
                  <Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    required
                    type="text"
                    placeholder="Set a passcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Platform</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['PS5', 'Xbox'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all border ${
                        platform === p 
                          ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      <Gamepad2 size={18} />
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'CREATE DYNASTY'
                )}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
