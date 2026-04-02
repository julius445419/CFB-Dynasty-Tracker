import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Shield, 
  Zap, 
  Wind, 
  Trophy, 
  ChevronRight, 
  Search,
  Filter,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStatLeaders, TeamLeaderStats } from '../hooks/useStatLeaders';
import { useLeague } from '../context/LeagueContext';
import { getTeamLogo } from '../utils/teamAssets';

type StatCategory = 'scoring' | 'totalOffense' | 'passing' | 'rushing' | 'defense' | 'turnoverMargin';

interface CategoryConfig {
  id: StatCategory;
  label: string;
  icon: any;
  unit: string;
  sortOrder: 'asc' | 'desc';
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'totalOffense', label: 'Total Offense', icon: Activity, unit: 'YPG', sortOrder: 'desc' },
  { id: 'scoring', label: 'Scoring', icon: Flame, unit: 'PPG', sortOrder: 'desc' },
  { id: 'passing', label: 'Passing', icon: Wind, unit: 'YPG', sortOrder: 'desc' },
  { id: 'rushing', label: 'Rushing', icon: Zap, unit: 'YPG', sortOrder: 'desc' },
  { id: 'defense', label: 'Total Defense', icon: Shield, unit: 'YPG', sortOrder: 'asc' },
  { id: 'turnoverMargin', label: 'TO Margin', icon: Trophy, unit: 'AVG', sortOrder: 'desc' },
];

export const StatLeaders: React.FC = () => {
  const { leaders, loading } = useStatLeaders();
  const { userTeam } = useLeague();
  const [activeCategory, setActiveCategory] = useState<StatCategory>('totalOffense');
  const [minGames, setMinGames] = useState(1);

  const sortedLeaders = useMemo(() => {
    const filtered = leaders.filter(l => l.gamesPlayed >= minGames);
    const config = CATEGORIES.find(c => c.id === activeCategory)!;
    
    return [...filtered].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (activeCategory) {
        case 'scoring': valA = a.ppg; valB = b.ppg; break;
        case 'totalOffense': valA = a.ypg; valB = b.ypg; break;
        case 'passing': valA = a.passYpg; valB = b.passYpg; break;
        case 'rushing': valA = a.rushYpg; valB = b.rushYpg; break;
        case 'defense': valA = a.defYpg; valB = b.defYpg; break;
        case 'turnoverMargin': valA = a.turnoverMargin; valB = b.turnoverMargin; break;
      }

      return config.sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [leaders, activeCategory, minGames]);

  const getStatValue = (leader: TeamLeaderStats) => {
    switch (activeCategory) {
      case 'scoring': return leader.ppg;
      case 'totalOffense': return leader.ypg;
      case 'passing': return leader.passYpg;
      case 'rushing': return leader.rushYpg;
      case 'defense': return leader.defYpg;
      case 'turnoverMargin': return leader.turnoverMargin;
      default: return 0;
    }
  };

  const getRankColor = (index: number) => {
    if (index === 0) return 'text-yellow-500'; // Gold
    if (index === 1) return 'text-zinc-400';   // Silver
    if (index === 2) return 'text-orange-600'; // Bronze
    return 'text-zinc-600';
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return 'bg-yellow-500/10 border-yellow-500/20';
    if (index === 1) return 'bg-zinc-400/10 border-zinc-400/20';
    if (index === 2) return 'bg-orange-600/10 border-orange-600/20';
    return 'bg-zinc-900 border-zinc-800';
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  const activeConfig = CATEGORIES.find(c => c.id === activeCategory)!;

  return (
    <div className="space-y-8 p-6 pb-24">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
            National <span className="text-orange-600">Leaders</span>
          </h1>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-zinc-500" />
            <select 
              value={minGames}
              onChange={(e) => setMinGames(parseInt(e.target.value))}
              className="bg-transparent text-[10px] font-black text-white uppercase tracking-widest focus:outline-none"
            >
              <option value={0}>Min GP: 0</option>
              <option value={1}>Min GP: 1</option>
              <option value={2}>Min GP: 2</option>
              <option value={3}>Min GP: 3</option>
            </select>
          </div>
        </div>
        <p className="text-zinc-500 font-medium">Top performing programs across the league.</p>
      </header>

      {/* Category Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap border ${
              activeCategory === cat.id
                ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
            }`}
          >
            <cat.icon size={14} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedLeaders.length > 0 ? (
            sortedLeaders.map((leader, index) => {
              const isUserTeam = userTeam?.name === leader.name;
              const statValue = getStatValue(leader);
              
              return (
                <motion.div
                  key={leader.teamId}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={`/teams/${leader.teamId}`}
                    className={`group flex items-center justify-between p-4 rounded-[2rem] border transition-all ${
                      isUserTeam 
                        ? 'bg-orange-600/10 border-orange-600 shadow-lg shadow-orange-600/5' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 backdrop-blur-xl'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black italic text-lg ${getRankBadge(index)} ${getRankColor(index)}`}>
                        {index + 1}
                      </div>

                      {/* Team Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-zinc-950 rounded-2xl p-2 border border-zinc-800 group-hover:scale-110 transition-transform">
                          <img 
                            src={getTeamLogo(leader.name)} 
                            alt={leader.name} 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h3 className="font-black text-white uppercase italic tracking-tight group-hover:text-orange-500 transition-colors">
                            {leader.name}
                          </h3>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {leader.conference} • {leader.gamesPlayed} GP
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stat Value */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xl font-black text-white italic">
                          {statValue.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                          {activeConfig.unit}
                        </span>
                      </div>
                      {activeCategory === 'turnoverMargin' && (
                        <div className={`flex items-center justify-end gap-0.5 text-[10px] font-black uppercase ${statValue > 0 ? 'text-green-500' : statValue < 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                          {statValue > 0 ? <ArrowUpRight size={10} /> : statValue < 0 ? <ArrowDownRight size={10} /> : null}
                          {statValue > 0 ? 'Positive' : statValue < 0 ? 'Negative' : 'Even'}
                        </div>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })
          ) : (
            <div className="py-20 text-center space-y-4 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-[3rem]">
              <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                <Trophy className="text-zinc-700" size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-white font-black uppercase italic">No Data Available</p>
                <p className="text-zinc-500 text-sm font-medium">Complete games to populate the leaderboard.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
