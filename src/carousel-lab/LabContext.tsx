import React, { createContext, useContext, useState, useEffect } from 'react';
import { LabState, StaffingSlot, CoachPersona, HumanPilot } from './types';
import { seedLabData } from './seedLab';
import { StaffingService } from './staffingService';
import { commitStaffingChanges } from '../services/staffingService';
import { CarouselCoach } from '../types';

interface LabContextType {
  state: LabState;
  assignPersona: (slotId: string, personaId: string | null) => void;
  linkPilot: (personaId: string, pilotId: string) => void;
  unpilot: (personaId: string) => void;
  fireCoach: (slotId: string) => void;
  batchFire: (slotIds: string[]) => void;
  batchReset: (slotIds: string[]) => void;
  stageFire: (slotId: string) => void;
  batchStageFire: (slotIds: string[]) => void;
  undoFire: (slotId: string) => void;
  batchUndoFire: (slotIds: string[]) => void;
  setDisposition: (personaId: string, disposition: 'UNASSIGNED' | 'RETIRE') => void;
  hireCoach: (slotId: string, personaId: string) => void;
  resetLab: () => void;
  commitChanges: (leagueId: string, liveCoaches: CarouselCoach[]) => Promise<number>;
  isCommitting: boolean;
  error: string | null;
  clearError: () => void;
}

