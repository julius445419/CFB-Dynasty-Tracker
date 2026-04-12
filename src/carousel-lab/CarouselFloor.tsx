import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Search, 
  Users, 
  X, 
  ArrowRight, 
  History, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  UserPlus,
  ArrowUpRight,
  ChevronRight,
  RefreshCcw,
  Save,
  Loader2
} from 'lucide-react';
import { useLab } from './LabContext';
import { useLeague } from '../context/LeagueContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CarouselCoach } from '../types';
import { SCHOOLS } from '../constants/schools';
import { CoachPersona } from './types';

interface CarouselFloorProps {
  activeTab: 'staffing' | 'firing' | 'carousel';
  setActiveTab: (tab: 'staffing' | 'firing' | 'carousel') => void;
}

const CarouselFloor: React.FC<CarouselFloorProps> = ({ activeTab, setActiveTab }) => {
  const { state, hireCoach, resetLab, commitChanges, isCommitting } = useLab();
  const { currentLeagueId } = useLeague();
  const [liveCoaches, setLiveCoaches] = useState<CarouselCoach[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [activePickerTab, setActivePickerTab] = useState<'staging' | 'unassigned' | 'active'>('staging');
  const [pickerSearch, setPickerSearch] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showCommitSuccess, setShowCommitSuccess] = useState(false);
  const [commitCount, setCommitCount] = useState(0);

  useEffect(() => {
    if (currentLeagueId) {
      fetchLiveCoaches();
    }
  }, [currentLeagueId]);

  const fetchLiveCoaches = async () => {
    if (!currentLeagueId) return;
    setIsLoadingLive(true);
    try {
      const coachesRef = collection(db, 'coaches');
      const q = query(coachesRef, where('leagueId', '==', currentLeagueId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CarouselCoach[];
      setLiveCoaches(data);
    } catch (err) {
      console.error('Error fetching live coaches:', err);
    } finally {
      setIsLoadingLive(false);
    }
  };

  const handleCommit = async () => {
    if (!currentLeagueId) return;
    
    if (!window.confirm('Are you sure you want to commit these changes to the live database?')) {
      return;
    }

    try {
      const count = await commitChanges(currentLeagueId, liveCoaches);
      setCommitCount(count);
      setShowCommitSuccess(true);
      fetchLiveCoaches();
      setTimeout(() => setShowCommitSuccess(false), 5000);
    } catch (err) {
      // Error handled by context
    }
  };

  // Calculate Vacancies
  const vacancies = useMemo(() => {
    return state.slots.filter(slot => {
      // If it's filled in stagedHires, it's not vacant
      if (state.stagedHires[slot.id]) return false;
      
      // If it's in stagedFires, it's vacant
      if (state.stagedFires.includes(slot.id)) return true;
      
      // If it was originally vacant
      if (!slot.personaId) return true;

      return false;
    });
  }, [state.slots, state.stagedFires, state.stagedHires]);

  const filteredVacancies = vacancies.filter(v => 
    v.schoolId.toLowerCase().includes(search.toLowerCase()) ||
    v.role.toLowerCase().includes(search.toLowerCase())
  );

  // Picker Data
  const stagingPool = useMemo(() => {
    // Coaches fired in Stage 1
    const firedPersonaIds = Object.keys(state.stagedDispositions);
    // Filter out those already re-hired
    const hiredPersonaIds = Object.values(state.stagedHires);
    return state.personas.filter(p => 
      firedPersonaIds.includes(p.id) && !hiredPersonaIds.includes(p.id)
    );
  }, [state.personas, state.stagedDispositions, state.stagedHires]);

  const unassignedPool = useMemo(() => {
    // Coaches who started without a job
    const employedPersonaIds = state.slots.map(s => s.personaId).filter(Boolean);
    const hiredPersonaIds = Object.values(state.stagedHires);
    return state.personas.filter(p => 
      !employedPersonaIds.includes(p.id) && !hiredPersonaIds.includes(p.id)
    );
  }, [state.personas, state.slots, state.stagedHires]);

  const activeCoaches = useMemo(() => {
    // Coaches currently employed (not fired, not re-hired elsewhere)
    const hiredPersonaIds = Object.values(state.stagedHires);
    return state.slots
      .filter(s => s.personaId && !state.stagedFires.includes(s.id))
      .map(s => {
        const persona = state.personas.find(p => p.id === s.personaId);
        return { persona, slot: s };
      })
      .filter(item => item.persona && !hiredPersonaIds.includes(item.persona.id));
  }, [state.slots, state.stagedFires, state.personas, state.stagedHires]);

  const handleHire = (personaId: string) => {
    if (selectedSlotId) {
      hireCoach(selectedSlotId, personaId);
      setSelectedSlotId(null);
      setPickerSearch('');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      {/* Header */}
      <header className="max-w-full mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Briefcase size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">
              Carousel <span className="text-blue-600">Floor</span>
            </h1>
          </div>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
            Carousel Phase 2: Fill Vacancies • The Ripple Effect
          </p>
        </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveTab('staffing')}
                className={`px-4 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'staffing' ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Staffing
              </button>
              <button 
                onClick={() => setActiveTab('firing')}
                className={`px-4 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'firing' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Firing Room
              </button>
              <button 
                onClick={() => setActiveTab('carousel')}
                className={`px-4 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'carousel' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Carousel Floor
              </button>
              <button 
                onClick={resetLab}
                className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-500 transition-all"
                title="Reset Sandbox"
              >
                <RefreshCcw size={16} />
              </button>

              <div className="w-px h-6 bg-zinc-800 mx-2" />

              <button 
                onClick={handleCommit}
                disabled={isCommitting || isLoadingLive}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${
                  isCommitting 
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                }`}
              >
                {isCommitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {isCommitting ? 'Committing...' : 'Commit Changes'}
              </button>

              <div className="w-px h-6 bg-zinc-800 mx-2" />

              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2"
              >
                <History size={14} />
                Move History
                {state.moveHistory.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px]">
                    {state.moveHistory.length}
                  </span>
                )}
              </button>
            </div>
      </header>

      <main className="max-w-full mx-auto space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input 
            type="text" 
            placeholder="Search vacancies by school or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-[24px] pl-16 pr-6 py-5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
          />
        </div>

        {/* Vacancy Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredVacancies.map(vacancy => {
            const school = SCHOOLS.find(s => s.name === vacancy.schoolId);
            const previousPersona = state.personas.find(p => p.id === vacancy.personaId);

            return (
              <motion.div 
                layout
                key={vacancy.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-6 flex flex-col justify-between gap-6"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-950 flex items-center justify-center p-2 border border-zinc-800">
                    {school && (
                      <img 
                        src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} 
                        alt="" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tight">{vacancy.schoolId}</h3>
                    <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{vacancy.role}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">Replacing</p>
                  <p className="font-bold text-zinc-400">
                    {previousPersona ? previousPersona.name : 'New Position'}
                  </p>
                </div>

                <button 
                  onClick={() => setSelectedSlotId(vacancy.id)}
                  className="w-full py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10"
                >
                  <UserPlus size={14} />
                  Fill Position
                </button>
              </motion.div>
            );
          })}
        </div>

        {filteredVacancies.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-700">
              <CheckCircle2 size={40} />
            </div>
            <p className="text-zinc-500 font-bold italic">No active vacancies. All positions filled.</p>
          </div>
        )}
      </main>

      {/* Hiring Picker Modal */}
      <AnimatePresence>
        {selectedSlotId && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSlotId(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] bg-zinc-900 border border-zinc-800 rounded-[40px] z-[101] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-800 shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase italic">Hire <span className="text-blue-600">Coach</span></h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                    Filling {state.slots.find(s => s.id === selectedSlotId)?.role} at {state.slots.find(s => s.id === selectedSlotId)?.schoolId}
                  </p>
                </div>
                <button onClick={() => setSelectedSlotId(null)} className="p-3 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'staging', label: 'Staging Pool', count: stagingPool.length },
                  { id: 'unassigned', label: 'Unassigned', count: unassignedPool.length },
                  { id: 'active', label: 'Active (Poach)', count: activeCoaches.length }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActivePickerTab(tab.id as any)}
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                      activePickerTab === tab.id 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search coaches..."
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {activePickerTab === 'staging' && stagingPool.filter(p => p.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(persona => (
                  <button 
                    key={persona.id}
                    onClick={() => handleHire(persona.id)}
                    className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-blue-600/50 hover:bg-zinc-900 transition-all group"
                  >
                    <div className="text-left">
                      <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{persona.name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Fired in Stage 1</p>
                    </div>
                    <ArrowUpRight size={18} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}

                {activePickerTab === 'unassigned' && unassignedPool.filter(p => p.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(persona => (
                  <button 
                    key={persona.id}
                    onClick={() => handleHire(persona.id)}
                    className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-blue-600/50 hover:bg-zinc-900 transition-all group"
                  >
                    <div className="text-left">
                      <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{persona.name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Free Agent</p>
                    </div>
                    <ArrowUpRight size={18} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}

                {activePickerTab === 'active' && activeCoaches.filter(item => item.persona!.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(({ persona, slot }) => (
                  <button 
                    key={persona!.id}
                    onClick={() => {
                      handleHire(persona!.id);
                    }}
                    className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-red-600/50 hover:bg-zinc-900 transition-all group"
                  >
                    <div className="text-left">
                      <p className="font-bold text-white group-hover:text-red-400 transition-colors">{persona!.name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                        Currently {slot.role} at {slot.schoolId}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-600/10 px-1.5 py-0.5 rounded">POACH</span>
                      <ArrowUpRight size={18} className="text-zinc-700 group-hover:text-red-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Move History Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 z-[101] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic">Move <span className="text-blue-600">History</span></h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">The Ripple Effect Timeline</p>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {state.moveHistory.length === 0 ? (
                  <div className="text-center py-24 space-y-4">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-600">
                      <History size={32} />
                    </div>
                    <p className="text-zinc-500 font-bold italic">No moves recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                    {[...state.moveHistory].reverse().map((event) => (
                      <div key={event.id} className="relative pl-12">
                        <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-black flex items-center justify-center z-10 ${
                          event.type === 'HIRE' ? 'bg-green-600' :
                          event.type === 'POACH' ? 'bg-blue-600' :
                          'bg-red-600'
                        }`}>
                          {event.type === 'HIRE' ? <UserPlus size={16} className="text-white" /> :
                           event.type === 'POACH' ? <ArrowUpRight size={16} className="text-white" /> :
                           <AlertTriangle size={16} className="text-white" />}
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
                            {event.type === 'HIRE' && (
                              <p className="text-sm font-bold text-zinc-300">
                                <span className="text-green-500 font-black uppercase italic tracking-tight">{event.coachName}</span> hired as {event.role} at <span className="text-white">{event.toSchool}</span>.
                              </p>
                            )}
                            {event.type === 'POACH' && (
                              <p className="text-sm font-bold text-zinc-300">
                                <span className="text-blue-500 font-black uppercase italic tracking-tight">{event.coachName}</span> poached from {event.fromSchool} to be {event.role} at <span className="text-white">{event.toSchool}</span>.
                              </p>
                            )}
                            {event.type === 'VACANCY' && (
                              <p className="text-sm font-bold text-zinc-300">
                                <span className="text-red-500 font-black uppercase italic tracking-tight">{event.fromSchool} {event.role}</span> is now vacant.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarouselFloor;
