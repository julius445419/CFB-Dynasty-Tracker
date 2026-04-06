import React, { useState } from 'react';
import { getTeamLogo } from '../../utils/teamAssets';

interface TeamLogoProps {
  schoolName: string;
  className?: string;
  logoUrl?: string;
}

export const TeamLogo: React.FC<TeamLogoProps> = ({ schoolName, className, logoUrl }) => {
  const [error, setError] = useState(false);
  const fallback = 'https://a.espncdn.com/i/teamlogos/ncaa/500/ncaa.png';
  
  React.useEffect(() => {
    setError(false);
  }, [schoolName, logoUrl]);
  
  // Priority: 
  // 1. Explicit logoUrl (if provided and not errored)
  // 2. getTeamLogo(schoolName)
  // 3. Fallback
  
  const src = error ? fallback : (logoUrl && logoUrl !== "" ? logoUrl : getTeamLogo(schoolName));

  return (
    <img
      src={src}
      alt={schoolName}
      className={className}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
    />
  );
};
