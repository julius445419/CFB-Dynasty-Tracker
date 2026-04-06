import React, { useState, useMemo } from 'react';
import { X, Search, AlertCircle, CheckCircle2, UserPlus, ArrowRight, Loader2 } from 'lucide-react';
import { addDoc, collection, getDocs, query, where, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Prospect } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface AddRecruitModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  teamId: string;
}

type Step = 'initial' | 'checking' | 'match-found' | 'full-form' | 'success' | 'already-on-board';

const ARCHETYPES: Record<string, string[]> = {
  'QB': ['Field General', 'Scrambler', 'Improviser'],
  'RB': ['Power', 'Elusive', 'Receiving'],
  'WR': ['Deep Threat', 'Route Runner', 'Physical'],
  'TE': ['Vertical Threat', 'Possession', 'Blocking'],
  'LT': ['Power', 'Agile', 'Pass Protector'],
  'LG': ['Power', 'Agile', 'Pass Protector'],
  'C': ['Power', 'Agile', 'Pass Protector'],
  'RG': ['Power', 'Agile', 'Pass Protector'],
  'RT': ['Power', 'Agile', 'Pass Protector'],
  'DE': ['Power Rusher', 'Speed Rusher', 'Run Stopper'],
  'DT': ['Power Rusher', 'Run Stopper'],
  'LB': ['Field General', 'Run Stopper', 'Pass Coverage'],
  'CB': ['Man-to-Man', 'Zone', 'Slot'],
  'S': ['Zone', 'Run Support', 'Hybrid'],
  'K': ['Power', 'Accuracy'],
  'P': ['Power', 'Accuracy']
};

const POSITIONS = Object.keys(ARCHETYPES);

