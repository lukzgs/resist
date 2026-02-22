
import React, { useState } from 'react';
import { GameState, Phase, Role, Player } from '../types';
import { GAME_RULES_BY_COUNT } from '../../shared/constants';
import { getLeader, getCurrentMission } from '../../shared/stateHelpers';
import PlayerCard from '../components/PlayerCard';
import MissionTracker from '../components/MissionTracker';
import VoteTracker from '../components/VoteTracker';
import DraggableLog from '../components/DraggableLog';
import GameHeader from '../components/GameHeader';
import PhaseControls from '../components/PhaseControls';
import { DisconnectWaitScreen } from '../components/DisconnectWaitScreen';
import { DisconnectVoteScreen } from '../components/DisconnectVoteScreen';
import { TimerCircle } from '../components/TimerCircle';
import { useTranslation } from '../i18n';
import { useVoteReveal } from '../hooks/useVoteReveal';

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
  const leader = getLeader(state);
  const isLeader = leader ? leader.name === playerName : false;

  const currentMission = getCurrentMission(state);
  const { revealVotes, lastVoteResult } = useVoteReveal(state);

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

        <GameHeader roomCode={state.roomCode} players={state.players} />

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
              <div className="flex flex-wrap justify-center gap-4 md:gap-6 max-w-5xl mx-auto px-4">
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
                      className={`
                        w-[calc(50%-8px)] sm:w-[calc(33.333%-16px)] md:w-[calc(25%-18px)] lg:w-[180px]
                        transition-all duration-300 
                        ${isLeader && state.phase === Phase.TEAM_SELECTION ? 'cursor-crosshair' : ''}
                      `}
                    >
                      <PlayerCard
                        player={p}
                        isLeader={originalIndex === state.leaderIndex}
                        isInTeam={state.proposedTeam.includes(p.id)}
                        showIdentity={showId || p.name === playerName || (me?.role === Role.TERMINATOR && p.role === Role.TERMINATOR)}
                        vote={state.phase === Phase.TEAM_VOTE && !state.anonymousVotes && revealVotes ? currentMission.votes[p.id] : undefined}
                        hasVoted={(state.phase === Phase.TEAM_VOTE && currentMission.votes[p.id] !== undefined && (!revealVotes || state.anonymousVotes)) ||
                          (state.phase === Phase.MISSION_EXECUTION && state.proposedTeam.includes(p.id) && currentMission.missionOutcomes[state.proposedTeam.indexOf(p.id)] !== undefined)}
                        isDisconnected={p.disconnected}
                        isMe={p.name === playerName}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="max-w-4xl mx-auto text-center p-10 bg-black/80 rounded-[40px] border-2 border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-resistance/30 to-transparent"></div>

            <div className="mb-8 phase-content">
              <span className="text-sm font-mono text-slate-300 uppercase tracking-[0.5em] block mb-2">Protocol_Status</span>
              <h3 className="text-3xl font-display font-black text-white uppercase tracking-[0.1em] drop-shadow-glow-blue">
                {state.phase.replace(/_/g, ' ')}
              </h3>
            </div>

            {/* Timer integrado - aparece acima dos controles quando ativo */}
            {state.timerConfig.enabled && state.currentTimerEndsAt && (
              <div className="mb-6">
                <TimerCircle
                  endsAt={state.currentTimerEndsAt}
                />
              </div>
            )}

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
              <VoteTracker failedVotes={state.failedVoteCount} maxVotes={GAME_RULES_BY_COUNT[state.players.filter(p => !p.isSpectator).length]?.maxRejections || 5} />
            </div>
          </div>
        </main>
        <DraggableLog logs={state.logs} />
      </div>
    </>
  );
}

