import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useStatLeaders } from '../../hooks/useStatLeaders';
import { Trophy } from 'lucide-react';

export const StatTicker: React.FC = () => {
  const { leaders, loading } = useStatLeaders();

  const tickerItems = useMemo(() => {
    if (loading || leaders.length === 0) return [];

    const categories = [
      { label: 'PPG', key: 'ppg', format: (v: number) => v.toFixed(1) },
      { label: 'TOTAL OFFENSE', key: 'totalOffYpg', format: (v: number) => v.toFixed(0) },
      { label: 'PASSING YDS', key: 'passYpg', format: (v: number) => v.toFixed(0) },
    ];

    const items: { category: string; team: string; value: string }[] = [];

    categories.forEach(cat => {
      const topTeams = [...leaders]
        .sort((a, b) => (b[cat.key as keyof typeof b] as number) - (a[cat.key as keyof typeof a] as number))
        .slice(0, 3);

      topTeams.forEach(team => {
        items.push({
          category: cat.label,
          team: team.name.toUpperCase(),
          value: cat.format(team[cat.key as keyof typeof team] as number),
        });
      });
    });

    return items;
  }, [leaders, loading]);

  if (loading || tickerItems.length === 0) return null;

  return (
    <div className="w-full h-9 bg-zinc-950/80 backdrop-blur-md border-y border-white/5 overflow-hidden flex items-center relative z-40">
      {/* Live Indicator */}
      <div className="absolute left-0 top-0 bottom-0 px-4 bg-zinc-950 z-10 flex items-center gap-2 border-r border-white/5 shadow-[10px_0_20px_rgba(0,0,0,0.5)]">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Stats</span>
      </div>

      <div className="flex-1 overflow-hidden relative h-full">
        <motion.div
          animate={{
            x: [0, -2000],
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear",
          }}
          className="flex items-center whitespace-nowrap gap-12 pl-[120px] h-full"
          style={{ width: 'fit-content' }}
        >
          {/* Quadruple items for very long seamless loop */}
          {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 group cursor-default hover:text-orange-400 transition-colors">
              <span className="text-[10px] font-black text-orange-500 tracking-widest">{item.category}</span>
              <span className="text-[10px] font-bold text-zinc-100 tracking-tight group-hover:text-white">{item.team}</span>
              <span className="text-[10px] font-black text-white tabular-nums">({item.value})</span>
              <span className="text-zinc-800 ml-4">•</span>
            </div>
          ))}
        </motion.div>
        
        {/* Hover overlay to pause animation via CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          .flex-1:hover > div {
            animation-play-state: paused !important;
          }
        `}} />
      </div>

      {/* Right Gradient Fade */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none z-10" />
    </div>
  );
};
