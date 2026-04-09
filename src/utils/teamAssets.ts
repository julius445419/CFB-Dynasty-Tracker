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
 * Returns a short name/abbreviation for common schools.
 */
export const getTeamShortName = (schoolName: string): string => {
  if (!schoolName) return '';
  
  const mapping: Record<string, string> = {
    "South Florida": "USF",
    "Oklahoma State": "OKST",
    "Florida State": "FSU",
    "Ohio State": "OSU",
    "Michigan State": "MSU",
    "Arizona State": "ASU",
    "Mississippi State": "MSST",
    "North Carolina": "UNC",
    "NC State": "NCST",
    "West Virginia": "WVU",
    "Virginia Tech": "VT",
    "Georgia Tech": "GT",
    "Texas A&M": "TAMU",
    "Texas Tech": "TTU",
    "Ole Miss": "MISS",
    "LSU": "LSU",
    "TCU": "TCU",
    "SMU": "SMU",
    "UCLA": "UCLA",
    "USC": "USC",
    "BYU": "BYU",
    "UCF": "UCF",
    "UAB": "UAB",
    "UNLV": "UNLV",
    "UTSA": "UTSA",
    "UTEP": "UTEP",
    "UMass": "MASS",
    "UConn": "CONN",
    "Florida Atlantic": "FAU",
    "Florida International": "FIU",
    "Middle Tennessee": "MTSU",
    "Western Kentucky": "WKU",
    "Northern Illinois": "NIU",
    "Eastern Michigan": "EMU",
    "Central Michigan": "CMU",
    "Western Michigan": "WMU",
    "Bowling Green": "BGSU",
    "Appalachian State": "APP",
    "Coastal Carolina": "CCU",
    "Georgia Southern": "GASO",
    "Georgia State": "GAST",
    "South Alabama": "USA",
    "Arkansas State": "ARST",
    "Louisiana": "ULL",
    "Louisiana Tech": "LT",
    "Sam Houston": "SHSU",
    "Jacksonville State": "JSU",
    "Kennesaw State": "KSU",
    "New Mexico State": "NMSU",
    "San Diego State": "SDSU",
    "San Jose State": "SJSU",
    "Colorado State": "CSU",
    "Boise State": "BSU",
    "Fresno State": "FRES",
    "Utah State": "USU",
    "Air Force": "AF",
    "Washington State": "WSU",
    "Oregon State": "ORST",
    "Southern Miss": "USM",
    "Old Dominion": "ODU",
    "South Carolina": "SC",
    "Miami (FL)": "MIA",
    "Miami (OH)": "MOH",
    "Bowling Green State": "BGSU"
  };

  return mapping[schoolName] || schoolName;
};

/**
 * Returns the primary color for a given school name.
 */
export const getTeamColor = (schoolName: string): string => {
  if (!schoolName) return '#1e1e1e';
  const school = SCHOOLS.find(s => s.name.toLowerCase() === schoolName.toLowerCase());
  return school?.color || '#1e1e1e';
};
