import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Star, Gem, Skull, Info, GraduationCap, Trophy, Zap, MapPin, Plus, Trash2, Calendar, Loader2 } from 'lucide-react';
import { Target } from '../../types';
import { useLeague } from '../../context/LeagueContext';
import { useAuth } from '../../context/AuthContext';

interface ScoutingDrawerProps {
  target: Target | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<Target>, globalData: { commitStatus?: string, committedTo?: string }) => void;
  isOwner?: boolean;
}

export const ScoutingDrawer: React.FC<ScoutingDrawerProps> = ({ target, isOpen, onClose, onSave, isOwner = true }) => {
  const { userTeam, userRole } = useLeague();
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [topSchools, setTopSchools] = useState('');
  const [commitStatus, setCommitStatus] = useState<'Uncommitted' | 'Committed to My School' | 'Committed Elsewhere'>('Uncommitted');
  const [committedTo, setCommittedTo] = useState('');
  const [devTrait, setDevTrait] = useState<'Normal' | 'Impact' | 'Star' | 'Elite' | 'Unknown'>('Unknown');
  const [visits, setVisits] = useState('');
  const [scoutedRatings, setScoutedRatings] = useState<Record<string, string>>({});
  const [newRatingKey, setNewRatingKey] = useState('');
  const [newRatingValue, setNewRatingValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setNotes(target.notes || '');
      setTopSchools(target.topSchools || '');
      
      // Dynamically evaluate commit status based on current user's school
      if (!target.committedTo || target.committedTo === '') {
        setCommitStatus('Uncommitted');
        setCommittedTo('');
      } else if (target.committedTo === userTeam?.school) {
        setCommitStatus('Committed to My School');
        setCommittedTo(userTeam?.school || '');
      } else {
        setCommitStatus('Committed Elsewhere');
        setCommittedTo(target.committedTo);
      }
      
      setDevTrait(target.devTrait || 'Unknown');
      setVisits(target.visits || '');
      setScoutedRatings(target.scoutedRatings || {});
      setIsSaving(false);
    }
  }, [target, userTeam]);

  const isCommitLocked = useMemo(() => {
    if (!target || target.commitStatus !== 'Committed') return false;
    
    // Unlock for Commissioner/Owner
    if (userRole === 'Commissioner' || userRole === 'Owner') return false;
    
    // Unlock for the school the player is committed to
    if (userTeam?.school === target.committedTo) return false;
    
    // Unlock for the original user who set the status
    if (user?.uid === target.committedByUserId) return false;
    
    return true;
  }, [target, userRole, userTeam, user]);

  if (!target) return null;

  const handleAddRating = () => {
    if (!newRatingKey.trim() || !newRatingValue.trim()) return;
    setScoutedRatings(prev => ({
      ...prev,
      [newRatingKey.trim()]: newRatingValue.trim()
    }));
    setNewRatingKey('');
    setNewRatingValue('');
  };

  const handleRemoveRating = (key: string) => {
    const next = { ...scoutedRatings };
    delete next[key];
    setScoutedRatings(next);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // Determine the actual school name and status to store globally
    let finalCommittedTo = '';
    let finalCommitStatus = 'Uncommitted';

    if (commitStatus === 'Committed to My School') {
      finalCommittedTo = userTeam?.school || '';
      finalCommitStatus = 'Committed';
    } else if (commitStatus === 'Committed Elsewhere') {
      finalCommittedTo = committedTo;
      finalCommitStatus = 'Committed';
    }

    await onSave(target.id, {
      notes,
      topSchools,
      devTrait,
      visits,
      scoutedRatings
    }, {
      commitStatus: finalCommitStatus,
      committedTo: finalCommittedTo
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-[70] bg-zinc-950 rounded-t-[32px] border-t border-zinc-800 max-h-[92vh] overflow-y-auto custom-scrollbar p-6 pb-24 sm:max-w-lg sm:mx-auto"
          >
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />

            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
                  target.scoutingStatus === 'Gem' ? 'bg-green-600/20 border-green-500/30' :
                  target.scoutingStatus === 'Bust' ? 'bg-red-600/20 border-red-500/30' :
                  'bg-zinc-900 border-zinc-800'
                }`}>
                  {target.scoutingStatus === 'Gem' ? <Gem className="text-green-500" size={32} /> :
                   target.scoutingStatus === 'Bust' ? <Skull className="text-red-500" size={32} /> :
                   <Star className="text-orange-500" size={32} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase italic tracking-tight leading-tight">{target.name}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest">{target.pos} • {target.stars} STAR</span>
                    <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">•</span>
                    <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">{target.archetype}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                    <MapPin size={10} /> {target.hometown}, {target.state} • {target.height} / {target.weight} lbs
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Global Commitment Status */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  <Trophy size={12} className="text-orange-600" />
                  Global Commitment Status
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(['Uncommitted', 'Committed to My School', 'Committed Elsewhere'] as const).map((status) => (
                    <button
                      key={status}
                      disabled={!isOwner || isCommitLocked}
                      onClick={() => setCommitStatus(status)}
                      className={`w-full p-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all text-left flex items-center justify-between ${
                        commitStatus === status 
                          ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                      } ${(!isOwner || (isCommitLocked && commitStatus !== status)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {status}
                      {commitStatus === status && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </button>
                  ))}
                </div>
                {commitStatus === 'Committed Elsewhere' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 mt-2"
                  >
                    <input
                      type="text"
                      disabled={!isOwner || isCommitLocked}
                      value={committedTo}
                      onChange={(e) => setCommittedTo(e.target.value)}
                      placeholder="Enter school name (e.g. Texas)"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-orange-600 transition-colors placeholder:text-zinc-700 disabled:opacity-50"
                    />
                  </motion.div>
                )}
                {isCommitLocked && (
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                    <Info size={10} /> Commitment is locked by {target.committedTo}
                  </p>
                )}
              </div>

              {/* Private Scouting Intel - Only visible to Owner */}
              {isOwner && (
                <div className="space-y-6 pt-6 border-t border-zinc-800">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Zap size={12} className="text-orange-600" />
                      Development Trait
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(['Normal', 'Impact', 'Star', 'Elite', 'Unknown'] as const).map((trait) => (
                        <button
                          key={trait}
                          onClick={() => setDevTrait(trait)}
                          className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            devTrait === trait 
                              ? 'bg-zinc-100 border-white text-black' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          {trait}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Star size={12} className="text-orange-600" />
                      Scouted Ratings
                    </label>
                    <div className="space-y-2">
                      {Object.entries(scoutedRatings).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{key}:</span>
                            <span className="text-sm font-bold text-white">{val}</span>
                          </div>
                          <button onClick={() => handleRemoveRating(key)} className="text-zinc-600 hover:text-red-500 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Attribute (e.g. Speed)"
                          value={newRatingKey}
                          onChange={(e) => setNewRatingKey(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-[10px] text-white focus:outline-none focus:border-zinc-600"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Grade (e.g. 94)"
                            value={newRatingValue}
                            onChange={(e) => setNewRatingValue(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-[10px] text-white focus:outline-none focus:border-zinc-600"
                          />
                          <button 
                            onClick={handleAddRating}
                            className="bg-zinc-800 text-white p-3 rounded-xl hover:bg-zinc-700"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Calendar size={12} className="text-orange-600" />
                      Visit Tracker
                    </label>
                    <textarea
                      value={visits}
                      onChange={(e) => setVisits(e.target.value)}
                      placeholder="Week 4 - Home vs Texas, Week 6 - Away..."
                      className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-orange-600 transition-colors resize-none placeholder:text-zinc-700"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <Info size={12} className="text-orange-600" />
                      General Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Elite speed, poor hands, high motor..."
                      className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-orange-600 transition-colors resize-none placeholder:text-zinc-700"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                {isOwner && (
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 bg-orange-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-500 transition-all active:scale-[0.98] shadow-lg shadow-orange-600/20 uppercase italic text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Save size={18} />
                    )}
                    {isSaving ? 'SAVING...' : 'SAVE RECRUIT PROFILE'}
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className={`${isOwner ? 'px-8' : 'flex-1'} bg-zinc-800 text-white font-black py-5 rounded-2xl hover:bg-zinc-700 transition-all active:scale-[0.98] uppercase italic text-xs tracking-widest`}
                >
                  {isOwner ? 'CANCEL' : 'CLOSE'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
