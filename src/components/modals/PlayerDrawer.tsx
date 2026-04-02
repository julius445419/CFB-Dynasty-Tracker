import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Star, Zap, Shield, Edit2 } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  pos: string;
  year: string;
  ovr: number;
  archetype?: string;
  devTrait?: 'Normal' | 'Star' | 'Elite' | 'Generational';
  number?: number;
  height?: string;
  weight?: number;
}

interface PlayerDrawerProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PlayerDrawer: React.FC<PlayerDrawerProps> = ({ player, isOpen, onClose }) => {
  if (!player) return null;

  const getDevIcon = (trait?: string) => {
    switch (trait) {
      case 'Elite': return <Zap className="text-purple-500" size={16} />;
      case 'Star': return <Star className="text-orange-500" size={16} />;
      case 'Generational': return <Sparkles className="text-yellow-400" size={16} />;
      default: return <Shield className="text-zinc-500" size={16} />;
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
            {/* Handle */}
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />

            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700">
                  <span className="text-2xl font-black text-white">{player.pos}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{player.name}</h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                    #{player.number || '??'} • {player.year} • {player.height || '?-?'} • {player.weight || '???'} LBS
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
                  <span className="text-xl font-black text-white">{player.ovr}</span>
                </div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">OVERALL</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-zinc-800/50 border border-zinc-800 rounded-2xl p-4">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Archetype</p>
                <p className="text-white font-bold">{player.archetype || 'Balanced'}</p>
              </div>
              <div className="bg-zinc-800/50 border border-zinc-800 rounded-2xl p-4">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Dev Trait</p>
                <div className="flex items-center gap-2">
                  {getDevIcon(player.devTrait)}
                  <p className="text-white font-bold">{player.devTrait || 'Normal'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-[0.98]">
                <Edit2 size={18} />
                EDIT PLAYER
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl hover:bg-zinc-700 transition-all active:scale-[0.98]"
              >
                CLOSE
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const Sparkles = ({ size, className }: { size: number, className: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  </svg>
);
