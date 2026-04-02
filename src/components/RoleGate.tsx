import React from 'react';
import { useLeague, UserRole } from '../context/LeagueContext';

interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

/**
 * A simple wrapper component to hide/show UI elements based on the user's role.
 */
export const RoleGate: React.FC<RoleGateProps> = ({ 
  children, 
  allowedRoles, 
  fallback = null 
}) => {
  const { userRole } = useLeague();

  if (!allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RoleGate;
