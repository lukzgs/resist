import React, { useState } from 'react';
import { IoCopyOutline, IoCheckmarkOutline } from 'react-icons/io5';
import { GameState, TimerConfig } from '../types';
import { GAME_RULES } from '../constants';
import { useTranslation } from '../i18n';

interface Props {
    state: GameState;
    isHost: boolean;
    myPlayerId?: string;
    onRemove: (playerId: string) => void;
    onStart: (timerConfig: TimerConfig) => void;
    onToggleAnonymousVotes: (enabled: boolean) => void;
    onToggleShowRejectionCount: (enabled: boolean) => void;
    onTogglePublic: (enabled: boolean) => void;
    onBack: () => void;
}

export default function LobbyView({ state, isHost, myPlayerId, onRemove, onStart, onToggleAnonymousVotes, onToggleShowRejectionCount, onTogglePublic, onBack }: Props) {
    const { t } = useTranslation();
    const pCount = state.players.length;
    const canStart = pCount >= 5 && pCount <= 10;
    const [linkCopied, setLinkCopied] = useState(false);

    // Estado LOCAL para configuração de timers - inicializa com valores do servidor (persistidos entre partidas)
    const [timerConfig, setTimerConfig] = useState<TimerConfig>(() => ({
        enabled: state.timerConfig?.enabled ?? false,
        teamSelectionSeconds: state.timerConfig?.teamSelectionSeconds ?? 120,
        teamVoteSeconds: state.timerConfig?.teamVoteSeconds ?? 45,
        missionVoteSeconds: state.timerConfig?.missionVoteSeconds ?? 30,
    }));

    const copyLink = async () => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/?room=${state.roomCode}`;
        try {
            await navigator.clipboard.writeText(link);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Error copying link:', err);
        }
    };

    return (
        <div className="min-h-screen overflow-y-auto pb-8 flex items-center justify-center">
            <div className="flex flex-col items-center p-6 max-w-7xl mx-auto w-full view-enter">
                <div className="w-full grid lg:grid-cols-12 gap-8 items-stretch">

                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-black/60 p-8 rounded-3xl border border-white/10 backdrop-blur-xl relative overflow-hidden flex-1 card-animate">
                            <div className="absolute top-0 right-0 p-4 font-mono text-xs text-resistance/20">SKYNET_INT_04</div>
                            <span className="text-sm font-mono text-resistance tracking-widest block mb-4 uppercase font-bold border-b border-resistance/20 pb-2">{t('lobby.code')}</span>
                            <div className="text-6xl font-display font-black text-white tracking-widest mb-2 drop-shadow-glow-blue">{state.roomCode.replace(/0/g, 'Ø')}</div>
                            <button
                                onClick={copyLink}
                                className={`btn-animate w-full py-2 px-4 rounded-xl border font-mono text-sm uppercase tracking-widest transition-all mb-4 flex items-center justify-center gap-2 ${linkCopied
                                    ? 'border-green-500/50 bg-green-500/20 text-green-400'
                                    : 'border-resistance/30 bg-resistance/10 text-resistance hover:bg-resistance/20 hover:border-resistance/50'
                                    }`}
                            >
                                {linkCopied ? <><IoCheckmarkOutline /> {t('lobby.copied')}</> : <><IoCopyOutline /> {t('lobby.copy')}</>}
                            </button>
                            <button
                                onClick={onBack}
                                className="btn-animate w-full py-3 px-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 font-mono text-sm uppercase tracking-widest transition-all mb-6 flex items-center justify-center gap-2"
                            >
                                ← {t('lobby.leave')}
                            </button>

                            <div className="space-y-6 font-mono">
                                <div>
                                    <div className="flex justify-between text-sm text-slate-300 uppercase mb-2">{t('lobby.players')}</div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-resistance transition-all duration-1000" style={{ width: `${(pCount / 10) * 100}%` }}></div>
                                    </div>
                                    <div className="mt-1 text-right text-sm text-resistance">{pCount}/10 {t('lobby.connected')}</div>
                                </div>

                                <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-300">{t('lobby.terminators')}:</span>
                                        <span className="text-spy font-bold">{canStart ? GAME_RULES[pCount].spyCount : '?'} {t('lobby.units')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-300">{t('lobby.bunker')}:</span>
                                        <span className="text-green-500 font-bold">{t('lobby.stable')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isHost && (
                            <div className="bg-black/40 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                                <span className="text-sm font-mono text-resistance tracking-widest block mb-4 uppercase font-bold border-b border-resistance/20 pb-2">{t('lobby.settings')}</span>

                                <label className="flex items-center justify-between cursor-pointer group mb-4">
                                    <span className="text-sm font-mono text-slate-300 uppercase tracking-widest">{t('lobby.show_votes')}</span>
                                    <div
                                        onClick={() => onToggleAnonymousVotes(!state.anonymousVotes)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${!state.anonymousVotes ? 'bg-resistance' : 'bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${!state.anonymousVotes ? 'left-7' : 'left-1'}`}></div>
                                    </div>
                                </label>

                                <label className="flex items-center justify-between cursor-pointer group">
                                    <span className="text-sm font-mono text-slate-300 uppercase tracking-widest">{t('lobby.show_rejections')}</span>
                                    <div
                                        onClick={() => onToggleShowRejectionCount(!state.showRejectionCount)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${state.showRejectionCount ? 'bg-resistance' : 'bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${state.showRejectionCount ? 'left-7' : 'left-1'}`}></div>
                                    </div>
                                </label>

                                <div className="border-t border-white/10 my-4"></div>

                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div>
                                        <span className="text-sm font-mono text-slate-300 uppercase tracking-widest">{t('lobby.private_room') || 'SALA PRIVADA'}</span>
                                        <p className="text-xs font-mono text-slate-500 mt-1">{t('lobby.private_room.desc') || 'Oculta da busca de salas'}</p>
                                    </div>
                                    <div
                                        onClick={() => onTogglePublic(!state.isPublic)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${!state.isPublic ? 'bg-red-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${!state.isPublic ? 'left-7' : 'left-1'}`}></div>
                                    </div>
                                </label>

                                <div className="border-t border-white/10 my-4"></div>

                                {/* Timer Settings - Premium Design */}
                                <div className="space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-sm font-mono text-slate-300 uppercase tracking-widest">{t('timer.enable')}</span>
                                        <div
                                            onClick={() => setTimerConfig({ ...timerConfig, enabled: !timerConfig.enabled })}
                                            className={`relative w-12 h-6 rounded-full transition-all ${timerConfig.enabled ? 'bg-resistance shadow-[0_0_15px_rgba(14,165,233,0.5)]' : 'bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${timerConfig.enabled ? 'left-7' : 'left-1'}`}></div>
                                        </div>
                                    </label>

                                    {timerConfig.enabled && (
                                        <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 mt-4">
                                            {/* Team Selection Timer */}
                                            <div className="group p-4 bg-black/60 rounded-2xl border border-white/5 hover:border-resistance/20 transition-all relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-resistance/30 to-transparent"></div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-resistance/50"></div>
                                                        <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{t('timer.team_selection')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setTimerConfig({ ...timerConfig, teamSelectionSeconds: Math.max(30, timerConfig.teamSelectionSeconds - 5) })}
                                                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-resistance/20 text-resistance/60 hover:text-resistance transition-colors"
                                                        >
                                                            <span className="text-sm font-bold">−</span>
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="30"
                                                            max="120"
                                                            value={timerConfig.teamSelectionSeconds}
                                                            onChange={(e) => {
                                                                const val = Math.max(30, Math.min(120, Number(e.target.value) || 30));
                                                                setTimerConfig({ ...timerConfig, teamSelectionSeconds: val });
                                                            }}
                                                            className="w-12 bg-black/60 text-lg font-display font-black text-resistance text-center py-1 rounded-lg border border-resistance/30 outline-none appearance-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                                                        />
                                                        <span className="text-xs font-mono text-resistance/60">s</span>
                                                        <button
                                                            onClick={() => setTimerConfig({ ...timerConfig, teamSelectionSeconds: Math.min(120, timerConfig.teamSelectionSeconds + 5) })}
                                                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-resistance/20 text-resistance/60 hover:text-resistance transition-colors"
                                                        >
                                                            <span className="text-sm font-bold">+</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="30"
                                                    max="120"
                                                    step="5"
                                                    value={timerConfig.teamSelectionSeconds}
                                                    onChange={(e) => setTimerConfig({ ...timerConfig, teamSelectionSeconds: Number(e.target.value) })}
                                                    className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer
                                                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-resistance 
                                                        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(14,165,233,0.6)] [&::-webkit-slider-thumb]:cursor-pointer
                                                        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                                                        [&::-moz-range-thumb]:bg-resistance [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, rgb(14,165,233) 0%, rgb(14,165,233) ${((timerConfig.teamSelectionSeconds - 30) / 90) * 100}%, rgb(30,41,59) ${((timerConfig.teamSelectionSeconds - 30) / 90) * 100}%, rgb(30,41,59) 100%)`
                                                    }}
                                                />
                                                <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-500">
                                                    <span>30s</span>
                                                    <span>120s</span>
                                                </div>
                                            </div>

                                            {/* Team Vote Timer */}
                                            <div className="group p-4 bg-black/60 rounded-2xl border border-white/5 hover:border-yellow-500/20 transition-all relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent"></div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                                                        <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{t('timer.team_vote')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setTimerConfig({ ...timerConfig, teamVoteSeconds: Math.max(30, timerConfig.teamVoteSeconds - 5) })}
                                                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-yellow-500/20 text-yellow-500/60 hover:text-yellow-400 transition-colors"
                                                        >
                                                            <span className="text-sm font-bold">−</span>
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="30"
                                                            max="120"
                                                            value={timerConfig.teamVoteSeconds}
                                                            onChange={(e) => {
                                                                const val = Math.max(30, Math.min(120, Number(e.target.value) || 30));
                                                                setTimerConfig({ ...timerConfig, teamVoteSeconds: val });
                                                            }}
                                                            className="w-12 bg-black/60 text-lg font-display font-black text-yellow-400 text-center py-1 rounded-lg border border-yellow-500/30 outline-none appearance-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                                                        />
                                                        <span className="text-xs font-mono text-yellow-500/60">s</span>
                                                        <button
                                                            onClick={() => setTimerConfig({ ...timerConfig, teamVoteSeconds: Math.min(120, timerConfig.teamVoteSeconds + 5) })}
                                                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-yellow-500/20 text-yellow-500/60 hover:text-yellow-400 transition-colors"
                                                        >
                                                            <span className="text-sm font-bold">+</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="30"
                                                    max="120"
                                                    step="5"
                                                    value={timerConfig.teamVoteSeconds}
                                                    onChange={(e) => setTimerConfig({ ...timerConfig, teamVoteSeconds: Number(e.target.value) })}
                                                    className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer
                                                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-400 
                                                        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(250,204,21,0.6)] [&::-webkit-slider-thumb]:cursor-pointer
                                                        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                                                        [&::-moz-range-thumb]:bg-yellow-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, rgb(250,204,21) 0%, rgb(250,204,21) ${((timerConfig.teamVoteSeconds - 30) / 90) * 100}%, rgb(30,41,59) ${((timerConfig.teamVoteSeconds - 30) / 90) * 100}%, rgb(30,41,59) 100%)`
                                                    }}
                                                />
                                                <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-500">
                                                    <span>30s</span>
                                                    <span>120s</span>
                                                </div>
                                            </div>

                                            {/* Mission Vote Timer */}
                                            <div className="group p-4 bg-black/60 rounded-2xl border border-white/5 hover:border-spy/20 transition-all relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-spy/30 to-transparent"></div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-spy/50"></div>
                                                        <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{t('timer.mission_vote')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setTimerConfig({ ...timerConfig, missionVoteSeconds: Math.max(5, timerConfig.missionVoteSeconds - 5) })}
                                                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-spy/20 text-spy/60 hover:text-spy transition-colors"
                                                        >
                                                            <span className="text-sm font-bold">−</span>
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="5"
                                                            max="120"
                                                            value={timerConfig.missionVoteSeconds}
                                                            onChange={(e) => {
                                                                const val = Math.max(5, Math.min(120, Number(e.target.value) || 5));
                                                                setTimerConfig({ ...timerConfig, missionVoteSeconds: val });
                                                            }}
                                                            className="w-12 bg-black/60 text-lg font-display font-black text-spy text-center py-1 rounded-lg border border-spy/30 outline-none appearance-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
                                                        />
                                                        <span className="text-xs font-mono text-spy/60">s</span>
                                                        <button
                                                            onClick={() => setTimerConfig({ ...timerConfig, missionVoteSeconds: Math.min(120, timerConfig.missionVoteSeconds + 5) })}
                                                            className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 hover:bg-spy/20 text-spy/60 hover:text-spy transition-colors"
                                                        >
                                                            <span className="text-sm font-bold">+</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="120"
                                                    step="5"
                                                    value={timerConfig.missionVoteSeconds}
                                                    onChange={(e) => setTimerConfig({ ...timerConfig, missionVoteSeconds: Number(e.target.value) })}
                                                    className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer
                                                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                                                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-spy 
                                                        [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(239,68,68,0.6)] [&::-webkit-slider-thumb]:cursor-pointer
                                                        [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full 
                                                        [&::-moz-range-thumb]:bg-spy [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, rgb(239,68,68) 0%, rgb(239,68,68) ${((timerConfig.missionVoteSeconds - 5) / 115) * 100}%, rgb(30,41,59) ${((timerConfig.missionVoteSeconds - 5) / 115) * 100}%, rgb(30,41,59) 100%)`
                                                    }}
                                                />
                                                <div className="flex justify-between mt-2 text-[10px] font-mono text-slate-500">
                                                    <span>5s</span>
                                                    <span>120s</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <div className="bg-slate-900/20 p-8 rounded-3xl border border-white/5 flex-1 relative min-h-[400px]">
                            <div className="absolute top-2 right-4 flex gap-1">
                                <div className="w-1 h-1 bg-resistance rounded-full animate-ping"></div>
                                <span className="text-xs font-mono text-resistance/60">LIVE FEED</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {state.players.map((p) => (
                                    <div key={p.id} className={`group relative h-16 rounded-2xl border ${p.disconnected ? 'border-red-500/30 bg-red-900/10 opacity-50' : 'border-white/10 bg-black/40'} flex items-center px-5 transition-all hover:border-resistance/40 hover:bg-black/60`}>
                                        {p.isHost && (
                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black text-[10px] font-display font-bold px-3 py-0.5 rounded-full z-20 shadow-lg tracking-wider border border-yellow-300/50">
                                                {t('lobby.host')}
                                            </div>
                                        )}
                                        <div className={`w-2 h-2 ${p.disconnected ? 'bg-red-500 animate-pulse' : 'bg-green-500'} rounded-full shrink-0 mr-4`}></div>
                                        <div className="overflow-hidden flex-1">
                                            <div className="text-lg font-display font-bold text-white uppercase tracking-wide truncate">
                                                {p.name}
                                            </div>
                                            <div className="text-xs font-mono text-slate-300 uppercase tracking-widest">
                                                {p.disconnected ? t('lobby.offline') : t('lobby.online')}
                                            </div>
                                        </div>
                                        {isHost && !p.isHost && p.id !== myPlayerId && (
                                            <button
                                                onClick={() => onRemove(p.id)}
                                                className="opacity-0 group-hover:opacity-100 ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all"
                                                title="Remover jogador"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isHost && (
                            <button
                                onClick={() => onStart(timerConfig)}
                                disabled={!canStart}
                                className={`btn-animate w-full py-6 rounded-2xl font-display font-black text-3xl uppercase tracking-[0.2em] transition-all relative overflow-hidden group ${canStart
                                    ? 'bg-spy text-white shadow-glow-red hover:scale-[1.01]'
                                    : 'bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed waiting-pulse'
                                    }`}
                            >
                                {canStart ? t('lobby.start') : `${t('lobby.waiting')} (${pCount}/5)`}
                            </button>
                        )}

                        {!isHost && (
                            <div className="w-full py-6 rounded-2xl bg-slate-800/50 text-center">
                                <p className="font-mono text-sm text-slate-300 uppercase tracking-widest">
                                    {t('lobby.waiting')}...
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

