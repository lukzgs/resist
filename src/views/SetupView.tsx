
import React from 'react';

interface Props {
  mode: 'CREATE' | 'JOIN';
  playerName: string;
  onNameChange: (n: string) => void;
  onInit: () => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}

export default function SetupView({ mode, playerName, onNameChange, onInit, onJoin, onBack }: Props) {
  const [code, setCode] = React.useState('');
  const isJoin = mode === 'JOIN';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md bg-black/60 backdrop-blur-3xl p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-resistance/50 to-transparent"></div>

        <h2 className="text-3xl font-display font-black text-white mb-8 uppercase tracking-[0.2em] text-center italic">
          {isJoin ? 'Quantum Sync' : 'Unit Identification'}
        </h2>

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-mono text-slate-500 uppercase tracking-widest ml-4">Codename</label>
            <input
              type="text"
              value={playerName}
              onChange={e => onNameChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-resistance transition-all font-mono text-xl"
              placeholder="Ex: T-800"
            />
          </div>

          {isJoin && (
            <div className="space-y-2">
              <label className="text-sm font-mono text-slate-500 uppercase tracking-widest ml-4">Link Code</label>
              <input
                type="text"
                maxLength={4}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none text-center text-5xl font-display tracking-[0.5em] focus:border-resistance transition-all"
                placeholder="0000"
              />
            </div>
          )}

          <div className="pt-4 space-y-4">
            <button
              onClick={() => isJoin ? onJoin(code) : onInit()}
              className="w-full bg-resistance text-black py-5 rounded-2xl font-display font-black text-2xl shadow-glow-blue uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
            >
              {isJoin ? 'Establish Link' : 'Initialize Terminal'}
            </button>
            <button
              onClick={onBack}
              className="w-full text-slate-500 text-sm uppercase font-bold tracking-[0.3em] hover:text-white transition-colors"
            >
              Abort Mission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
