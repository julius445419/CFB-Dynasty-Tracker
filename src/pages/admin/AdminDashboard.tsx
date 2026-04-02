import React from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Calendar, Shield, ChevronRight, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

const AdminDashboard: React.FC = () => {
  const adminTools = [
    {
      title: 'Member Management',
      description: 'Manage coaches, roles, and school assignments.',
      icon: Users,
      path: '/admin/members',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      title: 'Shadow Coaches',
      description: 'Create placeholder entries for human coaches.',
      icon: UserPlus,
      path: '/admin/shadow-coaches',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    },
    {
      title: 'Pending Requests',
      description: 'Review and approve school join requests.',
      icon: UserPlus,
      path: '/admin/requests',
      color: 'text-zinc-500',
      bg: 'bg-zinc-500/10'
    },
    {
      title: 'Schedule Management',
      description: 'Add games, advance weeks, and manage matchups.',
      icon: Calendar,
      path: '/admin/schedule',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    },
    {
      title: 'League Settings',
      description: 'Configure league rules, year, and phase.',
      icon: Shield,
      path: '/admin/settings',
      color: 'text-zinc-500',
      bg: 'bg-zinc-500/10'
    }
  ];

  return (
    <div className="p-6 space-y-8 pb-24">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Shield className="w-8 h-8 text-orange-600" />
          Commissioner Tools
        </h1>
        <p className="text-zinc-500 font-medium">Manage your dynasty's infrastructure and members.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminTools.map((tool, index) => (
          <motion.div
            key={tool.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={tool.path}
              className="group flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] hover:border-orange-500/50 transition-all shadow-xl"
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 ${tool.bg} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <tool.icon className={`w-7 h-7 ${tool.color}`} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-500 transition-colors">{tool.title}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-1">{tool.description}</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-zinc-700 group-hover:text-orange-500 transition-all group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats / Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-[40px] p-8 mt-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Trophy className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Dynasty <span className="text-orange-600">Control</span></h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">System Status: Operational</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Total Games</p>
            <p className="text-2xl font-black text-white">124</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Active Users</p>
            <p className="text-2xl font-black text-white">12</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Pending</p>
            <p className="text-2xl font-black text-orange-500">3</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Season Year</p>
            <p className="text-2xl font-black text-white">2024</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
