import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, where, onSnapshot, limit, collectionGroup, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type UserRole = 'Owner' | 'Commissioner' | 'Player' | 'Unassigned';

interface LeagueInfo {
  id: string;
  name: string;
  ownerId: string;
  seasonPhase: string;
  currentYear: number;
  currentWeek: number;
}

interface UserTeam {
  id: string;
  school: string;
  role: string;
  coachName?: string;
  firstName?: string;
  lastName?: string;
  logoId?: string | number;
}

interface LeagueContextType {
  currentLeagueId: string | null;
  userRole: UserRole;
  leagueInfo: LeagueInfo | null;
  userTeam: UserTeam | null;
  loading: boolean;
  setCurrentLeagueId: (id: string | null) => void;
  setUserRole: (role: UserRole) => void;
  selectLeague: (leagueId: string) => void;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(() => {
    return localStorage.getItem('activeLeagueId');
  });
  const [userRole, setUserRole] = useState<UserRole>('Unassigned');
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  const [loading, setLoading] = useState(true);

  const selectLeague = (leagueId: string) => {
    setCurrentLeagueId(leagueId);
    localStorage.setItem('activeLeagueId', leagueId);
  };

  useEffect(() => {
    if (!user) {
      setCurrentLeagueId(null);
      setUserRole('Unassigned');
      setLeagueInfo(null);
      setLoading(false);
      localStorage.removeItem('activeLeagueId');
      return;
    }

    if (!currentLeagueId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Listen to League Document
    const leagueRef = doc(db, 'leagues', currentLeagueId);
    const memberRef = doc(db, 'leagues', currentLeagueId, 'members', user.uid);
    
    const unsubscribeLeague = onSnapshot(leagueRef, async (leagueDoc) => {
      if (leagueDoc.exists()) {
        const data = leagueDoc.data();
        const info: LeagueInfo = {
          id: leagueDoc.id,
          name: data.name,
          ownerId: data.ownerId,
          seasonPhase: data.seasonPhase || 'Off Season',
          currentYear: data.currentYear || 2024,
          currentWeek: data.currentWeek || 1,
        };
        setLeagueInfo(info);
        
        // If user is the owner, set role immediately if not already set by member doc
        if (data.ownerId === user.uid) {
          setUserRole('Owner');
        }
      } else {
        setCurrentLeagueId(null);
        localStorage.removeItem('activeLeagueId');
        setLoading(false);
      }
    });

    // 2. Listen to Member Document for Role
    const unsubscribeMember = onSnapshot(memberRef, (memberDoc) => {
      if (memberDoc.exists()) {
        const role = memberDoc.data().role;
        // Map firestore role to UserRole type
        const mappedRole = (role.charAt(0).toUpperCase() + role.slice(1)) as UserRole;
        setUserRole(mappedRole);
      } else {
        // Only set to Unassigned if not the owner (who was set in league listener)
        setUserRole(prev => {
          if (leagueInfo?.ownerId === user.uid) return 'Owner';
          return 'Unassigned';
        });
      }
    });

    // 3. Listen to Team Document
    const coachRef = doc(db, 'leagues', currentLeagueId, 'teams', user.uid);
    const unsubscribeTeam = onSnapshot(coachRef, (coachDoc) => {
      if (coachDoc.exists()) {
        const teamData = coachDoc.data();
        setUserTeam({
          id: coachDoc.id,
          school: teamData.school || teamData.name,
          role: teamData.role || teamData.coachRole,
          coachName: teamData.coachName,
          firstName: teamData.firstName,
          lastName: teamData.lastName,
          logoId: teamData.logoId
        });
      } else {
        setUserTeam(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeLeague();
      unsubscribeMember();
      unsubscribeTeam();
    };
  }, [user, currentLeagueId]);

  return (
    <LeagueContext.Provider value={{ 
      currentLeagueId, 
      userRole, 
      leagueInfo, 
      userTeam,
      loading,
      setCurrentLeagueId, 
      setUserRole,
      selectLeague
    }}>
      {children}
    </LeagueContext.Provider>
  );
};

export const useLeague = () => {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
};
