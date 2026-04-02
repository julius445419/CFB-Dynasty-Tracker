import React from 'react';
import { Prospect, Target } from '../../types';
import { Star, Gem, Skull, MapPin, User, Trash2, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { useLeague } from '../../context/LeagueContext';

interface RecruitCardProps {
  recruit: Prospect | Target;
  isTarget?: boolean;
  onTrack?: (recruit: Prospect) => void;
  onUpdateStatus?: (id: string, status: 'Normal' | 'Gem' | 'Bust') => void;
  onUpdatePriority?: (id: string, priority: 'Low' | 'Med' | 'High' | 'Top Target') => void;
  onRemove?: (id: string) => void;
  onClick?: (recruit: Prospect | Target) => void;
}

export const RecruitCard: React.FC<RecruitCardProps> = ({
  recruit,
  isTarget = false,
  onTrack,
  onUpdateStatus,
  onUpdatePriority,
  onRemove,
  onClick
}) => {
  const { userTeam } = useLeague();
  const target = recruit as Target;
  
  // Dynamically determine if the recruit is committed to the current user's school
  const isMySchool = userTeam?.school && recruit.committedTo === userTeam.school;
  const isCommitted = recruit.committedTo && recruit.committedTo !== '';

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'Top Target': return 'bg-orange-600 text-white border-orange-500';
      case 'High': return 'bg-orange-600/20 text-orange-500 border-orange-600/30';
      case 'Med': return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      case 'Low': return 'bg-zinc-900 text-zinc-500 border-zinc-800';
      default: return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 shadow-lg transition-all hover:border-zinc-700 ${
        target.scoutingStatus === 'Gem' ? 'border-green-500/50 bg-green-500/5 ring-1 ring-green-500/20' : 
        target.scoutingStatus === 'Bust' ? 'border-red-500/50 bg-red-500/5 ring-1 ring-red-500/20' : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 cursor-pointer" onClick={() => onClick?.(recruit)}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-black text-white uppercase italic tracking-tight">{recruit.name}</h3>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  size={12} 
                  className={i < recruit.stars ? "fill-orange-500 text-orange-500" : "text-zinc-700"} 
                />
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <span className="flex items-center gap-1"><User size={12} className="text-orange-600" /> {recruit.pos} • {recruit.archetype}</span>
            <span className="flex items-center gap-1"><MapPin size={12} className="text-orange-600" /> {recruit.hometown}, {recruit.state}</span>
          </div>

          {isCommitted && (
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border ${
              isMySchool 
                ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}>
              <Trophy size={10} />
              {isMySchool ? `Committed to ${userTeam?.school}` : `Committed to ${recruit.committedTo === 'My School' ? 'a Rival' : recruit.committedTo}`}
            </div>
          )}
        </div>

        {isTarget ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(recruit.id);
            }}
            className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        ) : onTrack ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onTrack?.(recruit);
            }}
            className="rounded-full bg-orange-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 active:scale-95 transition-transform"
          >
            Track
          </button>
        ) : null}
      </div>

      {isTarget && target && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
              {(['Normal', 'Gem', 'Bust'] as const).map((status) => (
                <button
                  key={status}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus?.(recruit.id, status);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                    target.scoutingStatus === status 
                      ? status === 'Gem' ? 'bg-green-600 text-white' : status === 'Bust' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {status === 'Gem' && <Gem size={12} />}
                  {status === 'Bust' && <Skull size={12} />}
                  {status}
                </button>
              ))}
            </div>

            <select
              value={target.priority}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onUpdatePriority?.(recruit.id, e.target.value as any);
              }}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none transition-all appearance-none text-center ${getPriorityColor(target.priority)}`}
            >
              <option value="Low">Low Priority</option>
              <option value="Med">Med Priority</option>
              <option value="High">High Priority</option>
              <option value="Top Target">Top Target</option>
            </select>
          </div>
          
          {target.notes && (
            <div className="rounded-lg bg-zinc-950/50 p-3 border border-zinc-800/50" onClick={() => onClick?.(recruit)}>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Scouting Notes</p>
              <p className="text-xs text-zinc-300 line-clamp-2 italic leading-relaxed">"{target.notes}"</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
