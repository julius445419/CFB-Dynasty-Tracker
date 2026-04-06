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
  wins: number;
  losses: number;
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
    const finalGamesQuery = query(gamesRef, where('status', '==', 'final'));

    let teams: TeamAssignment[] = [];
    let games: Game[] = [];

    const calculateStandings = () => {
      const standingsMap: Record<string, TeamStanding> = {};
      const idToNameMap: Record<string, string> = {};

      // Initialize all schools from the SCHOOLS constant
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
          wins: 0,
          losses: 0,
          confWins: 0,
          confLosses: 0,
          totalWinPct: 0,
          confWinPct: 0,
          streak: '-',
          lastFive: []
        } as any;
      });

      // Override with actual league team data and build ID mapping
      teams.forEach(team => {
        const teamName = team.name || (team as any).school;
        if (standingsMap[teamName]) {
          standingsMap[teamName] = {
            ...standingsMap[teamName],
            ...team,
            wins: 0,
            losses: 0,
            confWins: 0,
            confLosses: 0,
            totalWinPct: 0,
            confWinPct: 0,
            streak: '-',
            lastFive: []
          };
          if (team.id) {
            idToNameMap[team.id] = teamName;
          }
        }
      });

      // Process games chronologically for streak
      const chronologicalGames = [...games].sort((a, b) => a.week - b.week);

      chronologicalGames.forEach(game => {
        const homeTeamName = idToNameMap[game.homeTeamId] || game.homeTeamId;
        const awayTeamName = idToNameMap[game.awayTeamId] || game.awayTeamId;
        
        const homeTeam = standingsMap[homeTeamName];
        const awayTeam = standingsMap[awayTeamName];

        if (!homeTeam || !awayTeam) return;

        const homeScore = game.homeScore || 0;
        const awayScore = game.awayScore || 0;
        const homeWon = homeScore > awayScore;
        const isConfGame = homeTeam.conference === awayTeam.conference;

        // Update Home Team
        if (homeWon) {
          homeTeam.wins++;
          if (isConfGame) homeTeam.confWins++;
          homeTeam.lastFive.push('W');
        } else if (awayScore > homeScore) {
          homeTeam.losses++;
          if (isConfGame) homeTeam.confLosses++;
          homeTeam.lastFive.push('L');
        }

        // Update Away Team
        if (awayScore > homeScore) {
          awayTeam.wins++;
          if (isConfGame) awayTeam.confWins++;
          awayTeam.lastFive.push('W');
        } else if (homeScore > awayScore) {
          awayTeam.losses++;
          if (isConfGame) awayTeam.confLosses++;
          awayTeam.lastFive.push('L');
        }

        // Keep only last 5 for streak calculation
        if (homeTeam.lastFive.length > 5) homeTeam.lastFive.shift();
        if (awayTeam.lastFive.length > 5) awayTeam.lastFive.shift();
      });

      // Finalize stats and streaks
      const finalStandings = Object.values(standingsMap).map(team => {
        const totalGames = team.wins + team.losses;
        const confGames = team.confWins + team.confLosses;
        
        team.totalWinPct = totalGames > 0 ? team.wins / totalGames : 0;
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
