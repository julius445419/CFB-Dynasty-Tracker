import React, { useState } from 'react';
import { getTeamLogo } from '../../utils/teamAssets';

interface TeamLogoProps {
  schoolName?: string;
  team?: any;
  className?: string;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const TeamLogo: React.FC<TeamLogoProps> = ({ schoolName, team, className, logoUrl, size }) => {
  const [error, setError] = useState(false);
  const fallback = 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png';
  
  const effectiveSchoolName = schoolName || team?.name || team?.school || '';
  const effectiveLogoUrl = logoUrl || team?.logoUrl || (team?.logoId && typeof team.logoId === 'string' && team.logoId.startsWith('http') ? team.logoId : undefined);

  React.useEffect(() => {
    setError(false);
  }, [effectiveSchoolName, effectiveLogoUrl]);
  
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Priority: 
  // 1. Explicit logoUrl (if provided and not errored)
  // 2. getTeamLogo(schoolName)
  // 3. Fallback
  
  const src = error ? fallback : (effectiveLogoUrl && effectiveLogoUrl !== "" ? effectiveLogoUrl : getTeamLogo(effectiveSchoolName));

  return (
    <img
      src={src}
      alt={effectiveSchoolName}
      className={`${size ? sizeClasses[size] : ''} ${className || ''} object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
    />
  );
};
