import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Shield, 
  Zap, 
  Wind, 
  Trophy, 
  ChevronRight, 
  Filter,
  Activity,
  User,
  Target,
  Crosshair,
  Sword
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStatLeaders, TeamLeaderStats } from '../hooks/useStatLeaders';
import { usePlayerLeaders, PlayerStatCategory } from '../hooks/usePlayerLeaders';
import { useLeague } from '../context/LeagueContext';
import { TeamLogo } from '../components/common/TeamLogo';

type ViewType = 'players' | 'teams';
type UnitType = 'offense' | 'defense' | 'misc';

interface StatCategory {
  id: string;
  label: string;
  field: string;
  unit: string;
  sortOrder: 'asc' | 'desc';
}

const TEAM_CATEGORIES: Record<UnitType, StatCategory[]> = {
  offense: [
    { id: 'total', label: 'Total Offense', field: 'totalOffYpg', unit: 'YPG', sortOrder: 'desc' },
    { id: 'scoring', label: 'Scoring', field: 'ppg', unit: 'PPG', sortOrder: 'desc' },
    { id: 'passing', label: 'Passing', field: 'passYpg', unit: 'YPG', sortOrder: 'desc' },
    { id: 'rushing', label: 'Rushing', field: 'rushYpg', unit: 'YPG', sortOrder: 'desc' },
    { id: 'conversions', label: 'Conversions', field: 'thirdDownPct', unit: '%', sortOrder: 'desc' },
    { id: 'redzone', label: 'Redzone', field: 'redZoneTdPct', unit: '%', sortOrder: 'desc' },
  ],
  defense: [
    { id: 'total', label: 'Total Defense', field: 'defTotalYpgAllowed', unit: 'YPG', sortOrder: 'asc' },
    { id: 'scoring', label: 'Scoring Defense', field: 'papg', unit: 'PPG', sortOrder: 'asc' },
    { id: 'passing', label: 'Pass Defense', field: 'defPassYpgAllowed', unit: 'YPG', sortOrder: 'asc' },
    { id: 'rushing', label: 'Rush Defense', field: 'defRushYpgAllowed', unit: 'YPG', sortOrder: 'asc' },
    { id: 'redzone', label: 'Redzone Defense', field: 'defRedZoneTdPctAllowed', unit: '%', sortOrder: 'asc' },
  ],
  misc: [
    { id: 'turnovers', label: 'Turnovers', field: 'turnoverMargin', unit: 'DIFF', sortOrder: 'desc' },
    { id: 'penalties', label: 'Penalty Yards', field: 'penaltyYards', unit: 'YDS', sortOrder: 'asc' },
  ]
};

const PLAYER_CATEGORIES: Record<UnitType, StatCategory[]> = {
  offense: [
    { id: 'passing', label: 'Passing Yards', field: 'seasonPassYds', unit: 'YDS', sortOrder: 'desc' },
    { id: 'passing_td', label: 'Passing TDs', field: 'seasonPassTDs', unit: 'TD', sortOrder: 'desc' },
    { id: 'rushing', label: 'Rushing Yards', field: 'seasonRushYds', unit: 'YDS', sortOrder: 'desc' },
    { id: 'rushing_td', label: 'Rushing TDs', field: 'seasonRushTDs', unit: 'TD', sortOrder: 'desc' },
    { id: 'receiving', label: 'Receiving Yards', field: 'seasonRecYds', unit: 'YDS', sortOrder: 'desc' },
    { id: 'receiving_td', label: 'Receiving TDs', field: 'seasonRecTDs', unit: 'TD', sortOrder: 'desc' },
  ],
  defense: [
    { id: 'tackles', label: 'Tackles', field: 'seasonTackles', unit: 'TKL', sortOrder: 'desc' },
    { id: 'sacks', label: 'Sacks', field: 'seasonSacks', unit: 'SCK', sortOrder: 'desc' },
    { id: 'ints', label: 'Interceptions', field: 'seasonInts', unit: 'INT', sortOrder: 'desc' },
  ],
  misc: [
    { id: 'punting', label: 'Punting', field: 'seasonPuntYds', unit: 'YDS', sortOrder: 'desc' }, // Placeholder
  ]
};

interface ColumnConfig {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  format?: (val: any, row: TeamLeaderStats) => React.ReactNode;
}

