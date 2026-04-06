import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, Calendar, Users, BarChart3, ArrowLeft, Loader2, Target, Shield } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { getTeamLogo, getTeamColor } from '../utils/teamAssets';
import { Game, TeamAssignment, Prospect } from '../types';
import { RosterList } from '../components/roster/RosterList';
import { MyBoard } from './MyBoard';
import { NextGameWidget } from '../components/school/NextGameWidget';
import { RecentResultsWidget } from '../components/school/RecentResultsWidget';
import { StatHub } from '../components/school/StatHub';
import { CoachCard } from '../components/school/CoachCard';

type Tab = 'Home' | 'Roster' | 'Depth Chart' | 'Recruiting';

export const SchoolHome: React.FC = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLeagueId, leagueInfo } = useLeague();
  const [team, setTeam] = useState<TeamAssignment | null>(null);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [opponent, setOpponent] = useState<TeamAssignment | null>(null);

  const isOwner = team?.ownerId === user?.uid;

  useEffect(() => {
    const fetchData = async () => {
      if (!currentLeagueId || !schoolId) return;
      setLoading(true);
      try {
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const allTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamAssignment));
        setTeams(allTeams);

        const teamData = allTeams.find(t => t.id === schoolId);
        if (teamData) {
          setTeam(teamData);

          // Fetch games
          const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
          const gamesSnap = await getDocs(gamesRef);
          const allGames = gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
          const teamGames = allGames.filter(g => g.homeTeamId === schoolId || g.awayTeamId === schoolId);
          setGames(teamGames);

          // Fetch next opponent
          const nextGame = teamGames.find(g => g.status === 'scheduled');
          if (nextGame) {
            const opponentId = nextGame.homeTeamId === schoolId ? nextGame.awayTeamId : nextGame.homeTeamId;
            const opponentData = allTeams.find(t => t.id === opponentId);
            if (opponentData) {
              setOpponent(opponentData);
            }
          }

          // Fetch prospects
          const prospectsRef = collection(db, 'leagues', currentLeagueId, 'prospects');
          const qProspects = query(prospectsRef, where('committedTo', '==', teamData.name));
          const prospectsSnap = await getDocs(qProspects);
          const prospectsData = prospectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prospect));
          setProspects(prospectsData);
        }
      } catch (error) {
        console.error('Error fetching school data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId, currentLeagueId]);

  if (loading) return <div className="flex h-screen items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
  if (!team) return <div className="text-white p-6">School not found.</div>;

  const logoUrl = getTeamLogo(team.name);
  const teamColor = getTeamColor(team.name);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 pb-24">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Identity Header */}
      <header className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-6 flex items-center gap-6">
        <div className="w-24 h-24 bg-zinc-800 rounded-2xl p-4 flex items-center justify-center">
          <img src={logoUrl} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </div>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex flex-wrap items-baseline gap-3">
            {team.name}
            {team.coachName && (
              <span className="text-orange-500 text-xl italic lowercase first-letter:uppercase">
                Coach {team.coachName}
              </span>
            )}
          </h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-1">{team.conference}</p>
          <div className="flex gap-4 mt-3">
            <span className="text-sm font-black text-white">{team.wins || 0}-{team.losses || 0} Record</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
        {(['Home', 'Roster', 'Depth Chart', 'Recruiting'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab ? 'bg-orange-600 text-white' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {activeTab === 'Home' && (
        <>
          {/* Next Game & Recent Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {games.find(g => g.status === 'scheduled') && opponent && (
              <NextGameWidget game={games.find(g => g.status === 'scheduled')!} team={team} opponent={opponent} />
            )}
            <RecentResultsWidget games={games} team={team} teams={teams} />
          </div>

          <CoachCard team={team} isEditable={isOwner} />

          <StatHub team={team} games={games} />

          {/* Rankings */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">National Rank</p>
              <p className="text-2xl font-black text-white">#{team.rank || 'NR'}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Conference</p>
              <p className="text-2xl font-black text-white">{team.conference}</p>
            </div>
          </div>

          {/* Recruiting Snapshot */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2"><Users size={16} className="text-orange-500" /> Recruiting Snapshot</h3>
            <div className="flex justify-between">
              {[5, 4, 3, 2, 1].map(stars => (
                <div key={stars} className="text-center">
                  <p className="text-2xl font-black">{prospects.filter(p => p.stars === stars).length}</p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">{stars}★</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'Roster' && <RosterList />}
      {activeTab === 'Recruiting' && <MyBoard teamId={team.id} />}
      
      {activeTab !== 'Home' && activeTab !== 'Roster' && activeTab !== 'Recruiting' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{activeTab} module calibrating...</p>
        </div>
      )}
    </div>
  );
};
