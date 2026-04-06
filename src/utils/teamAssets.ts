import { SCHOOLS } from '../constants/schools';

/**
 * Returns the ESPN logo URL for a given school name.
 * Falls back to a generic placeholder if not found.
 */
export const getTeamLogo = (schoolName: string): string => {
  const fallback = 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png';
  if (!schoolName) return fallback;
  
  const school = SCHOOLS.find(s => s.name.toLowerCase() === schoolName.toLowerCase());
  if (school && school.logoId) {
    // Check if logoId is a path or a number/string ID
    if (typeof school.logoId === 'string' && school.logoId.startsWith('/')) {
      return school.logoId;
    }
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`;
  }
  
  return fallback;
};

/**
 * Returns the primary color for a given school name.
 */
export const getTeamColor = (schoolName: string): string => {
  if (!schoolName) return '#1e1e1e';
  const school = SCHOOLS.find(s => s.name.toLowerCase() === schoolName.toLowerCase());
  return school?.color || '#1e1e1e';
};