const TEAM_COLUMN_CONFIGS: Record<string, Record<string, ColumnConfig[]>> = {
  offense: {
    passing: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'GP', key: 'gamesPlayed', align: 'center' },
      { header: 'Pass Yds', key: 'passYards', align: 'right' },
      { header: 'Pass YPG', key: 'passYpg', align: 'right', format: (val) => val.toFixed(1) },
      { header: 'Pass TDs', key: 'passTds', align: 'right' },
      { header: 'INTs', key: 'intsThrown', align: 'right' },
    ],
    rushing: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'GP', key: 'gamesPlayed', align: 'center' },
      { header: 'Rush Yds', key: 'rushYards', align: 'right' },
      { header: 'Rush YPG', key: 'rushYpg', align: 'right', format: (val) => val.toFixed(1) },
      { header: 'Rush TDs', key: 'rushTds', align: 'right' },
    ],
    total: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'GP', key: 'gamesPlayed', align: 'center' },
      { header: 'YPP', key: 'ypp', align: 'center', format: (val) => val?.toFixed(1) || '0.0' },
      { header: 'Rush Yds', key: 'rushYards', align: 'right' },
      { header: 'Pass Yds', key: 'passYards', align: 'right' },
      { header: 'Total Yds', key: 'totalYards', align: 'right', format: (_, row) => (row.passYards + row.rushYards) },
      { header: 'YPG', key: 'totalOffYpg', align: 'right', format: (val) => val.toFixed(1) },
    ],
    scoring: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: 'Total Pts', key: 'pointsScored', align: 'right' },
      { header: 'PPG', key: 'ppg', align: 'right', format: (val) => val.toFixed(1) },
    ],
    conversions: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: '3rd Down %', key: 'thirdDownPct', align: 'right', format: (val) => `${val?.toFixed(1) || '0.0'}%` },
      { header: '4th Down %', key: 'fourthDownPct', align: 'right', format: (val) => `${val?.toFixed(1) || '0.0'}%` },
    ],
    redzone: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: 'RZ Trips', key: 'redZoneAttempts', align: 'center' },
      { header: 'RZ TD %', key: 'redZoneTdPct', align: 'right', format: (val) => `${val?.toFixed(1) || '0.0'}%` },
    ],
  },
  defense: {
    passing: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'GP', key: 'gamesPlayed', align: 'center' },
      { header: 'Pass Yds All.', key: 'defPassYards', align: 'right' },
      { header: 'Pass YPG All.', key: 'defPassYpgAllowed', align: 'right', format: (val) => val.toFixed(1) },
      { header: 'Sacks', key: 'defSacks', align: 'right' },
      { header: 'INTs', key: 'defIntsCaught', align: 'right' },
    ],
    rushing: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'GP', key: 'gamesPlayed', align: 'center' },
      { header: 'Rush Yds All.', key: 'defRushYards', align: 'right' },
      { header: 'Rush YPG All.', key: 'defRushYpgAllowed', align: 'right', format: (val) => val.toFixed(1) },
      { header: 'Sacks', key: 'defSacks', align: 'right' },
    ],
    total: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'GP', key: 'gamesPlayed', align: 'center' },
      { header: 'YPP All.', key: 'defYppAllowed', align: 'center', format: (val) => val?.toFixed(1) || '0.0' },
      { header: 'Rush Yds All.', key: 'defRushYards', align: 'right' },
      { header: 'Pass Yds All.', key: 'defPassYards', align: 'right' },
      { header: 'Total Yds All.', key: 'totalYards', align: 'right', format: (_, row) => (row.defPassYards + row.defRushYards) },
      { header: 'YPG All.', key: 'defTotalYpgAllowed', align: 'right', format: (val) => val.toFixed(1) },
      { header: 'Sacks', key: 'defSacks', align: 'right' },
    ],
    scoring: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: 'Total Pts', key: 'pointsAllowed', align: 'right' },
      { header: 'PPG', key: 'papg', align: 'right', format: (val) => val.toFixed(1) },
    ],
    redzone: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: 'RZ Trips All.', key: 'defRedZoneAttemptsAllowed', align: 'center' },
      { header: 'RZ TD %', key: 'defRedZoneTdPctAllowed', align: 'right', format: (val) => `${val?.toFixed(1) || '0.0'}%` },
    ],
  },
  misc: {
    turnovers: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: 'Giveaways', key: 'turnovers', align: 'center' },
      { header: 'Takeaways', key: 'takeaways', align: 'center' },
      { header: 'Margin', key: 'turnoverMargin', align: 'right', format: (val) => (val > 0 ? `+${val}` : val) },
      { header: 'Margin/G', key: 'turnoverMarginPg', align: 'right', format: (val) => val?.toFixed(1) || '0.0' },
    ],
    penalties: [
      { header: 'Rank', key: 'rank' },
      { header: 'Team', key: 'team' },
      { header: 'G', key: 'gamesPlayed', align: 'center' },
      { header: 'Penalties', key: 'penalties', align: 'center' },
      { header: 'Yds', key: 'penaltyYards', align: 'right' },
      { header: 'Yds/G', key: 'penaltyYpg', align: 'right', format: (_, row) => (row.penaltyYards / (row.gamesPlayed || 1)).toFixed(1) },
    ]
  }
};

