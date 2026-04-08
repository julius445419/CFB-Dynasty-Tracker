import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { Game, TeamAssignment, TeamSeasonStats } from '../types';

export interface TeamLeaderStats extends TeamSeasonStats {
  name: string;
  logoId?: number | string;
  conference: string;
  currentRank?: number;
}

export const useStatLeaders = () => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const [stats, setStats] = useState<TeamSeasonStats[]>([]);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentLeagueId) return;

    // Fetch Teams for metadata
    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamAssignment[];
      setTeams(teamsData);
    });

    // Fetch Team Stats for current season
    const seasonYear = leagueInfo?.currentYear || 2025;
    const statsRef = collection(db, 'leagues', currentLeagueId, 'team_stats');
    const q = query(statsRef, where('seasonYear', '==', seasonYear));
    
    const unsubscribeStats = onSnapshot(q, (snapshot) => {
      const statsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamSeasonStats[];
      setStats(statsData);
      setLoading(false);
    });

    return () => {
      unsubscribeTeams();
      unsubscribeStats();
    };
  }, [currentLeagueId, leagueInfo?.currentYear]);

  const leaders = useMemo(() => {
    if (teams.length === 0) return [];

    return stats.map(stat => {
      const team = teams.find(t => t.id === stat.teamId);
      return {
        ...stat,
        name: team?.name || 'Unknown Team',
        logoId: team?.logoId,
        conference: team?.conference || 'Independent',
        currentRank: team?.currentRank
      } as TeamLeaderStats;
    });
  }, [teams, stats]);

  return { leaders, loading };
};
