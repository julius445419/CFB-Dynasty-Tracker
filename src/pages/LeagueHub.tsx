import React from 'react';
import { motion } from 'motion/react';
import { Globe, Trophy, Activity, ChevronRight, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LeagueHub: React.FC = () => {
  const navigate = useNavigate();

  const hubItems = [
    {
      title: 'Programs',
      description: 'View all schools and coaches in the dynasty',
      icon: Globe,
      path: '/programs',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    {
      title: 'Conference Standings',
      description: 'Check the race for the conference championship',
      icon: Trophy,
      path: '/standings',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20'
    },
    {
      title: 'National Leaders',
      description: 'See the top performers across the country',
      icon: Activity,
      path: '/leaders',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    },
    {
      title: 'Top 25 Rankings',
      description: 'View the latest Media, Coaches, and CFP polls',
      icon: Trophy,
      path: '/polls',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 pb-24 selection:bg-orange-600/30">
      <header className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Shield size={20} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">
            League <span className="text-orange-600">Hub</span>
          </h1>
        </motion.div>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
          Dynasty Management & Global Statistics
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {hubItems.map((item, index) => (
          <motion.button
            key={item.path}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => navigate(item.path)}
            className={`group relative flex items-center gap-6 p-6 bg-zinc-900/50 border ${item.border} rounded-[2rem] hover:bg-zinc-900 transition-all text-left active:scale-[0.98] overflow-hidden`}
          >
            {/* Background Accent */}
            <div className={`absolute -right-8 -bottom-8 w-32 h-32 ${item.bg} blur-3xl opacity-50 group-hover:opacity-100 transition-opacity`} />
            
            <div className={`w-16 h-16 ${item.bg} rounded-2xl flex items-center justify-center shrink-0 border ${item.border}`}>
              <item.icon className={`w-8 h-8 ${item.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white uppercase italic tracking-tight group-hover:text-orange-500 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
                {item.description}
              </p>
            </div>

            <div className="w-10 h-10 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-800 group-hover:border-orange-500/50 transition-colors">
              <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-orange-500 transition-colors" />
            </div>
          </motion.button>
        ))}
      </div>

      <footer className="mt-12 pt-12 border-t border-zinc-900 text-center">
        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">
          Dynasty Module v1.5.10 • Calibrated for CFB 26
        </p>
      </footer>
    </div>
  );
};
