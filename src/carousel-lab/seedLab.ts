import { SCHOOLS } from '../constants/schools';
import { DEFAULT_COACHES } from '../constants/defaultCoaches';
import { LabState, StaffingSlot, CoachPersona, HumanPilot } from './types';

export const seedLabData = (): LabState => {
  const pilots: HumanPilot[] = [
    { id: 'pilot-1', systemName: 'Julius HC', type: 'REAL' },
    { id: 'pilot-2', systemName: 'Shadow_User_1', type: 'SHADOW' },
    { id: 'pilot-3', systemName: 'Shadow_User_2', type: 'SHADOW' },
  ];

  const personas: CoachPersona[] = [];
  const slots: StaffingSlot[] = [];

  const normalizeSchoolName = (name: string) => {
    const mapping: Record<string, string> = {
      "Appalachian State": "App State",
      "California": "Cal",
      "Florida Atlantic": "FAU",
      "Florida International": "FIU",
      "UL Monroe": "ULM",
      "Miami (FL)": "Miami",
    };
    return mapping[name] || name;
  };

  SCHOOLS.forEach(school => {
    const roles: ('HC' | 'OC' | 'DC')[] = ['HC', 'OC', 'DC'];
    const normalizedName = normalizeSchoolName(school.name);
    
    roles.forEach(role => {
      const defaultCoach = DEFAULT_COACHES.find(c => 
        c.school === normalizedName && c.role === role
      );

      const personaId = `persona-${school.name}-${role}`;
      const slotId = `slot-${school.name}-${role}`;

      personas.push({
        id: personaId,
        name: defaultCoach ? `${defaultCoach.firstName} ${defaultCoach.lastName}` : `${school.name} ${role}`,
        isUserControlled: false,
        pilotId: null
      });

      slots.push({
        id: slotId,
        schoolId: school.name,
        role: role,
        personaId: personaId
      });
    });
  });

  return {
    pilots,
    personas,
    slots,
    stagedFires: [],
    stagedDispositions: {},
    stagedHires: {},
    moveHistory: []
  };
};
