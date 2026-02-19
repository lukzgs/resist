import React, { useState } from 'react';
import { GameState, Phase, Role, Player } from '../types';
import { getLeader, getCurrentMission } from '../../shared/stateHelpers';
import { useTranslation } from '../i18n';
import GameOverScreen from './GameOverScreen';

interface PhaseControlsProps {
    state: GameState;
    me: Player | undefined;
    sendAction: (action: string, payload: any) => void;
    isHost: boolean;
}

export default function PhaseControls({ state, me, sendAction, isHost }: PhaseControlsProps) {
    const { t } = useTranslation();
    const [pendingVote, setPendingVote] = useState<boolean | null>(null);
    const [pendingMissionAction, setPendingMissionAction] = useState<boolean>(false);

    const currentMission = getCurrentMission(state);

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

    // Espectadores não podem interagir - apenas observam
    if (me.isSpectator) {
        return (
            <div className="flex flex-col items-center gap-4 opacity-60">
                <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-700 rounded-full" />
                    <div className="w-2 h-2 bg-slate-700 rounded-full" />
                    <div className="w-2 h-2 bg-slate-700 rounded-full" />
                </div>
                <p className="text-slate-300 font-mono text-sm uppercase tracking-widest italic">
                    {t('game.spectating')}
                </p>
            </div>
        );
    }

    // Após o guard, me é garantidamente Player ativo
    const leader = getLeader(state);
    const isLeader = leader ? leader.id === me.id : false;

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
            // Conta quantos votaram (apenas jogadores ativos, não espectadores)
            const totalVotes = Object.keys(currentMission.votes).length;
            const activePlayersCount = state.players.filter(p => !p.isSpectator).length;
            const remaining = activePlayersCount - totalVotes;

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
                <div className="flex flex-col gap-4 items-center">
                    <button
                        onClick={function () {
                            setPendingVote(true);
                            sendAction('VOTE', { playerId: me.id, approve: true });
                        }}
                        className="w-full bg-resistance text-black px-12 py-3 rounded-xl font-display font-black uppercase tracking-widest hover:brightness-125 hover:shadow-glow-blue transition-all hover:scale-105 active:scale-95 relative overflow-hidden group"
                    >
                        {t('game.approve')}
                        <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:left-full transition-all duration-1000"></div>
                    </button>
                    <button
                        onClick={function () {
                            setPendingVote(false);
                            sendAction('VOTE', { playerId: me.id, approve: false });
                        }}
                        className="w-full bg-spy text-white px-12 py-3 rounded-xl font-display font-black uppercase tracking-widest hover:brightness-125 hover:shadow-glow-red transition-all hover:scale-105 active:scale-95 relative overflow-hidden group"
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
                <div className="flex flex-col gap-4 items-center">
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
