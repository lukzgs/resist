import React from 'react';
import { IoWarningOutline, IoSyncOutline } from 'react-icons/io5';
import { useTranslation } from '../i18n';

interface Props {
    roomCode: string;
    playerName: string;
    onReconnect: () => void;
    onBackToMenu: () => void;
    isConnecting: boolean;
    error: string | null;
}

export default function ReconnectView({
    roomCode,
    playerName,
    onReconnect,
    onBackToMenu,
    isConnecting,
    error,
}: Props) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-scan opacity-5 pointer-events-none"></div>

            <div className="z-10 text-center space-y-8 max-w-lg view-enter">
                <div className="space-y-2 animate-float">
                    <h1 className="text-6xl font-display font-black tracking-tighter text-white drop-shadow-glow-blue italic">SKYNET</h1>
                    <p className="text-sm font-mono text-resistance tracking-[0.5em] uppercase font-bold">{t('home.subtitle')}</p>
                </div>

                <div className="p-8 bg-black/40 border-2 border-white/20 rounded-3xl space-y-6 card-animate">
                    {error ? (
                        <>
                            <div className="space-y-4">
                                <div className="text-6xl">❌</div>
                                <h2 className="text-2xl font-display font-bold text-white uppercase">{t('reconnect.failed')}</h2>
                                <p className="text-slate-300 font-mono text-sm">{error}</p>
                            </div>

                            <button
                                onClick={onBackToMenu}
                                className="w-full p-4 bg-slate-800 border-2 border-white/30 rounded-xl hover:border-white/50 hover:bg-slate-700 transition-all font-display font-bold text-white uppercase tracking-wide"
                            >
                                {t('reconnect.back')}
                            </button>
                        </>
                    ) : isConnecting ? (
                        <>
                            <div className="space-y-4">
                                <div className="animate-spin flex justify-center"><IoSyncOutline size={64} color="#eab308" /></div>
                                <h2 className="text-2xl font-display font-bold text-white uppercase">{t('reconnect.connecting')}</h2>
                                <p className="text-slate-300 font-mono text-sm">{t('reconnect.room')}: {roomCode}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-4 flex flex-col items-center">
                                <IoWarningOutline size={64} color="#eab308" />
                                <h2 className="text-2xl font-display font-bold text-white uppercase">{t('reconnect.title')}</h2>
                                <p className="text-slate-300 font-mono text-sm">{t('reconnect.desc')}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                                    <p className="text-xs text-slate-300 uppercase tracking-wider font-mono mb-1">{t('reconnect.room')}</p>
                                    <p className="text-xl font-display font-bold text-resistance">{roomCode}</p>
                                </div>
                                <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                                    <p className="text-xs text-slate-300 uppercase tracking-wider font-mono mb-1">{t('reconnect.player')}</p>
                                    <p className="text-xl font-display font-bold text-white truncate">{playerName}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={onReconnect}
                                    className="w-full p-4 bg-resistance/20 border-2 border-resistance rounded-xl hover:bg-resistance/30 transition-all font-display font-bold text-resistance uppercase tracking-wide"
                                >
                                    {t('reconnect.button')}
                                </button>

                                <button
                                    onClick={onBackToMenu}
                                    className="w-full p-4 bg-transparent border-2 border-white/20 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all font-display font-bold text-slate-300 uppercase tracking-wide"
                                >
                                    {t('reconnect.back')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

