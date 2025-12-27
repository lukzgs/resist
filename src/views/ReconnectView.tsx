import React, { useState } from 'react';

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
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-scan opacity-5 pointer-events-none"></div>

            <div className="z-10 text-center space-y-8 max-w-lg">
                <div className="space-y-2 animate-float">
                    <h1 className="text-6xl font-display font-black tracking-tighter text-white drop-shadow-glow-blue italic">SKYNET</h1>
                    <p className="text-sm font-mono text-resistance tracking-[0.5em] uppercase font-bold">Reconnect Protocol</p>
                </div>

                {/* Card de reconexão */}
                <div className="p-8 bg-black/40 border-2 border-white/20 rounded-3xl space-y-6">
                    {error ? (
                        <>
                            {/* Estado de erro */}
                            <div className="space-y-4">
                                <div className="text-6xl">❌</div>
                                <h2 className="text-2xl font-display font-bold text-white uppercase">Conexão Falhou</h2>
                                <p className="text-slate-400 font-mono text-sm">{error}</p>
                            </div>

                            <button
                                onClick={onBackToMenu}
                                className="w-full p-4 bg-slate-800 border-2 border-white/30 rounded-xl hover:border-white/50 hover:bg-slate-700 transition-all font-display font-bold text-white uppercase tracking-wide"
                            >
                                Voltar ao Menu
                            </button>
                        </>
                    ) : isConnecting ? (
                        <>
                            {/* Estado de conexão */}
                            <div className="space-y-4">
                                <div className="text-6xl animate-spin">⚡</div>
                                <h2 className="text-2xl font-display font-bold text-white uppercase">Conectando...</h2>
                                <p className="text-slate-400 font-mono text-sm">Estabelecendo uplink com sala {roomCode}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Estado inicial */}
                            <div className="space-y-4">
                                <div className="text-6xl">🔌</div>
                                <h2 className="text-2xl font-display font-bold text-white uppercase">Sessão Detectada</h2>
                                <p className="text-slate-400 font-mono text-sm">Uma sessão anterior foi encontrada</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-mono mb-1">Sala</p>
                                    <p className="text-xl font-display font-bold text-resistance">{roomCode}</p>
                                </div>
                                <div className="p-4 bg-black/30 rounded-xl border border-white/10">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-mono mb-1">Jogador</p>
                                    <p className="text-xl font-display font-bold text-white truncate">{playerName}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={onReconnect}
                                    className="w-full p-4 bg-resistance/20 border-2 border-resistance rounded-xl hover:bg-resistance/30 transition-all font-display font-bold text-resistance uppercase tracking-wide"
                                >
                                    Reconectar
                                </button>

                                <button
                                    onClick={onBackToMenu}
                                    className="w-full p-4 bg-transparent border-2 border-white/20 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all font-display font-bold text-slate-400 uppercase tracking-wide"
                                >
                                    Voltar ao Menu
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="pt-4">
                    <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">
                        {isConnecting ? 'Uplink em progresso...' : 'Pronto para reconectar'}
                    </p>
                </div>
            </div>
        </div>
    );
}
