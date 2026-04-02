import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Game, TeamAssignment } from '../types';
import { SCHOOLS } from '../constants/schools';

export interface TeamStanding extends TeamAssignment {
  totalWins: number;
  totalLosses: number;
  confWins: number;
  confLosses: number;
  totalWinPct: number;
  confWinPct: number;
  streak: string;
  lastFive: ('W' | 'L')[];
}

export const useStandings = (leagueId: string | null) => {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<any>(null);

  useEffect(() => {
    if (!leagueId) return;

    const teamsRef = collection(db, 'leagues', leagueId, 'teams');
    const gamesRef = collection(db, 'leagues', leagueId, 'games');
    const finalGamesQuery = query(gamesRef, where('status', '==', 'final'), orderBy('updatedAt', 'desc'));

    let teams: TeamAssignment[] = [];
    let games: Game[] = [];

    const calculateStandings = () => {
      const standingsMap: Record<string, TeamStanding> = {};

      // Initialize all schools from the SCHOOLS constant to ensure we have everyone
      // but prioritize teams that exist in the league's teams collection
      SCHOOLS.forEach(school => {
        standingsMap[school.name] = {
          name: school.name,
          school: school.name,
          conference: school.conference,
          logoId: typeof school.logoId === 'number' ? school.logoId : undefined,
          color: school.color,
          coachName: 'CPU',
          coachRole: 'HC',
          leagueId: leagueId,
          ownerId: null,
          assignmentStatus: 'Inactive',
          contractStart: null,
          createdAt: null,
          totalWins: 0,
          totalLosses: 0,
          confWins: 0,
          confLosses: 0,
          totalWinPct: 0,
          confWinPct: 0,
          streak: '-',
          lastFive: []
        } as any;
      });

      // Override with actual league team data if available
      teams.forEach(team => {
        const teamName = team.name || (team as any).school;
        if (standingsMap[teamName]) {
          standingsMap[teamName] = {
            ...standingsMap[teamName],
            ...team,
            totalWins: 0,
            totalLosses: 0,
            confWins: 0,
            confLosses: 0,
            totalWinPct: 0,
            confWinPct: 0,
            streak: '-',
            lastFive: []
          };
        }
      });

      // Process games (sorted by updatedAt desc already, but we need chronological for streak)
      // Actually for streak we need chronological order. Let's sort games by week.
      const chronologicalGames = [...games].sort((a, b) => a.week - b.week);

      chronologicalGames.forEach(game => {
        const homeTeam = standingsMap[game.homeTeamId];
        const awayTeam = standingsMap[game.awayTeamId];

        if (!homeTeam || !awayTeam) return;

        const homeWon = game.homeScore > game.awayScore;
        const isConfGame = homeTeam.conference === awayTeam.conference;

        // Update Home Team
        if (homeWon) {
          homeTeam.totalWins++;
          if (isConfGame) homeTeam.confWins++;
          homeTeam.lastFive.push('W');
        } else {
          homeTeam.totalLosses++;
          if (isConfGame) homeTeam.confLosses++;
          homeTeam.lastFive.push('L');
        }

        // Update Away Team
        if (!homeWon) {
          awayTeam.totalWins++;
          if (isConfGame) awayTeam.confWins++;
          awayTeam.lastFive.push('W');
        } else {
          awayTeam.totalLosses++;
          if (isConfGame) awayTeam.confLosses++;
          awayTeam.lastFive.push('L');
        }

        // Keep only last 5 for streak calculation
        if (homeTeam.lastFive.length > 5) homeTeam.lastFive.shift();
        if (awayTeam.lastFive.length > 5) awayTeam.lastFive.shift();
      });

      // Finalize stats and streaks
      const finalStandings = Object.values(standingsMap).map(team => {
        const totalGames = team.totalWins + team.totalLosses;
        const confGames = team.confWins + team.confLosses;
        
        team.totalWinPct = totalGames > 0 ? team.totalWins / totalGames : 0;
        team.confWinPct = confGames > 0 ? team.confWins / confGames : 0;

        // Calculate Streak
        if (team.lastFive.length > 0) {
          const lastResult = team.lastFive[team.lastFive.length - 1];
          let count = 0;
          for (let i = team.lastFive.length - 1; i >= 0; i--) {
            if (team.lastFive[i] === lastResult) {
              count++;
            } else {
              break;
            }
          }
          team.streak = `${lastResult}${count}`;
        }

        return team;
      });

      setStandings(finalStandings);
      setLoading(false);
    };

    const unsubscribeTeams = onSnapshot(teamsRef, (snapshot) => {
      teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamAssignment));
      calculateStandings();
    });

    const unsubscribeGames = onSnapshot(finalGamesQuery, (snapshot) => {
      games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      if (games.length > 0) {
        setLastUpdated(games[0].updatedAt);
      }
      calculateStandings();
    });

    return () => {
      unsubscribeTeams();
      unsubscribeGames();
    };
  }, [leagueId]);

  return { standings, loading, lastUpdated };
};
