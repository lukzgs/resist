
import React, { useState, useRef, useCallback } from 'react';
import { GameState, Phase, Role, Player } from '../types';
import PlayerCard from '../components/PlayerCard';
import MissionTracker from '../components/MissionTracker';
import VoteTracker from '../components/VoteTracker';
import { DisconnectWaitScreen } from '../components/DisconnectWaitScreen';
import { DisconnectVoteScreen } from '../components/DisconnectVoteScreen';
import { useTranslation } from '../i18n';

interface Props {
  state: GameState;
  playerName: string;
  isHost: boolean;
  sendAction: (a: string, p: any) => void;
}

export default function GameView({ state, playerName, isHost, sendAction }: Props) {
  const { t } = useTranslation();
  const [showId, setShowId] = useState(false);
  const me = state.players.find(function (p) { return p.name === playerName; });
  const isLeader = state.players[state.leaderIndex].name === playerName;

  // Estado para guardar o último resultado de votação (para mostrar após todos votarem)
  const [lastVoteResult, setLastVoteResult] = useState<{ approvals: number; rejections: number; approved: boolean } | null>(null);
  const lastPhase = useRef(state.phase);

  // Captura resultado da votação quando a fase muda de TEAM_VOTE para outra
  React.useEffect(() => {
    if (lastPhase.current === Phase.TEAM_VOTE && state.phase !== Phase.TEAM_VOTE) {
      const currentMission = state.missions[state.currentMissionIndex];
      const votes = Object.values(currentMission.votes) as boolean[];
      const approvals = votes.filter(v => v === true).length;
      const rejections = votes.filter(v => v === false).length;
      const approved = approvals > rejections;
      setLastVoteResult({ approvals, rejections, approved });
    }
    // Limpa resultado quando começa nova votação
    if (state.phase === Phase.TEAM_VOTE && lastPhase.current !== Phase.TEAM_VOTE) {
      setLastVoteResult(null);
    }
    lastPhase.current = state.phase;
  }, [state.phase, state.currentMissionIndex, state.missions]);

  // Estado para posição e tamanho do log arrastável - começa no canto inferior direito
  const [logPosition, setLogPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 200 : 16, y: typeof window !== 'undefined' ? window.innerHeight - 180 : 100 });
  const [logDimensions, setLogDimensions] = useState({ width: 280, height: 160 });
  const [logSize, setLogSize] = useState<'minimized' | 'normal' | 'expanded'>('minimized'); // Start minimized on mobile
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const logRef = useRef<HTMLDivElement>(null);

  // Helper to get clientX/Y from mouse or touch event
  const getEventPosition = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const rect = logRef.current?.getBoundingClientRect();
    if (rect) {
      const pos = 'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX, y: e.clientY };
      dragOffset.current = {
        x: pos.x - rect.left,
        y: pos.y - rect.top
      };
      setIsDragging(true);
    }
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    resizeStart.current = {
      x: pos.x,
      y: pos.y,
      width: logDimensions.width,
      height: logDimensions.height
    };
    setIsResizing(true);
  }, [logDimensions]);

  // Drag effect - supports both mouse and touch
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = getEventPosition(e);
      const newX = Math.max(0, Math.min(pos.x - dragOffset.current.x, window.innerWidth - 150));
      const newY = Math.max(0, Math.min(pos.y - dragOffset.current.y, window.innerHeight - 100));
      setLogPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Resize effect - supports both mouse and touch
  React.useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = getEventPosition(e);
      const deltaX = pos.x - resizeStart.current.x;
      const deltaY = pos.y - resizeStart.current.y;
      const newWidth = Math.max(150, Math.min(resizeStart.current.width + deltaX, 500));
      const newHeight = Math.max(80, Math.min(resizeStart.current.height + deltaY, 350));
      setLogDimensions({ width: newWidth, height: newHeight });
      setLogSize('normal');
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing]);

  return (
    <>
      {/* Overlays de desconexão */}
      {state.phase === Phase.PAUSED_DISCONNECT && (
        <DisconnectWaitScreen state={state} />
      )}
      {state.phase === Phase.DISCONNECT_VOTE && (
        <DisconnectVoteScreen state={state} me={me} sendAction={sendAction} />
      )}

      <div className="flex flex-col h-screen relative bg-dark">
        <header className="px-6 py-4 border-b border-white/5 bg-black/80 backdrop-blur-xl flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 bg-spy/10 border border-spy/40 rounded flex items-center justify-center animate-pulse">
                <div className="w-3 h-3 bg-spy rounded-sm shadow-glow-red"></div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-black animate-ping"></div>
            </div>
            <div>
              <h1 className="font-display font-black text-2xl text-white leading-none tracking-tighter">SKYNET_INFILTRATION</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-spy uppercase tracking-[0.3em] font-black">Active_Threat_Detected</span>
                <span className="w-8 h-[1px] bg-spy/40"></span>
                <span className="text-xs font-mono text-slate-300 uppercase tracking-widest font-bold">2029_SYS_LINK</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Badge de terminators */}
            <div className="hidden md:flex items-center gap-2 bg-spy/10 px-3 py-2 rounded-lg border border-spy/30">
              <span className="text-xs font-mono text-spy uppercase tracking-widest">{t('game.terminators_count')}:</span>
              <span className="text-lg font-display font-black text-spy">{state.players.filter(p => p.role === Role.TERMINATOR).length}</span>
            </div>
            <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{t('game.room')}:</span>
              <span className="text-lg font-display font-black text-resistance tracking-widest">{state.roomCode.replace(/0/g, 'Ø')}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12 bg-[radial-gradient(circle_at_center,_#111827_0%,_#050505_100%)] view-enter">
          <div className="max-w-4xl mx-auto bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm relative card-animate">
            <div className="absolute top-2 left-4 text-xs font-mono text-slate-300 uppercase">Operational_Objectives</div>
            <MissionTracker missions={state.missions} currentMissionIndex={state.currentMissionIndex} showRejectionCount={state.showRejectionCount} />
          </div>

          {/* Player cards - hide on GAME_OVER (identities are shown in the game over screen) */}
          {state.phase !== Phase.GAME_OVER && (() => {
            // Filtra espectadores - eles não devem ter cards
            const activePlayers = state.players.filter(p => !p.isSpectator);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
                {activePlayers.map(function (p) {
                  // Encontra o índice original do jogador para verificar se é líder
                  const originalIndex = state.players.findIndex(player => player.id === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={function () {
                        if (isLeader && state.phase === Phase.TEAM_SELECTION && !p.isSpectator) {
                          sendAction('SELECT_PLAYER', { id: p.id });
                        }
                      }}
                      className={`transition-all duration-300 ${isLeader && state.phase === Phase.TEAM_SELECTION ? 'cursor-crosshair' : ''}`}
                    >
                      <PlayerCard
                        player={p}
                        isLeader={originalIndex === state.leaderIndex}
                        isInTeam={state.proposedTeam.includes(p.id)}
                        showIdentity={showId || p.name === playerName || (me?.role === Role.TERMINATOR && p.role === Role.TERMINATOR)}
                        vote={state.phase === Phase.TEAM_VOTE && !state.anonymousVotes ? state.missions[state.currentMissionIndex].votes[p.id] : undefined}
                        hasVoted={state.phase === Phase.TEAM_VOTE && state.anonymousVotes && state.missions[state.currentMissionIndex].votes[p.id] !== undefined}
                        isDisconnected={p.disconnected}
                        isMe={p.name === playerName}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="max-w-xl mx-auto text-center p-10 bg-black/80 rounded-[40px] border-2 border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-resistance/30 to-transparent"></div>

            <div className="mb-8 phase-content">
              <span className="text-sm font-mono text-slate-300 uppercase tracking-[0.5em] block mb-2">Protocol_Status</span>
              <h3 className="text-3xl font-display font-black text-white uppercase tracking-[0.1em] drop-shadow-glow-blue">
                {state.phase.replace(/_/g, ' ')}
              </h3>
            </div>

            <div className="min-h-[120px] flex flex-col justify-center items-center phase-content">
              <PhaseControls state={state} me={me} sendAction={sendAction} isHost={isHost} />
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
              {/* Resultado da última votação (modo anônimo) */}
              {lastVoteResult && state.anonymousVotes && (
                <div className="flex items-center justify-center gap-4 bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                  <span className="text-xs font-mono text-slate-300 uppercase">{t('game.last_vote')}:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-display font-black text-resistance">{lastVoteResult.approvals}</span>
                    <span className="text-xs text-slate-300">×</span>
                    <span className="text-lg font-display font-black text-spy">{lastVoteResult.rejections}</span>
                  </div>
                  <span className={`text-xs font-mono uppercase font-bold ${lastVoteResult.approved ? 'text-green-400' : 'text-red-400'}`}>
                    {lastVoteResult.approved ? t('game.approved') : t('game.rejected')}
                  </span>
                </div>
              )}
              <VoteTracker failedVotes={state.failedVoteCount} />
            </div>
          </div>
        </main>
        {/* Log arrastável */}
        <div
          ref={logRef}
          className={`draggable-log fixed bg-black/60 p-4 rounded-xl border border-white/5 backdrop-blur-md opacity-40 hover:opacity-100 transition-opacity z-40 ${isDragging || isResizing ? 'cursor-grabbing' : ''}`}
          style={{
            left: logPosition.x,
            top: logPosition.y,
            width: logSize === 'minimized' ? 180 : logDimensions.width,
            height: logSize === 'minimized' ? 'auto' : logDimensions.height,
            userSelect: (isDragging || isResizing) ? 'none' : 'auto',
            transition: (isDragging || isResizing) ? 'none' : 'opacity 0.2s'
          }}
        >
          <div
            className="flex justify-between items-center mb-3 border-b border-white/10 pb-1 cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <span className="text-xs font-mono text-resistance font-bold truncate">
              {logSize === 'minimized' ? 'LOG' : 'SYSTEM_LOG_v3.1'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {logSize !== 'minimized' && <span className="text-[10px] text-slate-300 mr-2">⋮⋮</span>}
              {/* Botões de controle de janela */}
              <button
                onClick={(e) => { e.stopPropagation(); setLogSize('minimized'); }}
                className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors"
                title="Minimizar"
              />
              <button
                onClick={(e) => { e.stopPropagation(); setLogSize(logSize === 'expanded' ? 'normal' : 'expanded'); setLogDimensions(logSize === 'expanded' ? { width: 288, height: 180 } : { width: 384, height: 280 }); }}
                className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors"
                title="Expandir"
              />
            </div>
          </div>
          {logSize !== 'minimized' && (
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1" style={{ height: logDimensions.height - 60 }}>
              <div className="space-y-1.5">
                {state.logs.slice(-Math.floor((logDimensions.height - 60) / 20)).map(function (log, i) {
                  return (
                    <div key={i} className="text-xs font-mono text-slate-300 border-l border-slate-800 pl-2 leading-tight lowercase">
                      <span className="text-slate-300 mr-2">[{1024 + i}]</span>
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resize Handle */}
          {logSize !== 'minimized' && (
            <div
              className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize flex items-center justify-center text-slate-300 hover:text-slate-300 transition-colors touch-none"
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            >
              <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface PhaseControlsProps {
  state: GameState;
  me: Player | undefined;
  sendAction: (action: string, payload: any) => void;
  isHost: boolean;
}

function PhaseControls({ state, me, sendAction, isHost }: PhaseControlsProps) {
  const { t } = useTranslation();
  const [pendingVote, setPendingVote] = useState<boolean | null>(null);
  const [pendingMissionAction, setPendingMissionAction] = useState<boolean>(false);

  const currentMission = state.missions[state.currentMissionIndex];

  // Reset pending states quando a fase mudar (hook ANTES do guard)
  React.useEffect(() => {
    if (!me) return;  // Guard interno
    if (currentMission.votes[me.id] !== undefined || state.phase !== Phase.TEAM_VOTE) {
      setPendingVote(null);
    }
    if (state.phase !== Phase.MISSION_EXECUTION) {
      setPendingMissionAction(false);
    }
  }, [me, currentMission.votes, state.phase]);

  // Guard: se jogador não encontrado, mostra erro
  if (!me) {
    return (
      <div className="text-red-400 font-mono text-sm uppercase tracking-widest">
        {t('game.error_player')}
      </div>
    );
  }

  // Após o guard, me é garantidamente Player
  const isLeader = state.players[state.leaderIndex].id === me.id;

  if (state.phase === Phase.TEAM_SELECTION) {
    if (isLeader) return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="flex items-center gap-3 justify-center mb-2">
          <span className="w-2 h-2 bg-resistance animate-ping rounded-full"></span>
          <p className="text-sm font-mono text-resistance uppercase tracking-widest font-bold">{t('game.select_team')}: {state.proposedTeam.length}/{currentMission.requiredPlayers}</p>
        </div>
        <button
          onClick={function () { sendAction('SUBMIT_TEAM', {}); }}
          disabled={state.proposedTeam.length !== currentMission.requiredPlayers}
          className="bg-resistance text-black px-16 py-4 rounded-full font-display font-black text-xl uppercase tracking-widest shadow-glow-blue disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 relative overflow-hidden group"
        >
          {t('game.submit_team')}
          <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:left-full transition-all duration-1000"></div>
        </button>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-3 opacity-60">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="text-slate-300 font-mono text-sm uppercase tracking-widest italic">{t('game.commander_selecting')}</p>
      </div>
    );
  }

  if (state.phase === Phase.TEAM_VOTE) {
    // Já votou (servidor confirmou) ou voto pendente (aguardando confirmação)
    const hasVoted = currentMission.votes[me.id] !== undefined || pendingVote !== null;

    if (hasVoted) {
      // Conta quantos votaram
      const totalVotes = Object.keys(currentMission.votes).length;
      const totalPlayers = state.players.length;
      const remaining = totalPlayers - totalVotes;

      // Mostra tela de aguardando outros jogadores
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-resistance w-1/2 animate-infinite-scroll"></div>
          </div>
          <p className="text-slate-300 font-mono text-sm uppercase tracking-widest">{t('game.waiting_vote')}</p>

          {/* Mostra apenas quantos faltam votar */}
          {remaining > 0 && (
            <div className="flex items-center gap-2 mt-2 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
              <span className="text-lg font-display font-black text-slate-300">{remaining}</span>
              <span className="text-xs font-mono text-slate-300 uppercase">{remaining > 1 ? t('game.agents_pending') : t('game.agent_pending')}</span>
            </div>
          )}
        </div>
      );
    }

    // Ainda não votou - mostra botões
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4">
        <p className="text-sm font-mono text-slate-300 uppercase tracking-widest bg-white/5 py-2 px-4 rounded border border-white/10">{t('game.validate_team')}</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={function () {
              setPendingVote(true);
              sendAction('VOTE', { playerId: me.id, approve: true });
            }}
            className="bg-resistance text-black px-12 py-3 rounded-xl font-display font-black uppercase tracking-widest hover:brightness-125 hover:shadow-glow-blue transition-all hover:scale-105 active:scale-95 relative overflow-hidden group"
          >
            {t('game.approve')}
            <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:left-full transition-all duration-1000"></div>
          </button>
          <button
            onClick={function () {
              setPendingVote(false);
              sendAction('VOTE', { playerId: me.id, approve: false });
            }}
            className="bg-spy text-white px-12 py-3 rounded-xl font-display font-black uppercase tracking-widest hover:brightness-125 hover:shadow-glow-red transition-all hover:scale-105 active:scale-95 relative overflow-hidden group"
          >
            {t('game.reject')}
            <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:left-full transition-all duration-1000"></div>
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === Phase.MISSION_EXECUTION && state.proposedTeam.includes(me.id)) {
    // Já executou ação (pendente)
    if (pendingMissionAction) {
      return (
        <div className="flex flex-col items-center gap-4 opacity-60">
          <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-resistance w-1/2 animate-infinite-scroll"></div>
          </div>
          <p className="text-slate-300 font-mono text-sm uppercase tracking-widest">{t('game.waiting_mission')}</p>
        </div>
      );
    }

    // Ainda não executou - mostra botões
    return (
      <div className="space-y-6 animate-in zoom-in duration-300">
        <div className="relative inline-block">
          <p className="text-sm font-black text-resistance uppercase tracking-[0.4em] mb-2 animate-pulse">{t('game.field_operation')}</p>
          <div className="absolute -bottom-1 left-0 w-full h-[1px] bg-resistance/50"></div>
        </div>
        <div className="flex gap-6 justify-center">
          <button
            onClick={function () {
              setPendingMissionAction(true);
              sendAction('MISSION_ACTION', { success: true });
            }}
            className="group relative bg-black border-2 border-resistance text-resistance px-12 py-4 rounded-xl font-display font-black uppercase tracking-widest hover:bg-resistance hover:text-black transition-all"
          >
            [ {t('game.success')} ]
          </button>
          {me.role === Role.TERMINATOR && (
            <button
              onClick={function () {
                setPendingMissionAction(true);
                sendAction('MISSION_ACTION', { success: false });
              }}
              className="group relative bg-black border-2 border-spy text-spy px-12 py-4 rounded-xl font-display font-black uppercase tracking-widest hover:bg-spy hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              [ {t('game.fail')} ]
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === Phase.GAME_OVER) {
    return <GameOverScreen state={state} isHost={isHost} sendAction={sendAction} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 opacity-40">
      <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-resistance w-1/2 animate-infinite-scroll"></div>
      </div>
      <p className="text-slate-300 font-mono text-sm uppercase tracking-widest">{t('game.waiting_mission')}</p>
    </div>
  );
}

// Componente separado para tela de Game Over (resolve hooks condicionais)
interface GameOverScreenProps {
  state: GameState;
  isHost: boolean;
  sendAction: (action: string, payload: any) => void;
}

function GameOverScreen({ state, isHost, sendAction }: GameOverScreenProps) {
  const { t } = useTranslation();
  const humanWins = state.winner === Role.HUMAN;
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  React.useEffect(() => {
    if (!state.roomExpiresAt) return;

    const updateTime = () => {
      const remaining = Math.max(0, state.roomExpiresAt! - Date.now());
      setTimeLeft(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [state.roomExpiresAt]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 py-4">
      {/* Título com animação */}
      <div className={`animate-zoom-in text-6xl font-display font-black uppercase tracking-tighter leading-tight ${humanWins ? 'text-resistance drop-shadow-glow-blue' : 'text-spy drop-shadow-glow-red animate-glitch'}`}>
        {humanWins ? t('game.resistance_wins') : t('game.skynet_wins')}
      </div>

      {/* Descrição com delay */}
      <div className="animate-fade-in-up animate-delay-200 bg-white/5 p-4 rounded-xl border border-white/10 max-w-sm mx-auto">
        <p className="text-sm font-mono text-slate-300 uppercase leading-relaxed tracking-widest">
          {humanWins ? t('game.win_human_desc') : t('game.win_skynet_desc')}
        </p>
      </div>

      {/* Revelação de jogadores com delay maior - filtra espectadores */}
      <div className="animate-fade-in-up animate-delay-400 bg-black/40 border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto">
        <h3 className="text-xs font-mono text-slate-300 uppercase tracking-widest mb-4 text-center">{t('game.identities_revealed')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {state.players.filter(p => !p.isSpectator).map((player, index) => (
            <div
              key={player.id}
              className={`flex flex-col items-center p-4 rounded-xl border-2 animate-fade-in ${player.role === Role.TERMINATOR
                ? 'border-spy bg-spy/5'
                : 'border-resistance bg-resistance/5'
                }`}
              style={{ animationDelay: `${0.5 + index * 0.1}s`, opacity: 0 }}
            >
              <div className={`w-14 h-14 rounded-full overflow-hidden border-2 mb-2 ${player.role === Role.TERMINATOR ? 'border-spy' : 'border-resistance'
                }`}>
                <img
                  src={`https://picsum.photos/seed/${player.avatarSeed}/80`}
                  className="w-full h-full object-cover"
                  alt={player.name}
                />
              </div>
              <p className="text-white font-bold text-sm truncate max-w-full">{player.name}</p>
              <span className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded mt-1 ${player.role === Role.TERMINATOR
                ? 'bg-spy/20 text-spy border border-spy/30'
                : 'bg-resistance/20 text-resistance border border-resistance/30'
                }`}>
                {player.role === Role.TERMINATOR ? 'TERM' : 'HUMAN'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Countdown */}
      {timeLeft !== null && timeLeft > 0 && (
        <div className="animate-fade-in animate-delay-500 flex items-center justify-center gap-2 text-slate-300 font-mono text-sm">
          <span className="uppercase tracking-widest">{t('game.room_closes_in')}</span>
          <span className="text-resistance font-bold text-lg">{formatTime(timeLeft)}</span>
        </div>
      )}

      {/* Botões */}
      <div className="animate-fade-in-up animate-delay-500 flex gap-4 justify-center flex-wrap">
        {/* Botão Nova Partida - apenas host */}
        {isHost && (
          <button
            onClick={function () { sendAction('RESTART_GAME', {}); }}
            className="bg-resistance text-black px-8 py-3 rounded-full font-display font-black text-lg uppercase tracking-widest hover:brightness-125 hover:shadow-glow-blue transition-all hover:scale-105 active:scale-95"
          >
            {t('game.play_again')}
          </button>
        )}

        {/* Botão Sair - todos */}
        <button
          onClick={function () { sessionStorage.clear(); window.location.reload(); }}
          className="bg-white/5 text-slate-300 px-8 py-3 rounded-full font-mono text-sm uppercase font-black tracking-[0.3em] hover:bg-white/10 hover:text-white transition-all border border-white/10"
        >
          {t('game.back_menu')}
        </button>
      </div>
    </div>
  );
}
