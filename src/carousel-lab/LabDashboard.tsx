import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Link as LinkIcon, 
  Unlink, 
  Trash2, 
  Search, 
  ShieldAlert, 
  RefreshCcw,
  Ghost,
  UserCheck,
  ChevronRight,
  X,
  Info,
  Filter,
  LayoutGrid,
  List,
  ChevronLeft,
  Settings2,
  CheckSquare,
  Square,
  Zap,
  MoreVertical
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLab } from './LabContext';
import { SCHOOLS } from '../constants/schools';
import FiringRoom from './FiringRoom';
import CarouselFloor from './CarouselFloor';

const CONFERENCES = ['ALL', ...Array.from(new Set(SCHOOLS.map(s => s.conference))).sort()];

const LabDashboard: React.FC = () => {
  const { state, linkPilot, unpilot, fireCoach, hireCoach, batchFire, batchReset, batchStageFire, resetLab, error, clearError } = useLab();
  const [activeTab, setActiveTab] = useState<'staffing' | 'firing' | 'carousel'>('staffing');
  const [search, setSearch] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState('ALL');
  const [roleFocus, setRoleFocus] = useState<'ALL' | 'HC' | 'OC' | 'DC'>('ALL');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [mobileRoleIndex, setMobileRoleIndex] = useState<Record<string, number>>({}); // schoolId -> index (0:HC, 1:OC, 2:DC)

  const [mobileActionSlot, setMobileActionSlot] = useState<string | null>(null);
  const [isAssigningPersona, setIsAssigningPersona] = useState(false);
  const [isAssigningPilot, setIsAssigningPilot] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

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
    estimateSize: () => 64, // Height of a row
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
    batchStageFire(selectedSlots);
    setSelectedSlots([]);
  };

  const handleBatchReset = () => {
    batchReset(selectedSlots);
    setSelectedSlots([]);
  };

  if (activeTab === 'firing') {
    return <FiringRoom activeTab={activeTab} setActiveTab={setActiveTab} />;
  }

  if (activeTab === 'carousel') {
    return <CarouselFloor activeTab={activeTab} setActiveTab={setActiveTab} />;
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      {/* Stationary Header */}
      <header className="shrink-0 bg-zinc-950 border-b border-zinc-900 p-4 z-40">
        <div className="max-w-full mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-600 rounded-lg">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">
                  War <span className="text-orange-600">Room</span>
                </h1>
                <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-1">Staffing Command Center</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveTab('staffing')}
                className="px-4 py-2 border border-orange-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-orange-600 text-white shadow-lg shadow-orange-600/20"
              >
                Staffing
              </button>
              <button 
                onClick={() => setActiveTab('firing')}
                className="px-4 py-2 border border-zinc-800 bg-zinc-900 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
              >
                Firing Room
              </button>
              <button 
                onClick={() => setActiveTab('carousel')}
                className="px-4 py-2 border border-zinc-800 bg-zinc-900 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
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
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50"
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
                    roleFocus === role ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300'
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
        {/* Left Sidebar: Rules (Collapsible) */}
        <motion.aside 
          initial={false}
          animate={{ width: isLeftSidebarOpen ? 280 : 48 }}
          className="shrink-0 bg-zinc-950 border-r border-zinc-900 flex flex-col overflow-hidden hidden md:flex"
        >
          <button 
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className="p-4 text-zinc-500 hover:text-white transition-colors flex items-center justify-center"
          >
            {isLeftSidebarOpen ? <ChevronLeft size={16} /> : <Settings2 size={16} />}
          </button>
          
          <AnimatePresence>
            {isLeftSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-8 overflow-y-auto"
              >
                <section>
                  <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShieldAlert size={14} />
                    Guard Rules
                  </h2>
                  <div className="space-y-4">
                    {[
                      { t: 'One Human', d: 'Only one pilot per school staff.' },
                      { t: 'Persona-First', d: 'Pilot needs a Persona in slot.' },
                      { t: 'Unpilot', d: 'Reverts coach to CPU control.' }
                    ].map((rule, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-[10px] font-bold text-zinc-200">{rule.t}</p>
                        <p className="text-[9px] text-zinc-500 leading-tight">{rule.d}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>

        {/* Main Content: Virtualized List */}
        <main className="flex-1 overflow-hidden flex flex-col bg-zinc-950">
          {/* List Header (Desktop Only) */}
          <div className="hidden md:grid grid-cols-[300px_1fr] lg:grid-cols-[360px_1fr] xl:grid-cols-[440px_1fr] border-b border-zinc-900 bg-zinc-900/30 shrink-0">
            <div className="p-4 flex items-center gap-4 border-r border-zinc-900">
              <button 
                onClick={handleSelectAll}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  isAllSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-zinc-700 hover:border-zinc-500'
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
                            // If roleFocus is ALL, we need to decide which slot to toggle.
                            // The prompt says "If an Admin checks Row 1...". 
                            // In "ALL" mode, checking the row checkbox should probably toggle ALL slots in that row.
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
                              ? 'bg-orange-600 border-orange-600 text-white opacity-100' 
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

                          return (
                            <div 
                              key={slot.id} 
                              className={`flex-1 px-4 flex items-center justify-between gap-3 transition-all ${
                                roleFocus !== 'ALL' ? 'col-span-3' : ''
                              } ${isSelected ? 'bg-orange-600/5' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button 
                                  onClick={(e) => toggleSlotSelection(slot.id, virtualRow.index, e)}
                                  className={`shrink-0 transition-colors ${isSelected ? 'text-orange-600' : 'text-zinc-800 group-hover:text-zinc-600'}`}
                                >
                                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                                
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Status Pip */}
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    pilot 
                                      ? pilot.type === 'REAL' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                                      : 'bg-zinc-600'
                                  }`} />

                                  <div className="min-w-0 flex flex-col justify-center">
                                    <span className={`text-[11px] font-bold truncate ${persona ? 'text-zinc-200' : 'text-zinc-600 italic'}`}>
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

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {persona ? (
                                  <>
                                    <button 
                                      onClick={() => pilot ? unpilot(persona.id) : linkPilot(persona.id, state.pilots[0].id)}
                                      className="p-1 bg-zinc-900 rounded text-zinc-500 hover:text-orange-500 transition-colors"
                                      title={pilot ? "Unlink Pilot" : "Link Pilot"}
                                    >
                                      {pilot ? <Unlink size={10} /> : <LinkIcon size={10} />}
                                    </button>
                                    <button 
                                      onClick={() => fireCoach(slot.id)}
                                      className="p-1 bg-zinc-900 rounded text-zinc-700 hover:text-red-500 transition-colors"
                                      title="Fire Coach"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </>
                                ) : (
                                  <button className="p-1 bg-zinc-900 rounded text-zinc-500 hover:text-white transition-colors">
                                    <UserPlus size={10} />
                                  </button>
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
                                    (mobileRoleIndex[school.name] || 0) === idx ? 'bg-orange-600 text-white' : 'text-zinc-600'
                                  }`}
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="w-[40px] shrink-0 text-[8px] font-black text-orange-500 uppercase tracking-widest flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded py-1">
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

                            return (
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                {/* Status Pip */}
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  pilot 
                                    ? pilot.type === 'REAL' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                                    : 'bg-zinc-600'
                                }`} />
                                
                                <div className="min-w-0 flex flex-col">
                                  <span className={`text-[11px] font-bold truncate ${persona ? 'text-zinc-200' : 'text-zinc-600 italic'}`}>
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
                        <button 
                          onClick={() => {
                            const roles = ['HC', 'OC', 'DC'] as const;
                            const role = roleFocus === 'ALL' ? roles[mobileRoleIndex[school.name] || 0] : roleFocus;
                            const slot = schoolSlots.find(s => s.role === role);
                            if (slot) setMobileActionSlot(slot.id);
                          }}
                          className="p-1.5 bg-zinc-900 rounded text-zinc-500 shrink-0"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* Mobile Action Sheet */}
        <AnimatePresence>
          {mobileActionSlot && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setMobileActionSlot(null);
                  setIsAssigningPersona(false);
                  setIsAssigningPilot(false);
                }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] md:hidden"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="fixed inset-x-0 bottom-0 bg-zinc-900 border-t border-zinc-800 rounded-t-[32px] z-[101] p-6 pb-12 md:hidden max-h-[85vh] flex flex-col"
              >
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8 shrink-0" />
                
                {(() => {
                  const slot = state.slots.find(s => s.id === mobileActionSlot);
                  if (!slot) return null;
                  const persona = state.personas.find(p => p.id === slot.personaId);
                  const pilot = state.pilots.find(p => p.id === persona?.pilotId);

                  if (isAssigningPersona) {
                    const availablePersonas = state.personas.filter(p => 
                      p.name.toLowerCase().includes(assignmentSearch.toLowerCase())
                    );

                    return (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                          <h3 className="text-lg font-black uppercase italic tracking-tight">Hire Persona</h3>
                          <button onClick={() => setIsAssigningPersona(false)} className="p-2 text-zinc-500"><X size={20} /></button>
                        </div>
                        
                        <div className="relative mb-4 shrink-0">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                          <input 
                            type="text" 
                            placeholder="Search personas..."
                            value={assignmentSearch}
                            onChange={(e) => setAssignmentSearch(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50"
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 custom-scrollbar">
                          {availablePersonas.map(p => {
                            const currentSlot = state.slots.find(s => s.personaId === p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  hireCoach(slot.id, p.id);
                                  setIsAssigningPersona(false);
                                  setMobileActionSlot(null);
                                }}
                                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between text-left"
                              >
                                <div>
                                  <p className="text-sm font-bold">{p.name}</p>
                                  {currentSlot && (
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                                      {currentSlot.schoolId} - {currentSlot.role}
                                    </p>
                                  )}
                                </div>
                                <ChevronRight size={16} className="text-zinc-700" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (isAssigningPilot) {
                    const filteredPilots = state.pilots.filter(p => 
                      p.systemName.toLowerCase().includes(assignmentSearch.toLowerCase())
                    );

                    return (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                          <h3 className="text-lg font-black uppercase italic tracking-tight">Link Pilot</h3>
                          <button onClick={() => setIsAssigningPilot(false)} className="p-2 text-zinc-500"><X size={20} /></button>
                        </div>

                        <div className="relative mb-4 shrink-0">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                          <input 
                            type="text" 
                            placeholder="Search pilots..."
                            value={assignmentSearch}
                            onChange={(e) => setAssignmentSearch(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-orange-600/50"
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 custom-scrollbar">
                          {filteredPilots.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                if (persona) linkPilot(persona.id, p.id);
                                setIsAssigningPilot(false);
                                setMobileActionSlot(null);
                              }}
                              className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between text-left"
                            >
                              <div>
                                <p className="text-sm font-bold">{p.systemName}</p>
                                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{p.type}</p>
                              </div>
                              <ChevronRight size={16} className="text-zinc-700" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6 shrink-0">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="h-12 w-12 rounded-2xl bg-zinc-950 flex items-center justify-center p-2 border border-zinc-800">
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${SCHOOLS.find(s => s.name === slot.schoolId)?.logoId}.png`} 
                            alt="" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-black uppercase italic tracking-tight">{slot.schoolId}</h3>
                          <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{slot.role}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {persona ? (
                          <>
                            <button 
                              onClick={() => {
                                if (pilot) {
                                  unpilot(persona.id);
                                  setMobileActionSlot(null);
                                } else {
                                  setIsAssigningPilot(true);
                                  setAssignmentSearch('');
                                }
                              }}
                              className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center gap-4 text-left"
                            >
                              <div className="p-2 bg-zinc-900 rounded-lg text-orange-500">
                                {pilot ? <Unlink size={20} /> : <LinkIcon size={20} />}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{pilot ? 'Unlink Pilot' : 'Link Pilot'}</p>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                  {pilot ? `Currently: ${pilot.systemName}` : 'Assign a human controller'}
                                </p>
                              </div>
                            </button>

                            <button 
                              onClick={() => {
                                fireCoach(slot.id);
                                setMobileActionSlot(null);
                              }}
                              className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center gap-4 text-left text-red-500"
                            >
                              <div className="p-2 bg-red-600/10 rounded-lg">
                                <Trash2 size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold">Fire Coach</p>
                                <p className="text-[10px] text-red-500/50 font-bold uppercase tracking-widest">Remove persona from slot</p>
                              </div>
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => {
                              setIsAssigningPersona(true);
                              setAssignmentSearch('');
                            }}
                            className="w-full p-4 bg-orange-600 text-white rounded-2xl flex items-center gap-4 text-left shadow-lg shadow-orange-600/20"
                          >
                            <div className="p-2 bg-white/10 rounded-lg">
                              <UserPlus size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold">Assign Persona</p>
                              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Fill this vacant position</p>
                            </div>
                          </button>
                        )}
                      </div>

                      <button 
                        onClick={() => setMobileActionSlot(null)}
                        className="w-full py-4 text-zinc-500 text-[10px] font-black uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })()}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Right Sidebar: Pilots (Collapsible) */}
        <motion.aside 
          initial={false}
          animate={{ width: isRightSidebarOpen ? 280 : 48 }}
          className="shrink-0 bg-zinc-950 border-l border-zinc-900 flex flex-col overflow-hidden hidden md:flex"
        >
          <button 
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className="p-4 text-zinc-500 hover:text-white transition-colors flex items-center justify-center"
          >
            {isRightSidebarOpen ? <ChevronRight size={16} /> : <Users size={16} />}
          </button>
          
          <AnimatePresence>
            {isRightSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-6 overflow-y-auto"
              >
                <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} />
                  Pilots
                </h2>
                <div className="space-y-2">
                  {state.pilots.map(pilot => (
                    <div key={pilot.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <span className="text-[10px] font-bold">{pilot.systemName}</span>
                      <span className="text-[8px] font-black text-zinc-600">
                        {state.personas.filter(p => p.pilotId === pilot.id).length}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
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
                <div className="h-10 w-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-orange-600/20">
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
                  onClick={handleBatchReset}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-700 transition-all"
                >
                  Reset to CPU
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

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6"
          >
            <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert size={20} />
                <p className="text-sm font-bold">{error}</p>
              </div>
              <button onClick={clearError} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LabDashboard;
