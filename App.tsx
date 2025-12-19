
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Phase, Player, Role, Mission } from './types';
import { GAME_RULES } from './constants';
import { getAiTeamSelection, getAiTeamVote, getAiMissionAction } from './services/geminiService';
import PlayerCard from './components/PlayerCard';
import MissionTracker from './components/MissionTracker';
import VoteTracker from './components/VoteTracker';

const shuffle = <T,>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

export default function App() {
  const [view, setView] = useState<'HOME' | 'CREATE' | 'JOIN' | 'LOBBY' | 'GAME'>('HOME');
  const [playerName, setPlayerName] = useState('Agente_' + Math.floor(Math.random() * 999));
  const [roomCodeInput, setRoomCodeInput] = useState('');
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [peer, setPeer] = useState<any>(null);
  const [hostConn, setHostConn] = useState<any>(null); // Conexão para o cliente falar com o host
  const [connections, setConnections] = useState<any[]>([]); // Conexões do host com clientes
  const [isHost, setIsHost] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = gameState;

  // --- NETWORKING ---

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  const initPeer = (code: string, asHost: boolean) => {
    // @ts-ignore
    const p = new window.Peer('RES-' + code);
    
    p.on('open', () => {
      setPeer(p);
      if (asHost) {
        setIsHost(true);
        setupLobby(code);
      }
    });

    p.on('connection', (conn: any) => {
      if (asHost) {
        conn.on('open', () => {
          setConnections(prev => [...prev, conn]);
          conn.on('data', (data: any) => handleIncomingData(data, conn));
        });
      }
    });

    p.on('error', (err: any) => {
      if (err.type !== 'unavailable-id' || asHost) {
        console.error("Peer Error:", err);
      }
    });
  };

  const setupLobby = (code: string) => {
    const hostPlayer: Player = {
      id: 'p-host',
      name: playerName,
      role: Role.RESISTANCE,
      isAi: false,
      isHost: true,
      avatarSeed: Math.floor(Math.random() * 9000)
    };

    setGameState({
      phase: Phase.LOBBY,
      roomCode: code,
      players: [hostPlayer],
      leaderIndex: 0,
      currentMissionIndex: 0,
      missions: [],
      failedVoteCount: 0,
      proposedTeam: [],
      logs: [`> PROTOCOLO CRIADO: ${code}`, `> AGUARDANDO CONEXÕES...`],
      winner: null,
      isProcessingAi: false
    });
    setView('LOBBY');
  };

  const joinRoom = () => {
    if (roomCodeInput.length !== 4) return alert("Código Inválido");
    // @ts-ignore
    const p = new window.Peer();
    p.on('open', () => {
      const conn = p.connect('RES-' + roomCodeInput);
      conn.on('open', () => {
        setHostConn(conn);
        conn.send({ type: 'JOIN_REQUEST', name: playerName });
        conn.on('data', (data: any) => {
          if (data.type === 'STATE_UPDATE') {
            setGameState(data.state);
            setView(data.state.phase === Phase.LOBBY ? 'LOBBY' : 'GAME');
          }
        });
      });
      setPeer(p);
    });
  };

  const broadcastState = (newState: GameState) => {
    connections.forEach(conn => conn.send({ type: 'STATE_UPDATE', state: newState }));
    setGameState(newState);
  };

  // Funções de envio de ação (Cliente -> Host)
  const sendActionToHost = (type: string, payload: any) => {
    if (isHost) {
      processAction(type, payload);
    } else if (hostConn) {
      hostConn.send({ type: 'ACTION', action: type, payload });
    }
  };

  const handleIncomingData = (data: any, conn: any) => {
    if (!stateRef.current || !isHost) return;
    const state = stateRef.current;

    if (data.type === 'JOIN_REQUEST') {
      if (state.players.length < 10) {
        const newPlayer: Player = {
          id: 'p-' + Math.random().toString(36).substr(2, 5),
          name: data.name,
          role: Role.RESISTANCE,
          isAi: false,
          isHost: false,
          avatarSeed: Math.floor(Math.random() * 9000)
        };
        broadcastState({ ...state, players: [...state.players, newPlayer] });
      }
    } else if (data.type === 'ACTION') {
      processAction(data.action, data.payload);
    }
  };

  const processAction = (action: string, payload: any) => {
    // Esta lógica roda APENAS no Host
    if (!isHost || !stateRef.current) return;
    const state = stateRef.current;

    switch (action) {
      case 'SELECT_PLAYER':
        if (state.phase !== Phase.TEAM_SELECTION) return;
        const currentMission = state.missions[state.currentMissionIndex];
        const isSelected = state.proposedTeam.includes(payload.id);
        let newTeam = [...state.proposedTeam];

        if (isSelected) {
          newTeam = newTeam.filter(pid => pid !== payload.id);
        } else if (newTeam.length < currentMission.requiredPlayers) {
          newTeam.push(payload.id);
        }
        broadcastState({ ...state, proposedTeam: newTeam });
        break;

      case 'SUBMIT_TEAM':
        broadcastState({
          ...state,
          phase: Phase.TEAM_VOTE,
          logs: [...state.logs, `> EQUIPE PROPOSTA PARA MISSÃO ${state.currentMissionIndex + 1}`]
        });
        break;

      case 'VOTE':
        const updatedMissions = [...state.missions];
        updatedMissions[state.currentMissionIndex].votes[payload.playerId] = payload.approve;
        const newState = { ...state, missions: updatedMissions };
        broadcastState(newState);
        
        // Se todos votaram, resolve
        const humanVotes = newState.players.filter(p => !p.isAi).length;
        const currentVotes = Object.keys(updatedMissions[newState.currentMissionIndex].votes).length;
        // AI vota automaticamente no Host
        if (currentVotes >= humanVotes) {
          // Trigger AI votes if any, then resolve
          resolveVotesAndContinue(newState);
        }
        break;
    }
  };

  const resolveVotesAndContinue = async (currentState: GameState) => {
    // Processar votos de IA
    const aiPlayers = currentState.players.filter(p => p.isAi);
    const aiVotes: Record<string, boolean> = {};
    
    await Promise.all(aiPlayers.map(async (bot) => {
      const decision = await getAiTeamVote(currentState, bot);
      aiVotes[bot.id] = decision.approve;
    }));

    const finalMissions = [...currentState.missions];
    finalMissions[currentState.currentMissionIndex].votes = {
      ...finalMissions[currentState.currentMissionIndex].votes,
      ...aiVotes
    };

    const votes = Object.values(finalMissions[currentState.currentMissionIndex].votes);
    const approves = votes.filter(v => v).length;
    const approved = approves > (votes.length / 2);

    if (approved) {
      broadcastState({
        ...currentState,
        phase: Phase.MISSION_EXECUTION,
        missions: finalMissions.map((m, i) => i === currentState.currentMissionIndex ? { ...m, team: currentState.proposedTeam } : m),
        failedVoteCount: 0,
        logs: [...currentState.logs, `> EQUIPE APROVADA (${approves}/${votes.length})`]
      });
    } else {
      const nextFailed = currentState.failedVoteCount + 1;
      if (nextFailed >= 5) {
        broadcastState({ ...currentState, winner: Role.SPY, phase: Phase.GAME_OVER, logs: [...currentState.logs, "> 5 VOTOS REJEITADOS. ESPIÕES VENCEM."] });
      } else {
        broadcastState({
          ...currentState,
          phase: Phase.TEAM_SELECTION,
          failedVoteCount: nextFailed,
          leaderIndex: (currentState.leaderIndex + 1) % currentState.players.length,
          proposedTeam: [],
          logs: [...currentState.logs, `> EQUIPE REJEITADA. FALHAS: ${nextFailed}/5`]
        });
      }
    }
  };

  // --- LOBBY ACTIONS ---

  const addAiAgent = () => {
    if (!isHost || !gameState || gameState.players.length >= 10) return;
    const newAi: Player = {
        id: `bot-${Math.random().toString(36).substr(2, 5)}`,
        name: `AI_UNIT_${gameState.players.filter(p => p.isAi).length + 1}`,
        role: Role.RESISTANCE,
        isAi: true,
        isHost: false,
        avatarSeed: Math.floor(Math.random() * 9000)
    };
    broadcastState({ ...gameState, players: [...gameState.players, newAi] });
  };

  const removeLastAgent = () => {
    if (!isHost || !gameState || gameState.players.length <= 1) return;
    broadcastState({ ...gameState, players: gameState.players.slice(0, -1) });
  };

  const launchProtocol = () => {
    if (!isHost || !gameState) return;
    const playerCount = gameState.players.length;
    if (playerCount < 5) return alert("Mínimo de 5 jogadores necessário.");

    const rules = GAME_RULES[playerCount];
    const roles = shuffle([
      ...Array(rules.spyCount).fill(Role.SPY),
      ...Array(playerCount - rules.spyCount).fill(Role.RESISTANCE),
    ]);

    const finalPlayers = gameState.players.map((p, i) => ({ ...p, role: roles[i] }));
    const missions: Mission[] = rules.missionSizes.map((size, i) => ({
      roundNumber: i + 1,
      requiredPlayers: size,
      requiresTwoFails: !!(rules.twoFailsRequiredRound4 && i === 3),
      status: 'PENDING',
      team: [],
      votes: {},
      missionOutcomes: []
    }));

    broadcastState({
      ...gameState,
      phase: Phase.TEAM_SELECTION,
      players: finalPlayers,
      missions,
      logs: [...gameState.logs, `> PROTOCOLO INICIADO COM ${playerCount} AGENTES`],
      leaderIndex: Math.floor(Math.random() * playerCount)
    });
    setView('GAME');
  };

  // --- UI ACTIONS BRIDGE ---

  const handlePlayerClick = (id: string) => {
    if (gameState?.phase === Phase.TEAM_SELECTION) {
      const isLeader = gameState.players[gameState.leaderIndex].id === (isHost ? 'p-host' : gameState.players.find(p => p.name === playerName)?.id);
      if (isLeader) sendActionToHost('SELECT_PLAYER', { id });
    }
  };

  const submitTeam = () => sendActionToHost('SUBMIT_TEAM', {});
  const castVote = (approve: boolean) => {
    const myId = isHost ? 'p-host' : gameState?.players.find(p => p.name === playerName)?.id;
    sendActionToHost('VOTE', { playerId: myId, approve });
  };

  // --- RENDERING ---

  if (view === 'HOME') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
        <div className="max-w-md w-full space-y-8 animate-float text-center">
          <h1 className="text-7xl font-display font-black tracking-tighter text-white drop-shadow-glow-blue">PROTOCOL</h1>
          <div className="grid gap-4">
            <button onClick={() => setView('CREATE')} className="p-8 bg-slate-900/60 border border-resistance/30 rounded-2xl hover:border-resistance transition-all text-left">
              <div className="text-2xl font-display font-bold text-white mb-1 uppercase">Operar Célula</div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Criar Sala (Host)</p>
            </button>
            <button onClick={() => setView('JOIN')} className="p-8 bg-slate-900/60 border border-white/10 rounded-2xl hover:border-white/40 transition-all text-left">
              <div className="text-2xl font-display font-bold text-white mb-1 uppercase">Infiltrar</div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Entrar via Código</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'CREATE' || view === 'JOIN') {
    const isJoining = view === 'JOIN';
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl">
           <h2 className="text-2xl font-display font-bold text-white mb-6 uppercase tracking-wider text-center">{isJoining ? 'Sincronizar' : 'Identificação'}</h2>
           <div className="space-y-6">
              <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 rounded-lg text-white outline-none focus:border-resistance text-center font-mono" placeholder="Seu Codename" />
              {isJoining && (
                 <input type="text" maxLength={4} value={roomCodeInput} onChange={e => setRoomCodeInput(e.target.value.toUpperCase())} className="w-full bg-black/50 border border-white/10 p-4 rounded-lg text-white outline-none text-center text-4xl font-display tracking-[0.5em]" placeholder="CODE" />
              )}
              <button onClick={isJoining ? joinRoom : () => initPeer(generateRoomCode(), true)} className="w-full bg-resistance py-4 rounded-lg font-display font-bold text-xl shadow-glow-blue uppercase">
                {isJoining ? 'Acessar Célula' : 'Gerar Código'}
              </button>
              <button onClick={() => setView('HOME')} className="w-full text-slate-600 text-[10px] uppercase font-bold tracking-widest">Voltar</button>
           </div>
        </div>
      </div>
    );
  }

  if (view === 'LOBBY' && gameState) {
    const pCount = gameState.players.length;
    const canStart = pCount >= 5 && pCount <= 10;
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-6xl mx-auto">
            <div className="w-full grid lg:grid-cols-3 gap-8 items-start">
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-white/5 backdrop-blur-md">
                    <span className="text-[10px] font-mono text-resistance tracking-widest block mb-1 uppercase">Código</span>
                    <div className="text-5xl font-display font-black text-white tracking-widest">{gameState.roomCode}</div>
                    <div className="mt-4 pt-4 border-t border-white/5 font-mono text-xs">
                        <div className="flex justify-between text-slate-400">Agentes: <span className="text-white">{pCount}/10</span></div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {gameState.players.map((p, i) => (
                            <div key={i} className="h-24 rounded-xl border-2 border-resistance/30 bg-resistance/5 flex items-center px-4">
                                <img src={`https://picsum.photos/seed/${p.avatarSeed}/80`} className="w-10 h-10 rounded-full border border-resistance/50 mr-3" />
                                <div className="text-xs font-bold text-white truncate">{p.name}</div>
                            </div>
                        ))}
                    </div>

                    {isHost && (
                        <div className="pt-8 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={addAiAgent} className="bg-white/5 border border-white/10 p-3 rounded-lg text-[10px] font-bold uppercase tracking-widest">Add IA</button>
                                <button onClick={removeLastAgent} className="bg-white/5 border border-white/10 p-3 rounded-lg text-[10px] font-bold uppercase tracking-widest">Remover</button>
                            </div>
                            <button onClick={launchProtocol} disabled={!canStart} className={`w-full py-5 rounded-xl font-display font-bold text-2xl uppercase ${canStart ? 'bg-resistance shadow-glow-blue' : 'bg-slate-800 text-slate-600'}`}>Iniciar Protocolo</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen relative font-sans overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/40 backdrop-blur-md">
        <div className="flex flex-col">
            <h1 className="font-display font-black text-2xl text-white">RESISTANCE</h1>
            <span className="text-[10px] font-mono text-resistance uppercase tracking-widest">SQUAD: {gameState?.players.length} / ROOM: {gameState?.roomCode}</span>
        </div>
        <button onClick={() => setShowIdentity(!showIdentity)} className="bg-white/5 px-4 py-2 rounded border border-white/10 text-[10px] font-bold uppercase tracking-widest">
            {showIdentity ? 'Ocultar ID' : 'Revelar ID'}
        </button>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto p-4 flex flex-col items-center">
         {gameState && (
             <div className="w-full max-w-6xl">
                <MissionTracker missions={gameState.missions} currentMissionIndex={gameState.currentMissionIndex} />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
                    {gameState.players.map((p, i) => (
                        <div key={p.id} onClick={() => handlePlayerClick(p.id)}>
                            <PlayerCard 
                                player={p}
                                isLeader={i === gameState.leaderIndex}
                                isInTeam={gameState.proposedTeam.includes(p.id)}
                                showIdentity={showIdentity || p.name === playerName} 
                            />
                        </div>
                    ))}
                </div>
                
                <div className="mt-12 max-w-xl mx-auto text-center">
                    <h3 className="text-2xl font-display font-bold text-white mb-4 uppercase">{gameState.phase.replace('_', ' ')}</h3>
                    
                    {/* Controles Dinâmicos baseados no papel do jogador */}
                    {gameState.phase === Phase.TEAM_SELECTION && gameState.players[gameState.leaderIndex].name === playerName && (
                        <button onClick={submitTeam} disabled={gameState.proposedTeam.length !== gameState.missions[gameState.currentMissionIndex].requiredPlayers} className="bg-resistance px-8 py-3 rounded-full font-bold uppercase tracking-widest shadow-glow-blue disabled:opacity-30">Confirmar Equipe</button>
                    )}
                    
                    {gameState.phase === Phase.TEAM_VOTE && !gameState.missions[gameState.currentMissionIndex].votes[isHost ? 'p-host' : gameState.players.find(p => p.name === playerName)?.id || ''] && (
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => castVote(true)} className="bg-resistance px-8 py-3 rounded-lg font-bold">APROVAR</button>
                            <button onClick={() => castVote(false)} className="bg-spy px-8 py-3 rounded-lg font-bold">REJEITAR</button>
                        </div>
                    )}
                </div>
                <VoteTracker failedVotes={gameState.failedVoteCount} />
             </div>
         )}
      </main>
    </div>
  );
}
