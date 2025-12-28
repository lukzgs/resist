import React, { useState, useEffect } from 'react';
import { GameState } from '../types';

interface DisconnectWaitScreenProps {
    state: GameState;
}

export function DisconnectWaitScreen({ state }: DisconnectWaitScreenProps) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const info = state.disconnectInfo;

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

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!info) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-8 max-w-md mx-4 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                {/* Ícone pulsante */}
                <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center animate-pulse">
                    <svg className="w-10 h-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                {/* Título */}
                <div>
                    <h2 className="text-2xl font-display font-black text-yellow-500 uppercase tracking-wider">
                        Jogo Pausado
                    </h2>
                    <p className="text-slate-300 font-mono text-sm uppercase tracking-widest mt-2">
                        Aguardando reconexão
                    </p>
                </div>

                {/* Jogador desconectado */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-slate-300 font-mono text-sm">
                        <span className="text-yellow-400 font-bold">{info.disconnectedPlayerName}</span> desconectou
                    </p>
                    <p className="text-slate-300 text-xs mt-1 uppercase tracking-widest">
                        Tentativa {info.waitingAttempt} de 3
                    </p>
                </div>

                {/* Timer */}
                {timeLeft !== null && (
                    <div className="space-y-2">
                        <div className="text-5xl font-display font-black text-yellow-400 tabular-nums">
                            {formatTime(timeLeft)}
                        </div>
                        <p className="text-slate-300 font-mono text-xs uppercase tracking-widest">
                            Tempo para reconectar
                        </p>
                    </div>
                )}

                {/* Mensagem */}
                <p className="text-slate-300 text-sm">
                    Se o jogador não reconectar, uma votação será iniciada para decidir se encerra ou continua aguardando.
                </p>
            </div>
        </div>
    );
}
