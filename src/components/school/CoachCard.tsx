import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Shield, Award, User, Star, Settings2 } from 'lucide-react';
import { TeamAssignment } from '../../types';
import { EditCoachModal } from '../modals/EditCoachModal';

interface CoachCardProps {
  team: TeamAssignment;
  isEditable?: boolean;
}

export const CoachCard: React.FC<CoachCardProps> = ({ team, isEditable }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const schoolWins = team.schoolWins || 0;
  const schoolLosses = team.schoolLosses || 0;
  const careerWins = team.careerWins || 0;
  const careerLosses = team.careerLosses || 0;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 mb-6 relative overflow-hidden group"
      >
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-orange-600/5 rounded-full blur-3xl group-hover:bg-orange-600/10 transition-all duration-500" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 shadow-inner">
              <User size={32} className="text-zinc-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black uppercase tracking-tighter text-white italic">
                  Coach {team.coachName || 'Vacant'}
                </h3>
                <span className="px-2 py-0.5 bg-orange-600 text-white text-[10px] font-black rounded uppercase tracking-widest">
                  {team.coachRole || 'HC'}
                </span>
              </div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                <Shield size={12} className="text-orange-500" />
                {team.name} Dynasty
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-orange-500">
                <Star size={14} fill="currentColor" />
                <Star size={14} fill="currentColor" />
                <Star size={14} fill="currentColor" />
                <Star size={14} className="opacity-30" />
                <Star size={14} className="opacity-30" />
              </div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Prestige: C+</p>
            </div>
            {isEditable && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all text-zinc-400 hover:text-white"
              >
                <Settings2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          {/* School Record */}
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/stat hover:border-orange-600/30 transition-all">
            <Trophy size={20} className="text-orange-500 mb-2 group-hover/stat:scale-110 transition-transform" />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">School Record</p>
            <p className="text-2xl font-black text-white tracking-tighter">
              {schoolWins}<span className="text-zinc-600 mx-1">-</span>{schoolLosses}
            </p>
            <div className="w-8 h-1 bg-orange-600/20 rounded-full mt-2 group-hover/stat:w-12 transition-all" />
          </div>

          {/* Career Record */}
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/stat hover:border-orange-600/30 transition-all">
            <Award size={20} className="text-orange-500 mb-2 group-hover/stat:scale-110 transition-transform" />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Career Record</p>
            <p className="text-2xl font-black text-white tracking-tighter">
              {careerWins}<span className="text-zinc-600 mx-1">-</span>{careerLosses}
            </p>
            <div className="w-8 h-1 bg-orange-600/20 rounded-full mt-2 group-hover/stat:w-12 transition-all" />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Offensive Scheme</p>
              <p className="text-[10px] font-bold text-zinc-300 uppercase">{team.offensiveScheme || 'Multiple'}</p>
            </div>
            <div className="w-px h-6 bg-zinc-800" />
            <div>
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Defensive Scheme</p>
              <p className="text-[10px] font-bold text-zinc-300 uppercase">{team.defensiveScheme || '4-3 Multiple'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Level</p>
            <p className="text-[10px] font-bold text-zinc-300 uppercase">24</p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isEditModalOpen && (
          <EditCoachModal 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            team={team}
          />
        )}
      </AnimatePresence>
    </>
  );
};
