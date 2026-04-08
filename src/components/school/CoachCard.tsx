import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Shield, Award, User, Star, Settings2, Loader2 } from 'lucide-react';
import { TeamAssignment, CarouselCoach } from '../../types';
import { EditCoachModal } from '../modals/EditCoachModal';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

interface CoachCardProps {
  team: TeamAssignment;
  isEditable?: boolean;
}

export const CoachCard: React.FC<CoachCardProps> = ({ team, isEditable }) => {
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [staff, setStaff] = useState<{ HC?: CarouselCoach, OC?: CarouselCoach, DC?: CarouselCoach }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      if (!team.id) return;
      setLoading(true);
      try {
        const coachesRef = collection(db, 'coaches');
        const q = query(coachesRef, where('teamId', '==', team.id));
        const querySnapshot = await getDocs(q);
        
        const staffData: { HC?: CarouselCoach, OC?: CarouselCoach, DC?: CarouselCoach } = {};
        querySnapshot.forEach((doc) => {
          const coach = { id: doc.id, ...doc.data() } as CarouselCoach;
          if (coach.role === 'HC') staffData.HC = coach;
          else if (coach.role === 'OC') staffData.OC = coach;
          else if (coach.role === 'DC') staffData.DC = coach;
        });
        setStaff(staffData);
      } catch (error) {
        console.error("Error fetching coaching staff:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [team.id]);

  const renderCoachRow = (role: 'HC' | 'OC' | 'DC', label: string) => {
    const coach = staff[role];
    const isUser = coach?.userId === user?.uid;

    return (
      <div className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all ${
        isUser 
          ? 'bg-orange-600/10 border-orange-500/50 shadow-lg shadow-orange-600/5' 
          : 'bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${
            isUser ? 'bg-orange-600 border-orange-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
          }`}>
            <User size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`font-black uppercase tracking-tight italic ${isUser ? 'text-orange-500' : 'text-white'}`}>
                {coach ? coach.name : 'Vacant'}
              </h4>
              {isUser && (
                <span className="px-1.5 py-0.5 bg-orange-600 text-white text-[8px] font-black rounded uppercase tracking-widest animate-pulse">
                  YOU
                </span>
              )}
            </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
          </div>
        </div>

        {coach ? (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">School</p>
              <p className="text-xs font-black text-white">{coach.schoolWins}-{coach.schoolLosses}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Career</p>
              <p className="text-xs font-black text-white">{coach.careerWins}-{coach.careerLosses}</p>
            </div>
          </div>
        ) : (
          <div className="text-[10px] font-black text-zinc-700 uppercase tracking-widest italic">
            Position Open
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-12 flex items-center justify-center mb-6">
        <Loader2 className="animate-spin text-zinc-700" size={32} />
      </div>
    );
  }

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 mb-6 relative overflow-hidden group"
      >
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-orange-600/5 rounded-full blur-3xl group-hover:bg-orange-600/10 transition-all duration-500" />
        
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
              <Shield className="text-orange-500" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter text-white italic">Coaching <span className="text-orange-600">Staff</span></h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Program Leadership</p>
            </div>
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

        <div className="space-y-3 relative z-10">
          {renderCoachRow('HC', 'Head Coach')}
          {renderCoachRow('OC', 'Offensive Coordinator')}
          {renderCoachRow('DC', 'Defensive Coordinator')}
        </div>

        {/* Staff Stats Footer */}
        <div className="mt-6 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Program Prestige</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={10} className="text-orange-500" fill="currentColor" />
                <Star size={10} className="text-orange-500" fill="currentColor" />
                <Star size={10} className="text-orange-500" fill="currentColor" />
                <Star size={10} className="text-zinc-700" fill="currentColor" />
                <Star size={10} className="text-zinc-700" fill="currentColor" />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Staff Integrity</p>
            <p className="text-[10px] font-bold text-green-500 uppercase">Stable</p>
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
