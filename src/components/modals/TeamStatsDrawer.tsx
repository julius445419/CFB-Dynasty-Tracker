import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Clock, ShieldAlert, Save, Loader2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Game, TeamAssignment, TeamStats } from '../../types';

interface TeamStatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  homeTeam: TeamAssignment;
  awayTeam: TeamAssignment;
}

const DEFAULT_STATS: TeamStats = {
  passingYards: 0,
  rushingYards: 0,
  firstDowns: 0,
  turnovers: 0,
  thirdDownMade: 0,
  thirdDownAtt: 0,
  topMinutes: 0,
  topSeconds: 0
};

export const TeamStatsDrawer: React.FC<TeamStatsDrawerProps> = ({
  isOpen,
  onClose,
  game,
  homeTeam,
  awayTeam
}) => {
  const [activeTab, setActiveTab] = useState<'away' | 'home'>('away');
  const [awayStats, setAwayStats] = useState<TeamStats>(game.awayStats || DEFAULT_STATS);
  const [homeStats, setHomeStats] = useState<TeamStats>(game.homeStats || DEFAULT_STATS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAwayStats(game.awayStats || DEFAULT_STATS);
      setHomeStats(game.homeStats || DEFAULT_STATS);
    }
  }, [isOpen, game]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const gameRef = doc(db, 'leagues', game.leagueId, 'games', game.id);
      await updateDoc(gameRef, {
        awayStats: { ...awayStats, updatedAt: serverTimestamp() },
        homeStats: { ...homeStats, updatedAt: serverTimestamp() },
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      console.error("Error saving stats:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateStat = (team: 'away' | 'home', field: keyof TeamStats, value: string) => {
    const numValue = parseInt(value) || 0;
    if (team === 'away') {
      setAwayStats(prev => ({ ...prev, [field]: numValue }));
    } else {
      setHomeStats(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const currentStats = activeTab === 'away' ? awayStats : homeStats;
  const currentTeam = activeTab === 'away' ? awayTeam : homeTeam;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-zinc-950 rounded-t-[2.5rem] border-t border-zinc-800 max-h-[90vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mt-4 mb-2" />

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
                  <Activity className="text-orange-500" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight">Team <span className="text-orange-600">Stats</span></h2>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Box Score Entry</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 bg-zinc-900/50 mx-6 mt-6 rounded-2xl border border-zinc-800">
              <button
                onClick={() => setActiveTab('away')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'away' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'
                }`}
              >
                {awayTeam.name}
              </button>
              <button
                onClick={() => setActiveTab('home')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === 'home' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'
                }`}
              >
                {homeTeam.name}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
              {/* Yardage */}
              <div className="grid grid-cols-2 gap-4">
                <StatInput
                  label="Passing Yards"
                  value={currentStats.passingYards}
                  onChange={(val) => updateStat(activeTab, 'passingYards', val)}
                />
                <StatInput
                  label="Rushing Yards"
                  value={currentStats.rushingYards}
                  onChange={(val) => updateStat(activeTab, 'rushingYards', val)}
                />
              </div>

              {/* Total Yards (Calculated) */}
              <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 flex justify-between items-center">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Yards</span>
                <span className="text-2xl font-black italic text-white">
                  {currentStats.passingYards + currentStats.rushingYards}
                </span>
              </div>

              {/* Game Flow */}
              <div className="grid grid-cols-2 gap-4">
                <StatInput
                  label="First Downs"
                  value={currentStats.firstDowns}
                  onChange={(val) => updateStat(activeTab, 'firstDowns', val)}
                />
                <StatInput
                  label="Turnovers"
                  value={currentStats.turnovers}
                  onChange={(val) => updateStat(activeTab, 'turnovers', val)}
                  icon={<ShieldAlert size={14} className="text-red-500" />}
                />
              </div>

              {/* 3rd Down */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">3rd Down Conversions</label>
                <div className="grid grid-cols-2 gap-4">
                  <StatInput
                    label="Made"
                    value={currentStats.thirdDownMade}
                    onChange={(val) => updateStat(activeTab, 'thirdDownMade', val)}
                  />
                  <StatInput
                    label="Attempts"
                    value={currentStats.thirdDownAtt}
                    onChange={(val) => updateStat(activeTab, 'thirdDownAtt', val)}
                  />
                </div>
              </div>

              {/* Time of Possession */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock size={14} className="text-orange-500" />
                  Time of Possession
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <StatInput
                    label="Minutes"
                    value={currentStats.topMinutes}
                    onChange={(val) => updateStat(activeTab, 'topMinutes', val)}
                  />
                  <StatInput
                    label="Seconds"
                    value={currentStats.topSeconds}
                    onChange={(val) => updateStat(activeTab, 'topSeconds', val)}
                  />
                </div>
              </div>
            </div>

            {/* Persistent Save Button */}
            <div className="absolute bottom-0 inset-x-0 p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-orange-900/20 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest italic"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Save size={20} />
                    Save Team Stats
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface StatInputProps {
  label: string;
  value: number;
  onChange: (val: string) => void;
  icon?: React.ReactNode;
}

const StatInput: React.FC<StatInputProps> = ({ label, value, onChange, icon }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
      {icon}
      {label}
    </label>
    <input
      type="number"
      inputMode="numeric"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
      placeholder="0"
    />
  </div>
);
