import React from 'react';
import { motion } from 'motion/react';
import { Users, Ghost, Trophy, ChevronRight } from 'lucide-react';
import { getTeamLogo } from '../utils/teamAssets';
import { TeamLogo } from './common/TeamLogo';

interface SchoolCardProps {
  school: {
    name: string;
    conference: string;
    logoId?: string | number;
  };
  coach?: {
    coachName?: string;
    ownerId?: string;
    isPlaceholder?: boolean;
    wins?: number;
    losses?: number;
    currentRank?: number;
  };
  onClick: () => void;
}

export const SchoolCard: React.FC<SchoolCardProps> = ({ school, coach, onClick }) => {
  const getCoachStatus = () => {
    const isUserControlled = coach?.ownerId && coach.ownerId !== 'cpu' && !coach.isPlaceholder;
    const hasCoachName = !!coach?.coachName;
    const isShadow = coach?.isPlaceholder && !isUserControlled && !hasCoachName;

    if (isUserControlled) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <Users size={12} />
          User: {coach.coachName || 'Active Coach'}
        </div>
      );
    }
    
    if (isShadow) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-zinc-700">
          <Ghost size={12} />
          Shadow: {coach.coachName || 'Placeholder'}
        </div>
      );
    }

    // CPU Case (includes non-user teams with assigned coaches)
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/50 text-zinc-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-zinc-800">
        {hasCoachName ? `CPU: ${coach.coachName}` : 'CPU'}
      </div>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative bg-zinc-900/40 backdrop-blur-xl rounded-3xl p-6 border border-zinc-800 hover:border-orange-600/30 transition-all cursor-pointer overflow-hidden"
    >
      {/* Record Badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
        <Trophy size={10} />
        {coach?.wins || 0}-{coach?.losses || 0}
      </div>

      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-orange-600/5 blur-2xl rounded-full group-hover:bg-orange-600/10 transition-colors" />
          <TeamLogo
            schoolName={school.name}
            className="w-full h-full object-contain relative z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500"
          />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight group-hover:text-orange-500 transition-colors">
            {coach?.currentRank && (
              <span className="text-orange-600 mr-1.5">#{coach.currentRank}</span>
            )}
            {school.name}
          </h3>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
            {school.conference}
          </p>
        </div>

        <div className="pt-2 w-full flex justify-center">
          {getCoachStatus()}
        </div>
      </div>

      {/* Hover Indicator */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight size={16} className="text-orange-500" />
      </div>
    </motion.div>
  );
};
