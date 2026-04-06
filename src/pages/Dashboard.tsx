import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { CurrentMatchupCard } from '../components/matchups/CurrentMatchupCard';
import { Newsfeed } from '../components/dashboard/Newsfeed';
import { Top25Widget } from '../components/dashboard/Top25Widget';
import { ConferenceStandingsWidget } from '../components/dashboard/ConferenceStandingsWidget';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { leagueInfo, userRole, userTeam, currentLeagueId } = useLeague();
  const navigate = useNavigate();

  const isCommissioner = userRole === 'Owner' || userRole === 'Commissioner';

  return (
    <div className="space-y-8 p-6 pb-24">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">
              Welcome back, <span className="text-orange-600">{user?.displayName?.split(' ')[0] || 'Coach'}!</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {leagueInfo?.name} • Season {leagueInfo?.currentYear || 1} • Week {leagueInfo?.currentWeek ?? 1}
              </span>
            </div>
          </div>
        </div>

        {isCommissioner && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/admin/schedule')}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center gap-2 uppercase tracking-widest text-xs"
          >
            Advance Week
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        )}
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Matchup & Primary Actions */}
        <div className="lg:col-span-8 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Current Matchup</h2>
            </div>
            {currentLeagueId && leagueInfo && userTeam ? (
              <CurrentMatchupCard 
                leagueId={currentLeagueId}
                currentWeek={leagueInfo.currentWeek}
                userTeamId={userTeam.id}
                isCommissioner={isCommissioner}
              />
            ) : (
              <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4">
                <p className="text-zinc-500 font-medium">Please join a team to see your matchup.</p>
              </div>
            )}
          </section>

          {currentLeagueId && (
            <Newsfeed leagueId={currentLeagueId} userTeamId={userTeam?.id} />
          )}
        </div>

        {/* Right Column: Secondary Info / Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <section className="space-y-4">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">League Timeline</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-black">
                    {leagueInfo?.currentWeek ?? 1}
                  </div>
                  <div className="w-0.5 h-full bg-zinc-800 my-2" />
                </div>
                <div className="pb-6">
                  <h4 className="text-sm font-bold text-white">Active Week</h4>
                  <p className="text-xs text-zinc-500 mt-1">Regular season games are underway. Report your scores before the deadline.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-black">
                    {(leagueInfo?.currentWeek ?? 1) + 1}
                  </div>
                  <div className="w-0.5 h-full bg-zinc-800 my-2" />
                </div>
                <div className="pb-6">
                  <h4 className="text-sm font-bold text-zinc-400">Next Week</h4>
                  <p className="text-xs text-zinc-600 mt-1">Prepare for your next matchup and scout upcoming talent.</p>
                </div>
              </div>
            </div>
          </section>

          {currentLeagueId && (
            <Top25Widget leagueId={currentLeagueId} />
          )}

          {currentLeagueId && userTeam && userTeam.conference && (
            <ConferenceStandingsWidget 
              leagueId={currentLeagueId} 
              conference={userTeam.conference} 
              userTeamId={userTeam.id}
            />
          )}
        </div>
      </div>
    </div>
  );
};
