import React, { useState } from 'react';
import { GameState, Role } from '../types';
import { useTranslation } from '../i18n';

interface GameOverScreenProps {
    state: GameState;
    isHost: boolean;
    sendAction: (action: string, payload: any) => void;
}

export default function GameOverScreen({ state, isHost, sendAction }: GameOverScreenProps) {
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
