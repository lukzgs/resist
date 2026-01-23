import React, { useState, useEffect } from 'react';
import { GameState, Player } from '../types';

interface DisconnectVoteScreenProps {
    state: GameState;
    me: Player | undefined;
    sendAction: (action: string, payload: any) => void;
}

export function DisconnectVoteScreen({ state, me, sendAction }: DisconnectVoteScreenProps) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [hasVoted, setHasVoted] = useState(false);
    const info = state.disconnectInfo;
    const votes = state.disconnectVotes || {};

    useEffect(() => {
        if (!info?.expiresAt) return;

        const updateTime = () => {
            const remaining = Math.max(0, info.expiresAt - Date.now());
            setTimeLeft(remaining);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [info?.expiresAt]);

    // Verifica se já votou
    useEffect(() => {
        if (me && votes[me.id] !== undefined) {
            setHasVoted(true);
        }
    }, [me, votes]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        return `${totalSeconds}s`;
    };

    const handleVote = (endGame: boolean) => {
        if (hasVoted || !me) return;
        setHasVoted(true);
        sendAction('DISCONNECT_VOTE', { endGame });
    };

    if (!info) return null;

    const activePlayers = state.players.filter(p => !p.disconnected && !p.isSpectator);
    const voteCount = Object.keys(votes).length;
    const endGameVotes = Object.values(votes).filter(v => v === true).length;
    const waitVotes = voteCount - endGameVotes;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-8 max-w-md mx-4 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                {/* Ícone */}
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                {/* Título */}
                <div>
                    <h2 className="text-2xl font-display font-black text-red-500 uppercase tracking-wider">
                        Votação
                    </h2>
                    <p className="text-slate-300 font-mono text-sm uppercase tracking-widest mt-2">
                        {info.disconnectedPlayerName} não reconectou
                    </p>
                </div>

                {/* Timer */}
                {timeLeft !== null && timeLeft > 0 && (
                    <div className="text-4xl font-display font-black text-red-400 tabular-nums animate-pulse">
                        {formatTime(timeLeft)}
                    </div>
                )}

                {/* Status de votos */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-slate-300 font-mono text-sm">
                        Votos: <span className="text-white font-bold">{voteCount}</span> / {activePlayers.length}
                    </p>
                    <div className="flex justify-center gap-6 mt-2 text-xs uppercase tracking-widest">
                        <span className="text-red-400">Encerrar: {endGameVotes}</span>
                        <span className="text-green-400">Aguardar: {waitVotes}</span>
                    </div>
                </div>

                {/* Botões de voto */}
                {!hasVoted && me && !me.disconnected && !me.isSpectator ? (
                    <div className="space-y-3">
                        <p className="text-slate-300 text-sm mb-4">
                            O que deseja fazer?
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => handleVote(true)}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-display font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                            >
                                Encerrar Partida
                            </button>
                            <button
                                onClick={() => handleVote(false)}
                                className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-display font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                            >
                                Aguardar Mais
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-300 font-mono text-sm uppercase tracking-widest">
                        {hasVoted ? '✓ Voto registrado' : 'Aguardando votação...'}
                    </div>
                )}

                {/* Info de tentativa */}
                <p className="text-slate-300 text-xs uppercase tracking-widest">
                    Tentativa {info.waitingAttempt} de 3 • Não votar = aguardar
                </p>
            </div>
        </div>
    );
}
