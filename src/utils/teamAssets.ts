import { SCHOOLS } from '../constants/schools';

/**
 * Returns the ESPN logo URL for a given school name.
 * Falls back to a generic placeholder if not found.
 */
export const getTeamLogo = (schoolName: string): string => {
  if (!schoolName) return 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png';
  const school = SCHOOLS.find(s => s.name.toLowerCase() === schoolName.toLowerCase());
  if (school && school.logoId) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`;
  }
  // Fallback to a generic NCAA logo or placeholder
  return 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png';
};

/**
 * Returns the primary color for a given school name.
 */
export const getTeamColor = (schoolName: string): string => {
  if (!schoolName) return '#1e1e1e';
  const school = SCHOOLS.find(s => s.name.toLowerCase() === schoolName.toLowerCase());
  return school?.color || '#1e1e1e';
};
