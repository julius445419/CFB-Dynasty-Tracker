import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { claimCoachProfile } from '../services/coachService';
import { motion, AnimatePresence } from 'framer-motion';

export const ClaimProfile: React.FC = () => {
  const { user } = useAuth();
  const { selectLeague } = useLeague();
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || inviteCode.length < 6) return;

    setLoading(true);
    setError(null);

    try {
      const { leagueId, teamId } = await claimCoachProfile(user.uid, inviteCode);
      
      // Select the league so the context picks it up
      selectLeague(leagueId);
      
      setSuccess(true);
      
      // Acceptance Criteria: success confirmation state for 2 seconds before redirect
      setTimeout(() => {
        // The prompt asks for /leagues/{leagueId}/my-team
        // But the app structure uses /team (relative to root)
        // I'll use /team as it's the established route in App.tsx
        navigate('/team');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Acceptance Criteria: strictly enforce 6-character limit and automatically format to uppercase
    const val = e.target.value.toUpperCase().slice(0, 6);
    setInviteCode(val);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-[32px] p-8 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-8">
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="p-5 bg-blue-600/10 rounded-2xl border border-blue-600/20 shadow-inner"
          >
            <KeyRound className="text-blue-500" size={32} />
          </motion.div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
              Claim <span className="text-blue-600">Profile</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
              Enter your unique invite code
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-8">
            <div className="relative">
              <input
                type="text"
                value={inviteCode}
                onChange={handleInputChange}
                placeholder="XXXXXX"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-6 text-3xl font-black text-white text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all placeholder:text-zinc-800 shadow-inner uppercase"
                disabled={loading || success}
                autoFocus
              />
              
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute -bottom-10 left-0 right-0 flex items-center justify-center gap-2 text-red-500"
                  >
                    <AlertCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={loading || success || inviteCode.length < 6}
              className="w-full py-5 bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 active:scale-95"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : success ? (
                <CheckCircle2 size={20} className="text-green-400" />
              ) : (
                <>
                  Claim My Team
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <AnimatePresence>
            {success && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 text-green-400"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Profile Claimed Successfully
                </div>
                <div className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">
                  Redirecting to your dashboard...
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer Decoration */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center opacity-20">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">
          CFB 26 Dynasty Portal
        </p>
      </div>
    </div>
  );
};

export default ClaimProfile;
