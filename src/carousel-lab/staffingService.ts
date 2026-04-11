import { LabState, CoachingRole, StaffingSlot, CoachPersona, HumanPilot } from './types';

export class StaffingGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffingGuardError';
  }
}

/**
 * Staffing Guard Service
 * Manages the relationships between slots, personas, and pilots in the Lab.
 */
export const StaffingService = {
  /**
   * Returns true if the school has no other human pilot assigned to any of its 3 roles.
   * Constraint: Only ONE human (Shadow or Real User) can be assigned to a school staff at a time.
   */
  canAssignHuman(state: LabState, schoolId: string, pilotId: string): boolean {
    // Find all slots for this school
    const schoolSlots = state.slots.filter(s => s.schoolId === schoolId);
    
    // Check if any persona in these slots is linked to a DIFFERENT human pilot
    for (const slot of schoolSlots) {
      if (slot.personaId) {
        const persona = state.personas.find(p => p.id === slot.personaId);
        if (persona && persona.pilotId && persona.pilotId !== pilotId) {
          return false;
        }
      }
    }
    
    return true;
  },

  /**
   * Moves a persona into a vacant slot.
   */
  assignPersona(state: LabState, slotId: string, personaId: string | null): LabState {
    return {
      ...state,
      slots: state.slots.map(slot => 
        slot.id === slotId ? { ...slot, personaId } : slot
      )
    };
  },

  /**
   * Links a human (Shadow/Real) to a Persona.
   * This triggers the "Staffing Guard" to ensure the program isn't already claimed.
   */
  linkPilot(state: LabState, personaId: string, pilotId: string): LabState {
    const persona = state.personas.find(p => p.id === personaId);
    if (!persona) throw new StaffingGuardError('Persona not found');

    // Find which slot this persona is in
    const slot = state.slots.find(s => s.personaId === personaId);
    if (!slot) {
      throw new StaffingGuardError('Persona-First Logic: A human cannot be linked to a persona unless it is assigned to a slot.');
    }

    // Check Staffing Guard
    if (!this.canAssignHuman(state, slot.schoolId, pilotId)) {
      throw new StaffingGuardError(`One Human Rule: ${slot.schoolId} already has a human pilot assigned to its staff.`);
    }

    return {
      ...state,
      personas: state.personas.map(p => 
        p.id === personaId 
          ? { ...p, pilotId, isUserControlled: true } 
          : p
      )
    };
  },

  /**
   * Removes the human link but leaves the Persona in the slot (converting it to CPU control).
   */
  unpilot(state: LabState, personaId: string): LabState {
    return {
      ...state,
      personas: state.personas.map(p => 
        p.id === personaId 
          ? { ...p, pilotId: null, isUserControlled: false } 
          : p
      )
    };
  },

  /**
   * Removes a Persona from a slot (Firing).
   */
  fireCoach(state: LabState, slotId: string): LabState {
    return {
      ...state,
      slots: state.slots.map(slot => 
        slot.id === slotId ? { ...slot, personaId: null } : slot
      )
    };
  },

  /**
   * Bulk fire coaches.
   */
  batchFire(state: LabState, slotIds: string[]): LabState {
    return {
      ...state,
      slots: state.slots.map(slot => 
        slotIds.includes(slot.id) ? { ...slot, personaId: null } : slot
      )
    };
  },

  /**
   * Bulk reset to CPU (unlink pilots).
   */
  batchReset(state: LabState, slotIds: string[]): LabState {
    const personaIdsToUnlink = state.slots
      .filter(s => slotIds.includes(s.id) && s.personaId)
      .map(s => s.personaId as string);

    return {
      ...state,
      personas: state.personas.map(p => 
        personaIdsToUnlink.includes(p.id) 
          ? { ...p, pilotId: null, isUserControlled: false } 
          : p
      )
    };
  }
};
