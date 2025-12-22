
import React from 'react';

interface Props {
  onNavigate: (v: 'CREATE' | 'JOIN') => void;
}

export default function HomeView({ onNavigate }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-scan opacity-5 pointer-events-none"></div>
      
      <div className="z-10 text-center space-y-12 max-w-lg">
        <div className="space-y-2 animate-float">
          <h1 className="text-8xl font-display font-black tracking-tighter text-white drop-shadow-glow-blue italic">SKYNET</h1>
          <p className="text-xs font-mono text-resistance tracking-[0.5em] uppercase font-bold">Infiltration Protocol</p>
        </div>

        <div className="grid gap-6">
          <button 
            onClick={() => onNavigate('CREATE')}
            className="group relative p-8 bg-black/40 border-2 border-resistance/30 rounded-3xl hover:border-resistance hover:bg-resistance/10 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
               <svg className="w-16 h-16 text-resistance" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
            </div>
            <div className="text-3xl font-display font-black text-white mb-1 uppercase tracking-tighter">Assumir Comando</div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Host Local Terminal</p>
          </button>

          <button 
            onClick={() => onNavigate('JOIN')}
            className="group relative p-8 bg-black/40 border-2 border-white/10 rounded-3xl hover:border-white/40 transition-all text-left overflow-hidden"
          >
            <div className="text-3xl font-display font-black text-white mb-1 uppercase tracking-tighter">Infiltrar Célula</div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Sync via Quantum Link</p>
          </button>
        </div>

        <div className="pt-12">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest animate-pulse">Connection Status: Ready for uplink...</p>
        </div>
      </div>
    </div>
  );
}
