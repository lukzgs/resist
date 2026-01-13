import React, { useEffect, useState, useCallback } from 'react';
import { getPublicRooms, PublicRoom } from '../hooks/usePartySocket';
import { useTranslation } from '../i18n';

interface Props {
    onJoinRoom: (code: string) => void;
    onBack: () => void;
}

export default function BrowseRoomsView({ onJoinRoom, onBack }: Props) {
    const { t } = useTranslation();
    const [rooms, setRooms] = useState<PublicRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    const fetchRooms = useCallback(async () => {
        try {
            const publicRooms = await getPublicRooms();
            setRooms(publicRooms);
            setLastUpdate(Date.now());
        } catch (e) {
            console.error('Erro ao buscar salas:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Busca inicial e refresh a cada 5s
    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, 5000);
        return () => clearInterval(interval);
    }, [fetchRooms]);

    // Formata tempo restante
    const formatTimeRemaining = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-scan opacity-5 pointer-events-none"></div>

            <div className="z-10 w-full max-w-2xl space-y-8 view-enter">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-display font-black tracking-tighter text-white uppercase">
                        {t('browse.title') || 'SALAS PÚBLICAS'}
                    </h1>
                    <p className="text-sm font-mono text-slate-400 uppercase tracking-widest">
                        {t('browse.subtitle') || 'Encontre uma partida para entrar'}
                    </p>
                </div>

                {/* Lista de Salas */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block w-8 h-8 border-2 border-resistance border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-sm font-mono text-slate-400 uppercase">
                                {t('browse.loading') || 'Buscando salas...'}
                            </p>
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="text-center py-12 bg-black/30 rounded-2xl border border-white/10">
                            <p className="text-xl font-mono text-slate-400 uppercase">
                                {t('browse.empty') || 'Nenhuma sala disponível'}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                                {t('browse.empty.hint') || 'Crie uma sala ou tente novamente'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {rooms.map((room) => (
                                <button
                                    key={room.code}
                                    onClick={() => onJoinRoom(room.code)}
                                    className={`
                                        group relative w-full p-5 bg-black/40 border-2 rounded-xl
                                        transition-all text-left
                                        ${room.isClosingSoon
                                            ? 'border-spies/50 hover:border-spies'
                                            : 'border-white/10 hover:border-resistance/50'
                                        }
                                        hover:bg-black/60
                                    `}
                                >
                                    {/* Nome e Código */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-xl font-display font-bold text-white uppercase tracking-tight">
                                                {room.name}
                                            </h3>
                                            <p className="text-xs font-mono text-slate-500 tracking-widest mt-1">
                                                {room.code}
                                            </p>
                                        </div>

                                        {/* Tempo Restante */}
                                        <div className={`
                                            text-sm font-mono uppercase tracking-wider
                                            ${room.isClosingSoon ? 'text-spies animate-pulse' : 'text-slate-500'}
                                        `}>
                                            {room.isClosingSoon && (
                                                <span className="mr-1">⚠</span>
                                            )}
                                            {formatTimeRemaining(room.expiresIn)}
                                        </div>
                                    </div>

                                    {/* Info da Sala */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm font-mono text-slate-400">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                            </svg>
                                            <span>{room.playerCount}/10 {t('browse.players') || 'jogadores'}</span>
                                        </div>

                                        {/* Indicador de hover */}
                                        <div className="flex items-center gap-2 text-sm font-mono text-resistance opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="uppercase">{t('browse.join') || 'ENTRAR'}</span>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-4">
                    <p className="text-xs font-mono text-slate-500 uppercase">
                        {t('browse.updated') || 'Atualizado há'} {Math.floor((Date.now() - lastUpdate) / 1000)}s
                    </p>

                    <button
                        onClick={onBack}
                        className="px-8 py-3 text-sm font-mono font-bold text-slate-400 uppercase tracking-widest hover:text-white transition-colors"
                    >
                        {t('common.back') || 'VOLTAR'}
                    </button>
                </div>
            </div>
        </div>
    );
}
