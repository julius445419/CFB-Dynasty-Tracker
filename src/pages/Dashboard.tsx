import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { Newsfeed } from '../components/dashboard/Newsfeed';
import { HeroMatchup } from '../components/dashboard/HeroMatchup';
import { StatTicker } from '../components/dashboard/StatTicker';
import { Top25Widget } from '../components/dashboard/Top25Widget';
import { enrichTeamsWithStadiums } from '../utils/enrichment';
import { ConferenceStandingsWidget } from '../components/dashboard/ConferenceStandingsWidget';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { leagueInfo, userRole, userTeam, currentLeagueId } = useLeague();
  const navigate = useNavigate();
  const [isEnriching, setIsEnriching] = React.useState(false);

  const isCommissioner = userRole === 'Owner' || userRole === 'Commissioner';

  React.useEffect(() => {
    console.log('Dashboard mounted');
    console.log('Auth User:', user?.uid);
    console.log('League ID:', currentLeagueId);
    console.log('User Role:', userRole);
    console.log('Is Commissioner:', isCommissioner);
    
    if (isCommissioner) {
      (window as any).enrichTeams = handleEnrichTeams;
    }
  }, [user, currentLeagueId, userRole, isCommissioner]);

  const handleEnrichTeams = async () => {
    console.log('handleEnrichTeams triggered');
    console.log('currentLeagueId:', currentLeagueId);
    console.log('isEnriching:', isEnriching);
    console.log('userRole:', userRole);

    if (!currentLeagueId) {
      console.error('No currentLeagueId found');
      alert('Error: No active league selected.');
      return;
    }
    
    if (isEnriching) {
      console.warn('Enrichment already in progress');
      return;
    }
    
    // Proceeding directly to avoid window.confirm blocking in some iframes
    setIsEnriching(true);
    try {
      console.log('Calling enrichTeamsWithStadiums...');
      const count = await enrichTeamsWithStadiums(currentLeagueId);
      console.log('Enrichment successful, count:', count);
      alert(`Success! Updated ${count} teams.`);
    } catch (error) {
      console.error('Enrichment error caught in Dashboard:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEnriching(false);
      console.log('handleEnrichTeams finished');
    }
  };

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
                {leagueInfo?.name} • Season {leagueInfo?.currentYear || 2025} • Week {leagueInfo?.currentWeek ?? 0}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Stat Ticker Section */}
      <div className="-mx-6">
        <StatTicker />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (Hero and Standings) */}
        <div className="lg:col-span-2 space-y-8">
          <HeroMatchup />
          
          {currentLeagueId && userTeam && userTeam.conference && (
            <ConferenceStandingsWidget 
              leagueId={currentLeagueId} 
              conference={userTeam.conference} 
              userTeamId={userTeam.id}
            />
          )}
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Commissioner Actions */}
          {isCommissioner && (
            <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-6 space-y-4">
              <div className="px-2 py-1 bg-black/20 rounded-lg mb-2">
                <p className="text-[8px] text-zinc-500 font-mono uppercase">Debug Info</p>
                <p className="text-[10px] text-zinc-400 font-mono">League: {currentLeagueId || 'None'}</p>
                <p className="text-[10px] text-zinc-400 font-mono">Role: {userRole}</p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/admin/schedule')}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
              >
                Advance Week
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEnrichTeams}
                disabled={isEnriching}
                className={`w-full ${isEnriching ? 'bg-zinc-700 cursor-not-allowed' : 'bg-zinc-800 hover:bg-zinc-700'} text-zinc-300 font-black px-8 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]`}
              >
                {isEnriching ? (
                  <>
                    <span className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    Enriching...
                  </>
                ) : (
                  'Enrich Team Data'
                )}
              </motion.button>
            </div>
          )}

          {/* National Rankings Widget */}
          {currentLeagueId && (
            <Top25Widget leagueId={currentLeagueId} />
          )}

          {/* Latest Activity (Newsfeed) */}
          <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-[2rem] p-1">
            {currentLeagueId && (
              <Newsfeed leagueId={currentLeagueId} userTeamId={userTeam?.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