const LabContext = createContext<LabContextType | undefined>(undefined);

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LabState>(() => {
    const saved = localStorage.getItem('staffing-lab-state');
    if (!saved) return seedLabData();
    
    const parsed = JSON.parse(saved);
    const defaults = seedLabData();
    
    // Merge saved state with defaults to handle schema updates
    return {
      ...defaults,
      ...parsed,
      stagedFires: parsed.stagedFires || [],
      stagedDispositions: parsed.stagedDispositions || {},
      stagedHires: parsed.stagedHires || {},
      moveHistory: parsed.moveHistory || []
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    localStorage.setItem('staffing-lab-state', JSON.stringify(state));
  }, [state]);

  const clearError = () => setError(null);

  const assignPersona = (slotId: string, personaId: string | null) => {
    try {
      setState(prev => StaffingService.assignPersona(prev, slotId, personaId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const linkPilot = (personaId: string, pilotId: string) => {
    try {
      setState(prev => StaffingService.linkPilot(prev, personaId, pilotId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const unpilot = (personaId: string) => {
    try {
      setState(prev => StaffingService.unpilot(prev, personaId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fireCoach = (slotId: string) => {
    try {
      setState(prev => StaffingService.fireCoach(prev, slotId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const batchFire = (slotIds: string[]) => {
    try {
      setState(prev => StaffingService.batchFire(prev, slotIds));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const batchReset = (slotIds: string[]) => {
    try {
      setState(prev => StaffingService.batchReset(prev, slotIds));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const stageFire = (slotId: string) => {
    setState(prev => {
      if (prev.stagedFires.includes(slotId)) return prev;
      
      const slot = prev.slots.find(s => s.id === slotId);
      if (!slot || !slot.personaId) return prev;

      return {
        ...prev,
        stagedFires: [...prev.stagedFires, slotId],
        stagedDispositions: {
          ...prev.stagedDispositions,
          [slot.personaId]: 'UNASSIGNED'
        }
      };
    });
  };

  const batchStageFire = (slotIds: string[]) => {
    setState(prev => {
      const newStagedFires = [...prev.stagedFires];
      const newStagedDispositions = { ...prev.stagedDispositions };

      slotIds.forEach(slotId => {
        if (!newStagedFires.includes(slotId)) {
          const slot = prev.slots.find(s => s.id === slotId);
          if (slot && slot.personaId) {
            newStagedFires.push(slotId);
            newStagedDispositions[slot.personaId] = 'UNASSIGNED';
          }
        }
      });

      return {
        ...prev,
        stagedFires: newStagedFires,
        stagedDispositions: newStagedDispositions
      };
    });
  };

  const undoFire = (slotId: string) => {
    setState(prev => {
      const slot = prev.slots.find(s => s.id === slotId);
      const newStagedDispositions = { ...prev.stagedDispositions };
      if (slot?.personaId) {
        delete newStagedDispositions[slot.personaId];
      }

      return {
        ...prev,
        stagedFires: prev.stagedFires.filter(id => id !== slotId),
        stagedDispositions: newStagedDispositions
      };
    });
  };

  const batchUndoFire = (slotIds: string[]) => {
    setState(prev => {
      const newStagedFires = prev.stagedFires.filter(id => !slotIds.includes(id));
      const newStagedDispositions = { ...prev.stagedDispositions };
      
      slotIds.forEach(slotId => {
        const slot = prev.slots.find(s => s.id === slotId);
        if (slot?.personaId) {
          delete newStagedDispositions[slot.personaId];
        }
      });

      return {
        ...prev,
        stagedFires: newStagedFires,
        stagedDispositions: newStagedDispositions
      };
    });
  };

  const setDisposition = (personaId: string, disposition: 'UNASSIGNED' | 'RETIRE') => {
    setState(prev => ({
      ...prev,
      stagedDispositions: {
        ...prev.stagedDispositions,
        [personaId]: disposition
      }
    }));
  };

  const hireCoach = (slotId: string, personaId: string) => {
    setState(prev => {
      const targetSlot = prev.slots.find(s => s.id === slotId);
      const persona = prev.personas.find(p => p.id === personaId);
      if (!targetSlot || !persona) return prev;

      // Singleton Pilot Rule
      if (persona.pilotId) {
        const schoolSlots = prev.slots.filter(s => s.schoolId === targetSlot.schoolId);
        const hasOtherHuman = schoolSlots.some(s => {
          if (s.id === slotId) return false;
          const currentPersonaId = prev.stagedHires[s.id] || s.personaId;
          if (!currentPersonaId) return false;
          const p = prev.personas.find(pers => pers.id === currentPersonaId);
          return p?.pilotId && p.pilotId !== persona.pilotId;
        });

        if (hasOtherHuman) {
          setError(`Cannot hire ${persona.name}. ${targetSlot.schoolId} already has a human pilot.`);
          return prev;
        }
      }

      const newStagedHires = { ...prev.stagedHires, [slotId]: personaId };
      const newStagedFires = [...prev.stagedFires];
      const newMoveHistory = [...prev.moveHistory];
      const newStagedDispositions = { ...prev.stagedDispositions };

      // Check if coach was already in a slot
      const currentSlot = prev.slots.find(s => s.personaId === personaId);
      const isCurrentlyEmployed = currentSlot && !prev.stagedFires.includes(currentSlot.id);

      if (isCurrentlyEmployed && currentSlot) {
        // POACH
        if (!newStagedFires.includes(currentSlot.id)) {
          newStagedFires.push(currentSlot.id);
        }
        
        newMoveHistory.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'POACH',
          coachName: persona.name,
          fromSchool: currentSlot.schoolId,
          toSchool: targetSlot.schoolId,
          role: targetSlot.role,
          timestamp: Date.now()
        });

        newMoveHistory.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'VACANCY',
          coachName: persona.name,
          fromSchool: currentSlot.schoolId,
          role: currentSlot.role,
          timestamp: Date.now()
        });
      } else {
        // HIRE from pool
        newMoveHistory.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'HIRE',
          coachName: persona.name,
          toSchool: targetSlot.schoolId,
          role: targetSlot.role,
          timestamp: Date.now()
        });

        // Remove from dispositions if they were there
        delete newStagedDispositions[personaId];
      }

      return {
        ...prev,
        stagedHires: newStagedHires,
        stagedFires: newStagedFires,
        stagedDispositions: newStagedDispositions,
        moveHistory: newMoveHistory
      };
    });
  };

  const resetLab = () => {
    setState(seedLabData());
    localStorage.removeItem('staffing-lab-state');
  };

  const commitChanges = async (leagueId: string, liveCoaches: CarouselCoach[]): Promise<number> => {
    setIsCommitting(true);
    setError(null);
    
    try {
      // 1. Final Staffing Guard Check
      // Verify: No team has more than one unique userId (where userId !== null/CPU) assigned across HC, OC, and DC.
      const schools = Array.from(new Set(state.slots.map(s => s.schoolId)));
      for (const schoolId of schools) {
        const schoolSlots = state.slots.filter(s => s.schoolId === schoolId);
        const humanPilotIds = new Set<string>();
        
        for (const slot of schoolSlots) {
          const personaId = state.stagedHires[slot.id] || slot.personaId;
          if (personaId) {
            const persona = state.personas.find(p => p.id === personaId);
            if (persona && persona.pilotId) {
              humanPilotIds.add(persona.pilotId);
            }
          }
        }

        if (humanPilotIds.size > 1) {
          throw new Error(`Staffing Guard Violation: ${schoolId} has multiple human pilots assigned. Only one human is allowed per staff.`);
        }
      }

      // 2. Prepare Staged Coaches for Commit
      // We need to map our LabState back to CarouselCoach objects
      const stagedCoaches: CarouselCoach[] = state.personas.map(persona => {
        const live = liveCoaches.find(l => l.id === persona.id);
        const currentSlot = state.slots.find(s => (state.stagedHires[s.id] || s.personaId) === persona.id);
        const disposition = state.stagedDispositions[persona.id];

        return {
          ...live,
          id: persona.id,
          name: persona.name,
          userId: persona.pilotId || null,
          teamId: currentSlot ? currentSlot.schoolId : null,
          role: currentSlot ? currentSlot.role : 'Unassigned',
          inviteCode: persona.inviteCode,
          status: disposition === 'RETIRE' ? 'retired' : (live as any)?.status || 'active',
          leagueId: leagueId,
          updatedAt: new Date()
        } as CarouselCoach;
      });

      // 3. Execute Commit
      const result = await commitStaffingChanges(leagueId, stagedCoaches, liveCoaches);
      
      // 4. Success State
      // Clear staging and reset Lab to a clean state (or sync with new live data)
      setState(prev => ({
        ...prev,
        stagedFires: [],
        stagedDispositions: {},
        stagedHires: {},
        moveHistory: []
      }));

      return result.updatedCount;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <LabContext.Provider value={{ 
      state, 
      assignPersona, 
      linkPilot, 
      unpilot, 
      fireCoach, 
      batchFire,
      batchReset,
      stageFire,
      batchStageFire,
      undoFire,
      batchUndoFire,
      setDisposition,
      hireCoach,
      resetLab,
      commitChanges,
      isCommitting,
      error,
      clearError
    }}>
      {children}
    </LabContext.Provider>
  );
};

export const useLab = () => {
  const context = useContext(LabContext);
  if (!context) throw new Error('useLab must be used within a LabProvider');
  return context;
};
