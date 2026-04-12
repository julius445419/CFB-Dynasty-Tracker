import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, where, onSnapshot, limit, collectionGroup, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type UserRole = 'Owner' | 'Commissioner' | 'Player' | 'User' | 'Unassigned';

import { 
  League, 
  LeagueMember, 
  TeamAssignment, 
  Game, 
  TeamStats, 
  PlayerGameStats,
  UserProfile,
  LeagueSettings
} from '../types';

interface LeagueInfo {
  id: string;
  name: string;
  ownerId: string;
  seasonPhase: string;
  currentYear: number;
  currentWeek: number;
  passcode?: string;
  settings?: LeagueSettings;
}

interface UserTeam extends TeamAssignment {
  id: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

interface LeagueContextType {
  currentLeagueId: string | null;
  userRole: UserRole;
  userPermissions: LeagueMember['permissions'];
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
  const [userPermissions, setUserPermissions] = useState<LeagueMember['permissions']>({});
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveRole = React.useMemo(() => {
    if (!user || !leagueInfo) return 'Unassigned';
    if (leagueInfo.ownerId === user.uid || user.email === 'julius445419@gmail.com') return 'Owner';
    return userRole;
  }, [user, leagueInfo, userRole]);

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
          currentYear: typeof data.currentYear === 'number' && !isNaN(data.currentYear) ? data.currentYear : 2025,
          currentWeek: typeof data.currentWeek === 'number' && !isNaN(data.currentWeek) ? data.currentWeek : 0,
          passcode: data.passcode,
          settings: data.settings,
        };
        setLeagueInfo(info);
      } else {
        setCurrentLeagueId(null);
        localStorage.removeItem('activeLeagueId');
        setLoading(false);
      }
    });

    // 2. Listen to Member Document for Role
    const unsubscribeMember = onSnapshot(memberRef, (memberDoc) => {
      if (memberDoc.exists()) {
        const data = memberDoc.data();
        const role = data.role || 'Player';
        const permissions = data.permissions || {};
        const mappedRole = (role.charAt(0).toUpperCase() + role.slice(1)) as UserRole;
        
        setUserRole(mappedRole);
        setUserPermissions(permissions);
      } else {
        setUserRole('Unassigned');
        setUserPermissions({});
      }
    });

    // 3. Listen to Team Document (Query by ownerId)
    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const q = query(teamsRef, where('ownerId', '==', user.uid), limit(1));
    
    const unsubscribeTeam = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const coachDoc = snapshot.docs[0];
        const teamData = coachDoc.data();
        setUserTeam({
          id: coachDoc.id,
          name: teamData.name || teamData.school,
          school: teamData.school || teamData.name,
          role: teamData.role || teamData.coachRole,
          coachRole: teamData.coachRole || teamData.role,
          coachName: teamData.coachName,
          firstName: teamData.firstName,
          lastName: teamData.lastName,
          logoId: teamData.logoId,
          conference: teamData.conference,
          leagueId: currentLeagueId,
          ownerId: teamData.ownerId,
          color: teamData.color,
          assignmentStatus: teamData.assignmentStatus,
          contractStart: teamData.contractStart,
          createdAt: teamData.createdAt
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
      userRole: effectiveRole, 
      userPermissions,
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
