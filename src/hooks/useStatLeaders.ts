import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { Game, TeamAssignment } from '../types';

export interface TeamLeaderStats {
  teamId: string;
  name: string;
  logoId?: number;
  conference: string;
  gamesPlayed: number;
  ppg: number;
  ypg: number;
  passYpg: number;
  rushYpg: number;
  defYpg: number;
  turnoverMargin: number;
}

export const useStatLeaders = () => {
  const { currentLeagueId } = useLeague();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentLeagueId) return;

    // Fetch Teams
    const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamAssignment[];
      setTeams(teamsData);
    });

    // Fetch Final Games
    const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
    const q = query(gamesRef, where('status', '==', 'final'));
    const unsubscribeGames = onSnapshot(q, (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Game[];
      setGames(gamesData);
      setLoading(false);
    });

    return () => {
      unsubscribeTeams();
      unsubscribeGames();
    };
  }, [currentLeagueId]);

  const leaders = useMemo(() => {
    if (teams.length === 0) return [];

    const statsMap: Record<string, {
      totalPoints: number;
      totalPassYds: number;
      totalRushYds: number;
      totalYdsAllowed: number;
      takeaways: number;
      giveaways: number;
      gp: number;
    }> = {};

    // Initialize map for all teams
    teams.forEach(team => {
      if (team.id) {
        statsMap[team.id] = {
          totalPoints: 0,
          totalPassYds: 0,
          totalRushYds: 0,
          totalYdsAllowed: 0,
          takeaways: 0,
          giveaways: 0,
          gp: 0
        };
      }
    });

    // Aggregate game data
    games.forEach(game => {
      const homeId = game.homeTeamId;
      const awayId = game.awayTeamId;

      if (statsMap[homeId]) {
        const s = statsMap[homeId];
        s.gp += 1;
        s.totalPoints += game.homeScore;
        if (game.homeStats) {
          s.totalPassYds += game.homeStats.passingYards || 0;
          s.totalRushYds += game.homeStats.rushingYards || 0;
          s.giveaways += game.homeStats.turnovers || 0;
        }
        if (game.awayStats) {
          s.totalYdsAllowed += (game.awayStats.passingYards || 0) + (game.awayStats.rushingYards || 0);
          s.takeaways += game.awayStats.turnovers || 0;
        }
      }

      if (statsMap[awayId]) {
        const s = statsMap[awayId];
        s.gp += 1;
        s.totalPoints += game.awayScore;
        if (game.awayStats) {
          s.totalPassYds += game.awayStats.passingYards || 0;
          s.totalRushYds += game.awayStats.rushingYards || 0;
          s.giveaways += game.awayStats.turnovers || 0;
        }
        if (game.homeStats) {
          s.totalYdsAllowed += (game.homeStats.passingYards || 0) + (game.homeStats.rushingYards || 0);
          s.takeaways += game.homeStats.turnovers || 0;
        }
      }
    });

    // Calculate final stats
    return teams.map(team => {
      const s = statsMap[team.id!];
      const gp = s?.gp || 0;

      return {
        teamId: team.id!,
        name: team.name,
        logoId: team.logoId,
        conference: team.conference,
        gamesPlayed: gp,
        ppg: gp > 0 ? s.totalPoints / gp : 0,
        ypg: gp > 0 ? (s.totalPassYds + s.totalRushYds) / gp : 0,
        passYpg: gp > 0 ? s.totalPassYds / gp : 0,
        rushYpg: gp > 0 ? s.totalRushYds / gp : 0,
        defYpg: gp > 0 ? s.totalYdsAllowed / gp : 0,
        turnoverMargin: gp > 0 ? (s.takeaways - s.giveaways) / gp : 0
      };
    });
  }, [teams, games]);

  return { leaders, loading };
};
