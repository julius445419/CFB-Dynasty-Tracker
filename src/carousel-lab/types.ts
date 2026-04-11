export type CoachingRole = 'HC' | 'OC' | 'DC';
export type PilotType = 'SHADOW' | 'REAL';

export interface HumanPilot {
  id: string;
  systemName: string;
  type: PilotType;
}

export interface CoachPersona {
  id: string;
  name: string;
  isUserControlled: boolean;
  pilotId: string | null; // Nullable
}

export interface StaffingSlot {
  id: string; // Internal ID for the slot (e.g., "Alabama-HC")
  schoolId: string;
  role: CoachingRole;
  personaId: string | null;
}

export interface MoveEvent {
  id: string;
  type: 'HIRE' | 'POACH' | 'VACANCY';
  coachName: string;
  fromSchool?: string;
  toSchool?: string;
  role: string;
  timestamp: number;
}

export interface LabState {
  pilots: HumanPilot[];
  personas: CoachPersona[];
  slots: StaffingSlot[];
  stagedFires: string[]; // Array of SlotIDs
  stagedDispositions: Record<string, 'UNASSIGNED' | 'RETIRE'>; // PersonaID -> Disposition
  stagedHires: Record<string, string>; // slotId -> personaId
  moveHistory: MoveEvent[];
}
