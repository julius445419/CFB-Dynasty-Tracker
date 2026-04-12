import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  Users, 
  ChevronRight, 
  X, 
  UserMinus,
  AlertCircle,
  ArrowRight,
  Info,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  Settings2,
  Zap,
  Save,
  Loader2
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLab } from './LabContext';
import { useLeague } from '../context/LeagueContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CarouselCoach } from '../types';
import { SCHOOLS } from '../constants/schools';

const CONFERENCES = ['ALL', ...Array.from(new Set(SCHOOLS.map(s => s.conference))).sort()];

interface FiringRoomProps {
  activeTab: 'staffing' | 'firing' | 'carousel';
  setActiveTab: (tab: 'staffing' | 'firing' | 'carousel') => void;
}

const FiringRoom: React.FC<FiringRoomProps> = ({ activeTab, setActiveTab }) => {
  const { state, stageFire, batchStageFire, undoFire, batchUndoFire, setDisposition, resetLab, commitChanges, isCommitting } = useLab();
  const { currentLeagueId } = useLeague();
  const [liveCoaches, setLiveCoaches] = useState<CarouselCoach[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [search, setSearch] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState('ALL');
  const [roleFocus, setRoleFocus] = useState<'ALL' | 'HC' | 'OC' | 'DC'>('ALL');
  const [isPoolOpen, setIsPoolOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [mobileRoleIndex, setMobileRoleIndex] = useState<Record<string, number>>({}); // schoolId -> index
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'fire' | 'undo'}[]>([]);
  const [showCommitSuccess, setShowCommitSuccess] = useState(false);
  const [commitCount, setCommitCount] = useState(0);
  
  const parentRef = useRef<HTMLDivElement>(null);

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

  const addNotification = (message: string, type: 'fire' | 'undo') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const filteredSchools = useMemo(() => {
    return SCHOOLS.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                           s.conference.toLowerCase().includes(search.toLowerCase());
      const matchesConference = conferenceFilter === 'ALL' || s.conference === conferenceFilter;
      return matchesSearch && matchesConference;
    });
  }, [search, conferenceFilter]);

  const rowVirtualizer = useVirtualizer({
    count: filteredSchools.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const toggleSlotSelection = (slotId: string, index: number, event?: React.MouseEvent | React.KeyboardEvent) => {
    if (event?.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      const slotsInRange: string[] = [];
      for (let i = start; i <= end; i++) {
        const school = filteredSchools[i];
        const schoolSlots = state.slots.filter(s => s.schoolId === school.name);
        schoolSlots.forEach(slot => {
          if ((roleFocus === 'ALL' || roleFocus === slot.role) && slot.personaId) {
            slotsInRange.push(slot.id);
          }
        });
      }
      
      setSelectedSlots(prev => {
        const newSelection = new Set(prev);
        slotsInRange.forEach(id => newSelection.add(id));
        return Array.from(newSelection);
      });
    } else {
      setSelectedSlots(prev => 
        prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
      );
    }
    setLastSelectedIndex(index);
  };

  const allVisibleSlots = useMemo(() => {
    const slots: string[] = [];
    filteredSchools.forEach(school => {
      const schoolSlots = state.slots.filter(s => s.schoolId === school.name);
      schoolSlots.forEach(slot => {
        if ((roleFocus === 'ALL' || roleFocus === slot.role) && slot.personaId) {
          slots.push(slot.id);
        }
      });
    });
    return slots;
  }, [filteredSchools, state.slots, roleFocus]);

  const isAllSelected = allVisibleSlots.length > 0 && allVisibleSlots.every(id => selectedSlots.includes(id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSlots([]);
    } else {
      setSelectedSlots(allVisibleSlots);
    }
  };

  const handleBatchFire = () => {
    const slotsToFire = selectedSlots.filter(id => !state.stagedFires.includes(id));
    if (slotsToFire.length === 0) return;
    batchStageFire(slotsToFire);
    addNotification(`${slotsToFire.length} coaches added to Staging Pool`, 'fire');
    setSelectedSlots([]);
  };

  const handleBatchUndo = () => {
    const slotsToUndo = selectedSlots.filter(id => state.stagedFires.includes(id));
    if (slotsToUndo.length === 0) return;
    batchUndoFire(slotsToUndo);
    addNotification(`Reinstated ${slotsToUndo.length} coaches`, 'undo');
    setSelectedSlots([]);
  };

  const firedPersonas = (state.stagedFires || []).map(slotId => {
    const slot = (state.slots || []).find(s => s.id === slotId);
    const persona = (state.personas || []).find(p => p.id === slot?.personaId);
    const pilot = persona?.pilotId ? (state.pilots || []).find(p => p.id === persona.pilotId) : null;
    return { slot, persona, pilot };
  }).filter(item => item.persona);

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      {/* Stationary Header */}
      <header className="shrink-0 bg-zinc-950 border-b border-zinc-900 p-4 z-40">
        <div className="max-w-full mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-600 rounded-lg">
                <UserMinus size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">
                  Firing <span className="text-red-600">Room</span>
                </h1>
                <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-1">Carousel Phase 1: Identify Departures</p>
              </div>
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
                <RotateCcw size={16} />
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
                onClick={() => setIsPoolOpen(true)}
                className="relative px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center gap-2"
              >
                <Users size={14} />
                Staging Pool
                {firedPersonas.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 text-white text-[8px] flex items-center justify-center rounded-full border border-black">
                    {firedPersonas.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input 
                type="text" 
                placeholder="Search schools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-600/50"
              />
            </div>

            {/* Conference Filter */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1">
              <Filter size={12} className="text-zinc-500" />
              <select 
                value={conferenceFilter}
                onChange={(e) => setConferenceFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest focus:outline-none cursor-pointer"
              >
                {CONFERENCES.map(conf => (
                  <option key={conf} value={conf} className="bg-zinc-900">{conf}</option>
                ))}
              </select>
            </div>

            {/* Role Focus Toggle */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {['ALL', 'HC', 'OC', 'DC'].map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFocus(role as any)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    roleFocus === role ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content: Virtualized List */}
        <main className="flex-1 overflow-hidden flex flex-col bg-zinc-950">
          {/* List Header (Desktop Only) */}
          <div className="hidden md:grid grid-cols-[300px_1fr] lg:grid-cols-[360px_1fr] xl:grid-cols-[440px_1fr] border-b border-zinc-900 bg-zinc-900/30 shrink-0">
            <div className="p-4 flex items-center gap-4 border-r border-zinc-900">
              <button 
                onClick={handleSelectAll}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  isAllSelected ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {isAllSelected && <CheckSquare size={12} />}
              </button>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Program / Conference</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-zinc-900">
              {(roleFocus === 'ALL' || roleFocus === 'HC') && <div className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Head Coach</div>}
              {(roleFocus === 'ALL' || roleFocus === 'OC') && <div className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Offensive Coord.</div>}
              {(roleFocus === 'ALL' || roleFocus === 'DC') && <div className="p-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Defensive Coord.</div>}
            </div>
          </div>

          <div ref={parentRef} className="flex-1 overflow-y-auto custom-scrollbar pb-32 md:pb-0">
            <div 
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const school = filteredSchools[virtualRow.index];
                const schoolSlots = state.slots.filter(s => s.schoolId === school.name);
                const hasHuman = schoolSlots.some(s => {
                  const p = state.personas.find(pers => pers.id === s.personaId);
                  return p?.pilotId;
                });

                return (
                  <div
                    key={virtualRow.index}
                    className="absolute top-0 left-0 w-full border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Desktop Row */}
                    <div className="hidden md:flex h-full items-stretch">
                      {/* Accent Bar */}
                      <div 
                        className={`w-0.5 shrink-0 transition-all duration-500 ${hasHuman ? 'opacity-100' : 'opacity-20'}`}
                        style={{ backgroundColor: school.color }}
                      />

                      <div className="flex items-center gap-4 px-4 w-[280px] lg:w-[340px] xl:w-[420px] shrink-0">
                        {/* Bulk Checkbox */}
                        <button 
                          onClick={(e) => {
                            const slots = schoolSlots.filter(s => (roleFocus === 'ALL' || roleFocus === s.role) && s.personaId);
                            if (slots.length > 0) {
                              const allSelected = slots.every(s => selectedSlots.includes(s.id));
                              if (allSelected) {
                                setSelectedSlots(prev => prev.filter(id => !slots.map(s => s.id).includes(id)));
                              } else {
                                setSelectedSlots(prev => {
                                  const next = new Set(prev);
                                  slots.forEach(s => next.add(s.id));
                                  return Array.from(next);
                                });
                              }
                              setLastSelectedIndex(virtualRow.index);
                            }
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                            schoolSlots.some(s => (roleFocus === 'ALL' || roleFocus === s.role) && selectedSlots.includes(s.id))
                              ? 'bg-red-600 border-red-600 text-white opacity-100' 
                              : 'border-zinc-800 opacity-0 group-hover:opacity-50 hover:opacity-100'
                          }`}
                        >
                          {schoolSlots.some(s => (roleFocus === 'ALL' || roleFocus === s.role) && selectedSlots.includes(s.id)) && <CheckSquare size={10} />}
                        </button>

                        <div className="h-8 w-8 shrink-0 rounded bg-zinc-900 flex items-center justify-center p-1 border border-zinc-800">
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} 
                            alt="" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[11px] font-black uppercase italic tracking-tight truncate">{school.name}</h3>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">{school.conference}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 h-full flex-1 divide-x divide-zinc-900/50">
                        {['HC', 'OC', 'DC'].map(role => {
                          if (roleFocus !== 'ALL' && roleFocus !== role) return null;
                          const slot = schoolSlots.find(s => s.role === role);
                          if (!slot) return <div key={role} className="flex-1" />;

                          const persona = state.personas.find(p => p.id === slot.personaId);
                          const pilot = state.pilots.find(p => p.id === persona?.pilotId);
                          const isSelected = selectedSlots.includes(slot.id);
                          const isFired = state.stagedFires.includes(slot.id);

                          return (
                            <div 
                              key={slot.id} 
                              className={`flex-1 px-4 flex items-center justify-between gap-3 transition-all ${
                                roleFocus !== 'ALL' ? 'col-span-3' : ''
                              } ${isSelected ? 'bg-red-600/5' : ''} ${isFired ? 'bg-red-600/5' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button 
                                  onClick={(e) => toggleSlotSelection(slot.id, virtualRow.index, e)}
                                  className={`shrink-0 transition-colors ${isSelected ? 'text-red-600' : 'text-zinc-800 group-hover:text-zinc-600'}`}
                                >
                                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                                
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Status Pip */}
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isFired ? 'bg-red-600 animate-pulse' :
                                    pilot 
                                      ? pilot.type === 'REAL' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                                      : 'bg-zinc-600'
                                  }`} />

                                  <div className="min-w-0 flex flex-col justify-center">
                                    <span className={`text-[11px] font-bold truncate ${persona ? isFired ? 'text-zinc-500 line-through' : 'text-zinc-200' : 'text-zinc-600 italic'}`}>
                                      {persona ? persona.name : 'VACANT'}
                                    </span>
                                    {pilot && (
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                                        {pilot.systemName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 transition-opacity">
                                {persona && (
                                  isFired ? (
                                    <button 
                                      onClick={() => {
                                        undoFire(slot.id);
                                        addNotification(`Reinstated ${persona.name}`, 'undo');
                                      }}
                                      className="p-1 bg-zinc-900 rounded text-zinc-500 hover:text-white transition-colors"
                                      title="Undo Firing"
                                    >
                                      <RotateCcw size={10} />
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        stageFire(slot.id);
                                        addNotification(`${persona.name} added to Staging Pool`, 'fire');
                                      }}
                                      className="p-1 bg-zinc-900 rounded text-zinc-700 hover:text-red-500 transition-colors"
                                      title="Fire Coach"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mobile Staffing Strip */}
                    <div className="md:hidden flex h-full items-stretch relative">
                      {/* Accent Bar */}
                      <div 
                        className={`w-0.5 shrink-0 transition-all duration-500 ${hasHuman ? 'opacity-100' : 'opacity-20'}`}
                        style={{ backgroundColor: school.color }}
                      />
                      
                      <div className="flex-1 flex items-center px-3 gap-3 min-w-0">
                        {/* Logo */}
                        <div className="h-8 w-8 shrink-0 rounded bg-zinc-900 flex items-center justify-center p-1 border border-zinc-800">
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} 
                            alt="" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Abbreviation */}
                        <div className="w-10 shrink-0">
                          <h3 className="text-[10px] font-black uppercase italic tracking-tighter text-zinc-400 leading-none">
                            {school.abbreviation}
                          </h3>
                        </div>

                        {/* Role Switcher / Focus Mode Sync */}
                        <div className="flex-1 flex items-center gap-3 min-w-0">
                          {roleFocus === 'ALL' ? (
                            <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 shrink-0 w-[84px] justify-between">
                              {['HC', 'OC', 'DC'].map((role, idx) => (
                                <button
                                  key={role}
                                  onClick={() => setMobileRoleIndex(prev => ({ ...prev, [school.name]: idx }))}
                                  className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all flex-1 ${
                                    (mobileRoleIndex[school.name] || 0) === idx ? 'bg-red-600 text-white' : 'text-zinc-600'
                                  }`}
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="w-[40px] shrink-0 text-[8px] font-black text-red-500 uppercase tracking-widest flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded py-1">
                              {roleFocus}
                            </div>
                          )}

                          {/* Coach Name & Pip (Aligned) */}
                          {(() => {
                            const roles = ['HC', 'OC', 'DC'] as const;
                            const role = roleFocus === 'ALL' ? roles[mobileRoleIndex[school.name] || 0] : roleFocus;
                            const slot = schoolSlots.find(s => s.role === role);
                            if (!slot) return null;
                            const persona = state.personas.find(p => p.id === slot.personaId);
                            const pilot = state.pilots.find(p => p.id === persona?.pilotId);
                            const isFired = state.stagedFires.includes(slot.id);

                            return (
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                {/* Status Pip */}
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isFired ? 'bg-red-600 animate-pulse' :
                                  pilot 
                                    ? pilot.type === 'REAL' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                                    : 'bg-zinc-600'
                                }`} />
                                
                                <div className="min-w-0 flex flex-col">
                                  <span className={`text-[11px] font-bold truncate ${persona ? isFired ? 'text-zinc-500 line-through' : 'text-zinc-200' : 'text-zinc-600 italic'}`}>
                                    {persona ? persona.name : 'VACANT'}
                                  </span>
                                  {pilot && (
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">
                                      {pilot.systemName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Primary Action */}
                        {(() => {
                          const roles = ['HC', 'OC', 'DC'] as const;
                          const role = roleFocus === 'ALL' ? roles[mobileRoleIndex[school.name] || 0] : roleFocus;
                          const slot = schoolSlots.find(s => s.role === role);
                          if (!slot) return null;
                          const persona = state.personas.find(p => p.id === slot.personaId);
                          const isFired = state.stagedFires.includes(slot.id);

                          if (!persona) return <div className="w-8" />;

                          return (
                            <button 
                              onClick={() => {
                                if (isFired) {
                                  undoFire(slot.id);
                                  addNotification(`Reinstated ${persona.name}`, 'undo');
                                } else {
                                  stageFire(slot.id);
                                  addNotification(`${persona.name} added to Staging Pool`, 'fire');
                                }
                              }}
                              className={`p-2 rounded-lg shrink-0 transition-all active:scale-90 ${
                                isFired 
                                  ? 'bg-zinc-800 text-white border border-zinc-700' 
                                  : 'bg-zinc-900 text-zinc-600 hover:text-red-500 border border-zinc-800'
                              }`}
                            >
                              {isFired ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Notifications */}
      <div className="fixed top-24 right-8 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
                n.type === 'fire' 
                  ? 'bg-red-600/90 border-red-500 text-white' 
                  : 'bg-zinc-900/90 border-zinc-800 text-white'
              }`}
            >
              {n.type === 'fire' ? <Trash2 size={16} /> : <RotateCcw size={16} />}
              <span className="text-[11px] font-black uppercase tracking-widest">{n.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {selectedSlots.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] w-full max-w-2xl px-6"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-4 flex items-center justify-between shadow-2xl shadow-black/50">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-red-600/20">
                  {selectedSlots.length}
                </div>
                <div>
                  <p className="text-xs font-black uppercase italic tracking-tight">Coaches Selected</p>
                  <button 
                    onClick={() => setSelectedSlots([])} 
                    className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={handleBatchUndo}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-700 transition-all"
                >
                  Batch Undo
                </button>
                <button 
                  onClick={handleBatchFire}
                  className="px-6 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"
                >
                  Batch Fire
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staging Pool Drawer/Sidebar */}
      <AnimatePresence>
        {isPoolOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPoolOpen(false)}
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
                  <h2 className="text-xl font-black text-white uppercase italic">Staging <span className="text-red-600">Pool</span></h2>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Manage Fired Coach Dispositions</p>
                </div>
                <button onClick={() => setIsPoolOpen(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {firedPersonas.length === 0 ? (
                  <div className="text-center py-24 space-y-4">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-600">
                      <Users size={32} />
                    </div>
                    <p className="text-zinc-500 font-bold italic">No coaches in the staging pool.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {firedPersonas.map(({ slot, persona, pilot }) => (
                      <div key={persona!.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-white">{persona!.name}</p>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                              Former {slot!.role} at {slot!.schoolId}
                            </p>
                          </div>
                          {pilot && (
                            <div className="px-2 py-1 bg-orange-600/10 border border-orange-600/20 rounded text-[8px] font-black text-orange-500 uppercase tracking-widest">
                              {pilot.systemName}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setDisposition(persona!.id, 'UNASSIGNED')}
                            className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                              state.stagedDispositions[persona!.id] === 'UNASSIGNED'
                                ? 'bg-zinc-800 border-zinc-700 text-white'
                                : 'bg-transparent border-zinc-900 text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            Unassigned
                          </button>
                          <button 
                            onClick={() => setDisposition(persona!.id, 'RETIRE')}
                            className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                              state.stagedDispositions[persona!.id] === 'RETIRE'
                                ? 'bg-red-600/20 border-red-600/30 text-red-500'
                                : 'bg-transparent border-zinc-900 text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            Retire
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-md">
                <div className="flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-600/20 rounded-2xl mb-4">
                  <Info size={18} className="text-blue-500 shrink-0" />
                  <p className="text-[10px] text-blue-500 font-bold leading-relaxed">
                    Changes here are staged for this session. Use the "Commit" phase to apply them to the league.
                  </p>
                </div>
                <button 
                  disabled={firedPersonas.length === 0}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-xl shadow-white/5 hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  NEXT: STAGE VACANCIES
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FiringRoom;
