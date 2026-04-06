import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { getTeamLogo } from '../../utils/teamAssets';
import { TeamLogo } from '../common/TeamLogo';

interface TeamOption {
  id: string;
  name: string;
  conference?: string;
  isCPU?: boolean;
  isFCS?: boolean;
}

interface SearchableTeamSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: TeamOption[];
  placeholder?: string;
}

export const SearchableTeamSelect: React.FC<SearchableTeamSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select Team"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTeam = options.find(t => t.id === value);

  const filteredOptions = options.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.conference?.toLowerCase().includes(search.toLowerCase())
  );

  // Group options: FBS first, then FCS
  const fbsOptions = filteredOptions.filter(t => !t.isFCS);
  const fcsOptions = filteredOptions.filter(t => t.isFCS);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const renderOption = (team: TeamOption) => (
    <div
      key={team.id}
      onClick={() => {
        onChange(team.id);
        setIsOpen(false);
        setSearch('');
      }}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
        value === team.id ? 'bg-orange-600 text-white' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
      }`}
    >
      <TeamLogo 
        schoolName={team.name} 
        className="w-6 h-6 object-contain shrink-0" 
      />
      <div className="flex-1 overflow-hidden">
        <div className="font-bold truncate">{team.name}</div>
        <div className={`text-[10px] uppercase tracking-widest font-black ${value === team.id ? 'text-orange-200' : 'text-zinc-600'}`}>
          {team.conference}
        </div>
      </div>
      {team.isFCS ? (
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
          value === team.id ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-500'
        }`}>
          FCS
        </span>
      ) : team.isCPU && (
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
          value === team.id ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'
        }`}>
          CPU
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</label>
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-zinc-950 border ${isOpen ? 'border-orange-500' : 'border-zinc-800'} rounded-2xl py-3 sm:py-4 px-4 flex items-center justify-between cursor-pointer transition-all hover:border-zinc-700`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {selectedTeam ? (
            <>
              <TeamLogo 
                schoolName={selectedTeam.name} 
                className="w-6 h-6 object-contain shrink-0" 
              />
              <span className="text-white font-bold truncate">{selectedTeam.name}</span>
            </>
          ) : (
            <span className="text-zinc-600 font-bold">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams or conferences..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-white text-sm font-medium placeholder:text-zinc-600"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-zinc-600 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-sm">No teams found</div>
            ) : (
              <>
                {fbsOptions.length > 0 && fbsOptions.map(renderOption)}
                {fcsOptions.length > 0 && (
                  <>
                    <div className="px-3 py-2 mt-2 mb-1 border-t border-zinc-800">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">FCS Teams</span>
                    </div>
                    {fcsOptions.map(renderOption)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