export const StatLeaders: React.FC = () => {
  const { userTeam } = useLeague();
  const [viewType, setViewType] = useState<ViewType>('teams');
  const [activeUnit, setActiveUnit] = useState<UnitType>('offense');
  const [activeCategory, setActiveCategory] = useState<string>('total');
  const [minGames, setMinGames] = useState(1);

  const currentCategories = viewType === 'teams' ? TEAM_CATEGORIES : PLAYER_CATEGORIES;

  const currentCategoryConfig = useMemo(() => {
    const unitCats = currentCategories[activeUnit] || currentCategories['offense'];
    return unitCats.find(c => c.id === activeCategory) || unitCats[0];
  }, [viewType, activeUnit, activeCategory, currentCategories]);

  const { leaders: teamLeaders, loading: teamLoading } = useStatLeaders();
  const { leaders: playerLeaders, loading: playerLoading } = usePlayerLeaders(
    (viewType === 'players' ? currentCategoryConfig.field : 'seasonPassYds') as PlayerStatCategory
  );

  const teamColumns = useMemo(() => {
    return TEAM_COLUMN_CONFIGS[activeUnit]?.[activeCategory] || [];
  }, [activeUnit, activeCategory]);

  // Reset category when unit or viewType changes
  const handleViewTypeChange = (type: ViewType) => {
    setViewType(type);
    const newUnit = 'offense';
    setActiveUnit(newUnit);
    const cats = type === 'teams' ? TEAM_CATEGORIES : PLAYER_CATEGORIES;
    setActiveCategory(cats[newUnit][0].id);
  };

  const handleUnitChange = (unit: UnitType) => {
    setActiveUnit(unit);
    const cats = viewType === 'teams' ? TEAM_CATEGORIES : PLAYER_CATEGORIES;
    const unitCats = cats[unit] || cats['offense'];
    setActiveCategory(unitCats[0].id);
  };

  const sortedTeamLeaders = useMemo(() => {
    const filtered = teamLeaders.filter(l => l.gamesPlayed >= minGames);
    const field = currentCategoryConfig.field;
    
    return [...filtered].sort((a, b) => {
      const valA = (a as any)[field] || 0;
      const valB = (b as any)[field] || 0;
      return currentCategoryConfig.sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [teamLeaders, currentCategoryConfig, minGames]);

  const loading = viewType === 'players' ? playerLoading : teamLoading;

  return (
    <div className="space-y-6 p-4 pb-24 max-w-5xl mx-auto">
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              <Trophy className="text-orange-600" size={24} />
              National <span className="text-orange-600">Leaders</span>
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Season Statistics Hub</p>
          </div>

          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => handleViewTypeChange('players')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                viewType === 'players' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <User size={12} />
              Players
            </button>
            <button
              onClick={() => handleViewTypeChange('teams')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                viewType === 'teams' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Activity size={12} />
              Teams
            </button>
          </div>
        </div>
      </header>

      {/* Level 2: Units */}
      <div className="flex border-b border-zinc-800">
        {(['offense', 'defense', 'misc'] as UnitType[]).map((unit) => {
          const hasCats = !!currentCategories[unit];
          if (!hasCats) return null;
          
          return (
            <button
              key={unit}
              onClick={() => handleUnitChange(unit)}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeUnit === unit 
                  ? 'border-orange-600 text-white' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {unit}
            </button>
          );
        })}
      </div>

      {/* Level 3: Categories */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {(currentCategories[activeUnit] || []).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap border ${
              activeCategory === cat.id
                ? 'bg-zinc-100 border-white text-zinc-950 shadow-lg'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800">
                  {viewType === 'teams' ? (
                    teamColumns.map((col) => (
                      <th 
                        key={col.key} 
                        className={`px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        } ${col.key === 'rank' ? 'w-16' : ''}`}
                      >
                        {col.header}
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest w-16">Rank</th>
                      <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Player</th>
                      <th className="px-4 py-3 text-[10px] font-black text-orange-500 uppercase tracking-widest text-right">
                        {currentCategoryConfig.label}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {viewType === 'teams' ? (
                    sortedTeamLeaders.length > 0 ? (
                      sortedTeamLeaders.map((leader, index) => (
                        <motion.tr
                          key={leader.teamId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ delay: index * 0.03 }}
                          className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                            userTeam?.id === leader.teamId ? 'bg-orange-600/5' : ''
                          }`}
                        >
                          {teamColumns.map((col) => {
                            if (col.key === 'rank') {
                              return (
                                <td key={col.key} className="px-4 py-4">
                                  <div className={`text-sm font-black italic ${
                                    index < 3 ? 'text-orange-500' : 'text-zinc-500'
                                  }`}>
                                    {index + 1}
                                  </div>
                                </td>
                              );
                            }
                            if (col.key === 'team') {
                              return (
                                <td key={col.key} className="px-4 py-4">
                                  <Link to={`/teams/${leader.teamId}`} className="flex items-center gap-3 group">
                                    <TeamLogo 
                                      schoolName={leader.name} 
                                      size="sm"
                                      className="bg-zinc-950 rounded-lg p-1 border border-zinc-800 group-hover:scale-110 transition-transform"
                                    />
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        {leader.currentRank && leader.currentRank <= 25 && (
                                          <span className="text-[10px] font-black text-orange-500">#{leader.currentRank}</span>
                                        )}
                                        <span className="text-sm font-black text-white uppercase italic tracking-tight group-hover:text-orange-500 transition-colors">
                                          {leader.name}
                                        </span>
                                      </div>
                                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                        {leader.conference}
                                      </p>
                                    </div>
                                  </Link>
                                </td>
                              );
                            }

                            const val = (leader as any)[col.key];
                            return (
                              <td 
                                key={col.key} 
                                className={`px-4 py-4 ${
                                  col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                                }`}
                              >
                                <span className={`text-xs font-bold ${col.align === 'right' ? 'text-white italic' : 'text-zinc-400'}`}>
                                  {col.format ? col.format(val, leader) : val}
                                </span>
                              </td>
                            );
                          })}
                        </motion.tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={teamColumns.length || 4} />
                    )
                  ) : (
                    playerLeaders.length > 0 ? (
                      playerLeaders.map((player, index) => (
                        <motion.tr
                          key={player.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ delay: index * 0.03 }}
                          className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                            userTeam?.id === player.teamId ? 'bg-orange-600/5' : ''
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div className={`text-sm font-black italic ${
                              index < 3 ? 'text-orange-500' : 'text-zinc-500'
                            }`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3 group">
                              <TeamLogo 
                                schoolName={player.teamId} 
                                size="sm"
                                className="bg-zinc-950 rounded-lg p-1 border border-zinc-800 opacity-50"
                              />
                              <div>
                                <h3 className="text-sm font-black text-white uppercase italic tracking-tight">
                                  {player.name}
                                </h3>
                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                  {player.pos} • {player.teamId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-white italic">
                                {((player as any)[currentCategoryConfig.field] || 0)}
                              </span>
                              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                                {currentCategoryConfig.unit}
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <EmptyRow colSpan={3} />
                    )
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyRow = ({ colSpan }: { colSpan: number }) => (
  <tr>
    <td colSpan={colSpan} className="py-20 text-center">
      <div className="space-y-2">
        <Trophy className="mx-auto text-zinc-800" size={32} />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No data available for this season</p>
      </div>
    </td>
  </tr>
);
