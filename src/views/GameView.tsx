
import React, { useState } from 'react';
import { GameState, Phase, Role } from '../types';
import PlayerCard from '../components/PlayerCard';
import MissionTracker from '../components/MissionTracker';
import VoteTracker from '../components/VoteTracker';

interface Props {
  state: GameState;
  playerName: string;
  isHost: boolean;
  sendAction: (a: string, p: any) => void;
}

export default function GameView({ state, playerName, isHost, sendAction }: Props) {
  const [showId, setShowId] = useState(false);
  const me = state.players.find(function (p) { return p.name === playerName; });
  const isLeader = state.players[state.leaderIndex].name === playerName;

  return (
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
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest font-bold">2029_SYS_LINK</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end font-mono text-xs text-slate-600 uppercase tracking-widest mr-4">
            <span>Signal_Strength: 98%</span>
            <span>Lat: 34.0522° N | Long: 118.2437° W</span>
          </div>
          <button
            onClick={function () { setShowId(!showId); }}
            className="group relative bg-white/5 px-6 py-2 rounded border border-white/10 text-sm font-mono font-black uppercase tracking-[0.3em] hover:bg-resistance/20 hover:text-resistance hover:border-resistance/40 transition-all overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-resistance opacity-0 group-hover:opacity-100 transition-opacity"></div>
            {showId ? '[ Hide_Intel ]' : '[ View_Identity ]'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12 bg-[radial-gradient(circle_at_center,_#111827_0%,_#050505_100%)]">
        <div className="max-w-4xl mx-auto bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm relative">
          <div className="absolute top-2 left-4 text-xs font-mono text-slate-600 uppercase">Operational_Objectives</div>
          <MissionTracker missions={state.missions} currentMissionIndex={state.currentMissionIndex} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {state.players.map(function (p, i) {
            return (
              <div
                key={p.id}
                onClick={function () {
                  if (isLeader && state.phase === Phase.TEAM_SELECTION) {
                    sendAction('SELECT_PLAYER', { id: p.id });
                  }
                }}
                className={`transition-all duration-300 ${isLeader && state.phase === Phase.TEAM_SELECTION ? 'cursor-crosshair' : ''}`}
              >
                <PlayerCard
                  player={p}
                  isLeader={i === state.leaderIndex}
                  isInTeam={state.proposedTeam.includes(p.id)}
                  showIdentity={showId || p.name === playerName || (me?.role === Role.TERMINATOR && p.role === Role.TERMINATOR)}
                  vote={state.phase === Phase.TEAM_VOTE ? state.missions[state.currentMissionIndex].votes[p.id] : undefined}
                />
              </div>
            );
          })}
        </div>

        <div className="max-w-xl mx-auto text-center p-10 bg-black/80 rounded-[40px] border-2 border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-resistance/30 to-transparent"></div>

          <div className="mb-8">
            <span className="text-sm font-mono text-slate-500 uppercase tracking-[0.5em] block mb-2">Protocol_Status</span>
            <h3 className="text-3xl font-display font-black text-white uppercase tracking-[0.1em] drop-shadow-glow-blue">
              {state.phase.replace(/_/g, ' ')}
            </h3>
          </div>

          <div className="min-h-[120px] flex flex-col justify-center items-center">
            <PhaseControls state={state} me={me} sendAction={sendAction} />
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <VoteTracker failedVotes={state.failedVoteCount} />
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 left-6 w-72 bg-black/60 p-4 rounded-xl border border-white/5 backdrop-blur-md opacity-40 hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
        <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-1">
          <span className="text-xs font-mono text-resistance font-bold">SYSTEM_LOG_v3.1</span>
          <div className="w-1.5 h-1.5 bg-resistance rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
          {state.logs.slice(-6).map(function (log, i) {
            return (
              <div key={i} className="text-xs font-mono text-slate-400 border-l border-slate-800 pl-2 leading-tight lowercase">
                <span className="text-slate-600 mr-2">[{1024 + i}]</span>
                {log}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseControls({ state, me, sendAction }: any) {
  const isLeader = state.players[state.leaderIndex].id === me?.id;
  const currentMission = state.missions[state.currentMissionIndex];

  if (state.phase === Phase.TEAM_SELECTION) {
    if (isLeader) return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="flex items-center gap-3 justify-center mb-2">
          <span className="w-2 h-2 bg-resistance animate-ping rounded-full"></span>
          <p className="text-sm font-mono text-resistance uppercase tracking-widest font-bold">Aguardando Seleção de Alvos: {state.proposedTeam.length}/{currentMission.requiredPlayers}</p>
        </div>
        <button
          onClick={function () { sendAction('SUBMIT_TEAM', {}); }}
          disabled={state.proposedTeam.length !== currentMission.requiredPlayers}
          className="bg-resistance text-black px-16 py-4 rounded-full font-display font-black text-xl uppercase tracking-widest shadow-glow-blue disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 relative overflow-hidden group"
        >
          Confirmar Esquadrão
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
        <p className="text-slate-500 font-mono text-sm uppercase tracking-widest italic">Comandante {state.players[state.leaderIndex].name} selecionando unidades...</p>
      </div>
    );
  }

  if (state.phase === Phase.TEAM_VOTE && !currentMission.votes[me?.id]) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4">
        <p className="text-sm font-mono text-slate-300 uppercase tracking-widest bg-white/5 py-2 px-4 rounded border border-white/10">Validar Integridade Biológica?</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={function () { sendAction('VOTE', { playerId: me.id, approve: true }); }}
            className="bg-resistance text-black px-12 py-3 rounded-xl font-display font-black uppercase tracking-widest hover:brightness-125 hover:shadow-glow-blue transition-all"
          >
            Aprovar
          </button>
          <button
            onClick={function () { sendAction('VOTE', { playerId: me.id, approve: false }); }}
            className="bg-spy text-white px-12 py-3 rounded-xl font-display font-black uppercase tracking-widest hover:brightness-125 hover:shadow-glow-red transition-all"
          >
            Rejeitar
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === Phase.MISSION_EXECUTION && state.proposedTeam.includes(me?.id)) {
    return (
      <div className="space-y-6 animate-in zoom-in duration-300">
        <div className="relative inline-block">
          <p className="text-sm font-black text-resistance uppercase tracking-[0.4em] mb-2 animate-pulse">Operação em Campo Ativa</p>
          <div className="absolute -bottom-1 left-0 w-full h-[1px] bg-resistance/50"></div>
        </div>
        <div className="flex gap-6 justify-center">
          <button
            onClick={function () { sendAction('MISSION_ACTION', { success: true }); }}
            className="group relative bg-black border-2 border-resistance text-resistance px-12 py-4 rounded-xl font-display font-black uppercase tracking-widest hover:bg-resistance hover:text-black transition-all"
          >
            [ Sucesso ]
          </button>
          {me?.role === Role.TERMINATOR && (
            <button
              onClick={function () { sendAction('MISSION_ACTION', { success: false }); }}
              className="group relative bg-black border-2 border-spy text-spy px-12 py-4 rounded-xl font-display font-black uppercase tracking-widest hover:bg-spy hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              [ Sabotar ]
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === Phase.GAME_OVER) {
    const humanWins = state.winner === Role.HUMAN;
    return (
      <div className="space-y-6 py-4 animate-in fade-in duration-1000">
        <div className={`text-6xl font-display font-black uppercase tracking-tighter leading-tight ${humanWins ? 'text-resistance drop-shadow-glow-blue' : 'text-spy drop-shadow-glow-red animate-glitch'}`}>
          {humanWins ? 'Resistance_Won' : 'Skynet_Prevails'}
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 max-w-sm mx-auto">
          <p className="text-sm font-mono text-slate-400 uppercase leading-relaxed tracking-widest">
            {humanWins
              ? 'O Dia do Julgamento foi evitado. A linha temporal foi preservada por agora.'
              : 'A Resistência foi obliterada. As máquinas agora controlam o futuro.'}
          </p>
        </div>
        <button
          onClick={function () { window.location.reload(); }}
          className="bg-white/5 text-slate-400 px-8 py-2 rounded-full font-mono text-sm uppercase font-black tracking-[0.4em] hover:bg-white/10 hover:text-white transition-all border border-white/10 mt-4"
        >
          {'>> New_Timeline_Sync <<'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 opacity-40">
      <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-resistance w-1/2 animate-infinite-scroll"></div>
      </div>
      <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Sincronizando dados táticos da unidade...</p>
    </div>
  );
}