export const AddRecruitModal: React.FC<AddRecruitModalProps> = ({ isOpen, onClose, leagueId, teamId }) => {
  const [step, setStep] = useState<Step>('initial');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('QB');
  const [foundMatch, setFoundMatch] = useState<Prospect | null>(null);
  
  const [fullData, setFullData] = useState({
    stars: 3,
    archetype: '',
    hometown: '',
    state: '',
    height: '',
    weight: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedName = useMemo(() => {
    return `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
  }, [firstName, lastName]);

  if (!isOpen) return null;

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('checking');

    try {
      // 1. Check global pool
      const prospectsRef = collection(db, 'leagues', leagueId, 'prospects');
      const q = query(prospectsRef, where('pos', '==', position));
      const snapshot = await getDocs(q);
      
      const match = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.name.toLowerCase().trim() === normalizedName;
      });

      if (match) {
        const prospectData = { id: match.id, ...match.data() } as Prospect;
        
        // 2. Check if already on team board
        const targetsRef = collection(db, 'leagues', leagueId, 'teams', teamId, 'targets');
        
        // Try checking by prospectId first (most accurate)
        console.log(`Checking for duplicate prospectId: ${prospectData.id} in team: ${teamId}`);
        const idQuery = query(targetsRef, where('prospectId', '==', prospectData.id));
        const idSnapshot = await getDocs(idQuery);
        
        let isDuplicate = !idSnapshot.empty;

        if (!isDuplicate) {
          // Fallback: Check by name and position (for legacy data)
          console.log(`No prospectId match, checking legacy name/pos: ${prospectData.name} (${prospectData.pos})`);
          const nameQuery = query(targetsRef, where('name', '==', prospectData.name), where('pos', '==', prospectData.pos));
          const nameSnapshot = await getDocs(nameQuery);
          isDuplicate = !nameSnapshot.empty;
        }
        
        if (isDuplicate) {
          console.log("Duplicate found, stopping add process.");
          setStep('already-on-board');
          setFoundMatch(prospectData);
        } else {
          setFoundMatch(prospectData);
          setStep('match-found');
        }
      } else {
        setStep('full-form');
        // Set default archetype for the position
        setFullData(prev => ({ ...prev, archetype: ARCHETYPES[position][0] }));
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      setStep('full-form');
    }
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path,
    };
    console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleLinkExisting = async () => {
    if (!foundMatch) return;
    setIsSubmitting(true);

    const targetsRef = collection(db, 'leagues', leagueId, 'teams', teamId, 'targets');
    try {
      const { id: prospectId, ...prospectData } = foundMatch;
      
      // Ensure we don't save 'id' field into the target document
      const cleanProspectData = { ...prospectData };
      delete (cleanProspectData as any).id;

      await addDoc(targetsRef, {
        ...cleanProspectData,
        prospectId: prospectId,
        teamId,
        scoutingStatus: 'Normal',
        priority: 'Low',
        notes: '',
        topSchools: '',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, 'add', targetsRef.path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const prospectsRef = collection(db, 'leagues', leagueId, 'prospects');
    const targetsRef = collection(db, 'leagues', leagueId, 'teams', teamId, 'targets');

    try {
      const batch = writeBatch(db);
      
      // 1. Create in Global Pool
      const newProspectRef = doc(prospectsRef);
      const prospectData = {
        name: `${firstName.trim()} ${lastName.trim()}`,
        pos: position,
        stars: fullData.stars,
        archetype: fullData.archetype,
        hometown: fullData.hometown,
        state: fullData.state,
        height: fullData.height,
        weight: Number(fullData.weight),
        leagueId,
        createdAt: serverTimestamp(),
        commitStatus: 'Uncommitted',
        committedTo: ''
      };
      
      batch.set(newProspectRef, prospectData);

      // 2. Create in Team Board
      const newTargetRef = doc(targetsRef);
      // Ensure we don't save any 'id' field into the target document
      const { id: _, ...prospectDataForTarget } = prospectData as any;
      batch.set(newTargetRef, {
        ...prospectDataForTarget,
        prospectId: newProspectRef.id,
        teamId,
        scoutingStatus: 'Normal',
        priority: 'Low',
        notes: '',
        topSchools: '',
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, 'write_batch', `prospects:${prospectsRef.path}, targets:${targetsRef.path}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('initial');
    setFirstName('');
    setLastName('');
    setPosition('QB');
    setFoundMatch(null);
    setFullData({
      stars: 3,
      archetype: '',
      hometown: '',
      state: '',
      height: '',
      weight: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[32px] bg-zinc-950 border border-zinc-800 shadow-2xl relative">
        <button 
          onClick={handleClose} 
          className="absolute top-6 right-6 text-zinc-500 hover:text-white z-10 p-2 hover:bg-zinc-900 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 'initial' && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
                    <UserPlus className="text-orange-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Add New Target</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Step 1: Identity Check</p>
                  </div>
                </div>

                <form onSubmit={handleInitialSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">First Name</label>
                      <input
                        autoFocus
                        type="text"
                        placeholder="e.g. Arch"
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Last Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Manning"
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Position</label>
                    <div className="grid grid-cols-4 gap-2">
                      {POSITIONS.map(pos => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setPosition(pos)}
                          className={`py-3 rounded-xl text-[10px] font-black transition-all border ${
                            position === pos 
                              ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 group relative overflow-hidden rounded-2xl bg-white p-5 font-black text-black uppercase italic hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    Check for Duplicates
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'checking' && (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-20 flex flex-col items-center justify-center text-center gap-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 blur-2xl bg-orange-600/20 animate-pulse" />
                  <Loader2 className="h-12 w-12 animate-spin text-orange-600 relative" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic mb-2">Scanning Database</h3>
                  <p className="text-zinc-500 text-xs font-medium max-w-[240px]">Ensuring {firstName} {lastName} doesn't already exist in the league pool...</p>
                </div>
              </motion.div>
            )}

            {step === 'match-found' && foundMatch && (
              <motion.div
                key="match-found"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-600/10 rounded-xl flex items-center justify-center">
                    <AlertCircle className="text-amber-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Potential Match</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Duplicate Found in Global Pool</p>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-black text-white uppercase italic">{foundMatch.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-orange-500 font-black text-xs">{foundMatch.pos}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400 text-xs font-bold">{foundMatch.stars} Star {foundMatch.archetype}</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-lg ${i < foundMatch.stars ? 'text-orange-500' : 'text-zinc-800'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                    <div>
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Hometown</p>
                      <p className="text-sm font-bold text-zinc-300">{foundMatch.hometown}, {foundMatch.state}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Biometrics</p>
                      <p className="text-sm font-bold text-zinc-300">{foundMatch.height} / {foundMatch.weight} lbs</p>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <p className="text-zinc-400 text-sm font-medium">Is this the same player you are looking for?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleLinkExisting}
                      disabled={isSubmitting}
                      className="bg-white text-black font-black py-4 rounded-2xl uppercase italic text-xs hover:bg-zinc-200 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Adding...' : 'Yes, this is him'}
                    </button>
                    <button
                      onClick={() => setStep('full-form')}
                      className="bg-zinc-900 text-zinc-400 font-black py-4 rounded-2xl uppercase italic text-xs border border-zinc-800 hover:text-white hover:border-zinc-700 transition-all"
                    >
                      No, create new
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'full-form' && (
              <motion.div
                key="full-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
                    <Search className="text-orange-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Prospect Details</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Step 2: Complete Profile</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800 mb-2">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-orange-500 font-black">
                    {position}
                  </div>
                  <div>
                    <p className="text-white font-black uppercase italic">{firstName} {lastName}</p>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Net New Prospect</p>
                  </div>
                </div>

                <form onSubmit={handleFullSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Star Rating</label>
                      <select
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500 outline-none appearance-none"
                        value={fullData.stars}
                        onChange={(e) => setFullData({ ...fullData, stars: Number(e.target.value) })}
                      >
                        {[5, 4, 3, 2, 1].map(star => (
                          <option key={star} value={star}>{star} Stars</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Archetype</label>
                      <select
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500 outline-none appearance-none"
                        value={fullData.archetype}
                        onChange={(e) => setFullData({ ...fullData, archetype: e.target.value })}
                      >
                        {ARCHETYPES[position]?.map(arch => (
                          <option key={arch} value={arch}>{arch}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Height</label>
                      <input
                        type="text"
                        placeholder="e.g. 6'4&quot;"
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500 outline-none"
                        value={fullData.height}
                        onChange={(e) => setFullData({ ...fullData, height: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Weight (lbs)</label>
                      <input
                        type="number"
                        placeholder="e.g. 215"
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500 outline-none"
                        value={fullData.weight}
                        onChange={(e) => setFullData({ ...fullData, weight: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Hometown City</label>
                      <input
                        type="text"
                        placeholder="e.g. New Orleans"
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500 outline-none"
                        value={fullData.hometown}
                        onChange={(e) => setFullData({ ...fullData, hometown: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">State</label>
                      <input
                        type="text"
                        placeholder="e.g. LA"
                        className="w-full rounded-2xl bg-zinc-900 p-4 text-white border border-zinc-800 focus:border-orange-500 outline-none"
                        value={fullData.state}
                        onChange={(e) => setFullData({ ...fullData, state: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('initial')}
                      className="flex-1 bg-zinc-900 text-zinc-400 font-black py-5 rounded-2xl uppercase italic text-xs border border-zinc-800 hover:text-white transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] bg-orange-600 text-white font-black py-5 rounded-2xl uppercase italic text-xs hover:bg-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-orange-600/20"
                    >
                      {isSubmitting ? 'Saving...' : 'Save to Board'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 'already-on-board' && foundMatch && (
              <motion.div
                key="already-on-board"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="text-green-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Already Tracked</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Prospect is on your board</p>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-black text-white uppercase italic">{foundMatch.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-orange-500 font-black text-xs">{foundMatch.pos}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400 text-xs font-bold">{foundMatch.stars} Star {foundMatch.archetype}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <p className="text-zinc-400 text-sm font-medium">This player is already on your recruiting board.</p>
                  <button
                    onClick={handleClose}
                    className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase italic text-xs hover:bg-zinc-200 transition-all"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-20 flex flex-col items-center justify-center text-center gap-6"
              >
                <div className="w-20 h-20 bg-green-600/10 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 blur-2xl bg-green-600/20" />
                  <CheckCircle2 className="h-12 w-12 text-green-500 relative" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic mb-2">Target Added</h3>
                  <p className="text-zinc-500 text-xs font-medium">{firstName || foundMatch?.name} {lastName || ''} added to your recruiting board.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
