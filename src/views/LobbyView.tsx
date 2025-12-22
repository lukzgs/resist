
import React from 'react';
import { GameState, Player, Role, Mission, Phase } from '../types';
import { GAME_RULES } from '../constants';

interface Props {
  state: GameState;
  isHost: boolean;
  onAddAi: (p: Player) => void;
  onRemove: () => void;
  onStart: () => void;
  broadcast: (s: GameState) => void;
}

export default function LobbyView({ state, isHost, onAddAi, onRemove, onStart, broadcast }: Props) {
  const pCount = state.players.length;
  const canStart = pCount >= 5 && pCount <= 10;

  const handleLaunch = () => {
    const rules = GAME_RULES[pCount];
    const rolesArray = [];
    for (let i = 0; i < rules.spyCount; i++) rolesArray.push(Role.TERMINATOR);
    for (let i = 0; i < (pCount - rules.spyCount); i++) rolesArray.push(Role.HUMAN);
    
    const shuffledRoles = rolesArray.sort(() => Math.random() - 0.5);
    
    const finalPlayers = state.players.map((p, i) => ({ ...p, role: shuffledRoles[i] }));
    const missions: Mission[] = rules.missionSizes.map((size, i) => ({
      roundNumber: i + 1,
      requiredPlayers: size,
      requiresTwoFails: !!(rules.twoFailsRequiredRound4 && i === 3),
      status: 'PENDING',
      team: [],
      votes: {},
      missionOutcomes: []
    }));

    broadcast({
      ...state,
      phase: Phase.TEAM_SELECTION,
      players: finalPlayers,
      missions: missions,
      leaderIndex: Math.floor(Math.random() * pCount),
      logs: [...state.logs, `> UNIDADE FORMADA: ${pCount} AGENTES`, `> ESCANEANDO ASSINATURAS...`]
    });
    onStart();
  };

  const handleAddBot = () => {
    onAddAi({ 
      id: 'bot-' + Math.random().toString(36).substr(2, 4), 
      name: 'T-' + (Math.floor(Math.random() * 900) + 100), 
      role: Role.HUMAN, 
      isAi: true, 
      isHost: false, 
      avatarSeed: Math.floor(Math.random() * 9999) 
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-7xl mx-auto">
      <div className="w-full grid lg:grid-cols-12 gap-8 items-stretch">
        
        <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-black/60 p-8 rounded-3xl border border-white/10 backdrop-blur-xl relative overflow-hidden flex-1">
                <div className="absolute top-0 right-0 p-4 font-mono text-[8px] text-resistance/20">SKYNET_INT_04</div>
                <span className="text-[10px] font-mono text-resistance tracking-widest block mb-4 uppercase font-bold border-b border-resistance/20 pb-2">Canal de Comando</span>
                <div className="text-6xl font-display font-black text-white tracking-widest mb-8 drop-shadow-glow-blue">{state.roomCode}</div>
                
                <div className="space-y-6 font-mono">
                    <div>
                        <div className="flex justify-between text-[10px] text-slate-500 uppercase mb-2">Manifesto de Unidades</div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-resistance transition-all duration-1000" style={{ width: `${(pCount/10)*100}%` }}></div>
                        </div>
                        <div className="mt-1 text-right text-[10px] text-resistance">{pCount}/10 AGENTES CONECTADOS</div>
                    </div>

                    <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">AMEAÇA DE MÁQUINA:</span>
                            <span className="text-spy font-bold">{canStart ? GAME_RULES[pCount].spyCount : '?'} UNIDADES</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400">ESTADO DO BUNKER:</span>
                            <span className="text-green-500 font-bold">ESTÁVEL</span>
                        </div>
                    </div>
                </div>
            </div>

            {isHost && (
                <div className="bg-black/40 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Gerenciamento</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleAddBot} className="bg-white/5 border border-white/10 p-3 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-resistance/20 hover:text-resistance transition-all">
                            IA
                        </button>
                        <button onClick={onRemove} className="bg-white/5 border border-white/10 p-3 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-spy/20 hover:text-spy transition-all">
                            Remover
                        </button>
                    </div>
                </div>
            )}
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-slate-900/20 p-8 rounded-3xl border border-white/5 flex-1 relative min-h-[400px]">
                <div className="absolute top-2 right-4 flex gap-1">
                    <div className="w-1 h-1 bg-resistance rounded-full animate-ping"></div>
                    <span className="text-[8px] font-mono text-resistance/60">LIVE FEED</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {state.players.map((p) => (
                        <div key={p.id} className="group h-20 rounded-2xl border border-white/5 bg-black/40 flex items-center px-4 transition-all hover:border-resistance/40 hover:translate-x-1">
                            <div className="relative shrink-0">
                                <img src={`https://picsum.photos/seed/${p.avatarSeed}/80`} className="w-10 h-10 rounded-lg border border-slate-800 grayscale group-hover:grayscale-0 transition-all" alt={p.name} />
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-resistance rounded-full border border-dark"></div>
                            </div>
                            <div className="ml-4 overflow-hidden">
                                <div className="text-xs font-bold text-white uppercase tracking-wider truncate">{p.name}</div>
                                <div className="text-[8px] font-mono text-slate-500 flex items-center gap-2">
                                    <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                                    {p.isAi ? 'SINTÉTICO' : 'VITAL_OK'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isHost && (
                <button 
                    onClick={handleLaunch} 
                    disabled={!canStart} 
                    className={`w-full py-6 rounded-2xl font-display font-black text-3xl uppercase tracking-[0.2em] transition-all relative overflow-hidden group ${
                        canStart 
                        ? 'bg-spy text-white shadow-glow-red hover:scale-[1.01]' 
                        : 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                    }`}
                >
                    {canStart ? 'Iniciar Incursão' : `Aguardando Unidades (${pCount}/5)`}
                </button>
            )}
        </div>

      </div>
    </div>
  );
}
