import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Loader2, Shield, Sword } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { TeamAssignment } from '../../types';

interface EditCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamAssignment;
}

const OFFENSIVE_SCHEMES = [
  'Air Raid',
  'Multiple',
  'Option',
  'Pro Style',
  'Run and Shoot',
  'Spread',
  'Spread Option',
  'Vee'
];

const DEFENSIVE_SCHEMES = [
  '3-4 Under',
  '3-4 Odd',
  '4-3 Normal',
  '4-3 Multiple',
  '3-3-5 Stack',
  '3-3-5 Split',
  '4-2-5'
];

export const EditCoachModal: React.FC<EditCoachModalProps> = ({ isOpen, onClose, team }) => {
  const [offensiveScheme, setOffensiveScheme] = useState(team.offensiveScheme || 'Multiple');
  const [defensiveScheme, setDefensiveScheme] = useState(team.defensiveScheme || '4-3 Multiple');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team.id || !team.leagueId) return;

    setLoading(true);
    try {
      const teamRef = doc(db, 'leagues', team.leagueId, 'teams', team.id);
      await updateDoc(teamRef, {
        offensiveScheme,
        defensiveScheme,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      console.error('Error updating coach schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight italic">Edit Coaching Schemes</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{team.name} Dynasty</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Offensive Scheme */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
              <Sword size={14} className="text-orange-500" />
              Offensive Scheme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OFFENSIVE_SCHEMES.map(scheme => (
                <button
                  key={scheme}
                  type="button"
                  onClick={() => setOffensiveScheme(scheme)}
                  className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    offensiveScheme === scheme 
                      ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                  }`}
                >
                  {scheme}
                </button>
              ))}
            </div>
          </div>

          {/* Defensive Scheme */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
              <Shield size={14} className="text-orange-500" />
              Defensive Scheme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DEFENSIVE_SCHEMES.map(scheme => (
                <button
                  key={scheme}
                  type="button"
                  onClick={() => setDefensiveScheme(scheme)}
                  className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    defensiveScheme === scheme 
                      ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                  }`}
                >
                  {scheme}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-xl shadow-white/5 hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            SAVE SCHEMES
          </button>
        </form>
      </motion.div>
    </div>
  );
};
