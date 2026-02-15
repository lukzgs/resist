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
    const [refreshing, setRefreshing] = useState(false);

    const fetchRooms = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const publicRooms = await getPublicRooms();
            setRooms(publicRooms);
        } catch (e) {
            console.error('Erro ao buscar salas:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Busca inicial e refresh a cada 10s
    useEffect(() => {
        fetchRooms();
        const interval = setInterval(() => fetchRooms(), 10000);
        return () => clearInterval(interval);
    }, [fetchRooms]);

    const handleRefresh = () => {
        if (!refreshing) fetchRooms(true);
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
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {rooms.map((room) => (
                                <button
                                    key={room.code}
                                    onClick={() => onJoinRoom(room.code)}
                                    className={`
                                        group relative w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl
                                        transition-all duration-300 text-left overflow-hidden
                                        ${room.isClosingSoon
                                            ? 'hover:border-spies/50 hover:bg-spies/5 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                                            : 'hover:border-resistance/50 hover:bg-resistance/5 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                                        }
                                    `}
                                >
                                    {/* Background Gradient on Hover */}
                                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-r ${room.isClosingSoon ? 'from-spies/10' : 'from-resistance/10'} to-transparent`} />

                                    {/* Single row: Name | Bar | JOIN */}
                                    <div className="relative flex items-center justify-between gap-4 z-10">
                                        {/* Room Name - left */}
                                        <h3 className="text-lg font-display font-black text-white uppercase tracking-tight truncate w-1/4 min-w-[80px] shrink-0" title={room.name}>
                                            {room.name}
                                        </h3>

                                        {/* Player Count Bar - middle */}
                                        <div className="flex items-center gap-2 flex-1">
                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${room.isClosingSoon ? 'bg-spies' : 'bg-resistance'}`}
                                                    style={{ width: `${(room.playerCount / 10) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono text-slate-400 font-bold whitespace-nowrap">
                                                {room.playerCount}/10
                                            </span>
                                        </div>

                                        {/* Join Badge - right */}
                                        <div className={`
                                            px-4 py-1.5 rounded text-sm font-display font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap shrink-0
                                            ${room.isClosingSoon
                                                ? 'bg-spies/10 text-spies border border-spies/20 group-hover:bg-spies group-hover:text-black'
                                                : 'bg-resistance/10 text-resistance border border-resistance/20 group-hover:bg-resistance group-hover:text-black'
                                            }
                                        `}>
                                            {t('browse.join') || 'ENTRAR'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-4">
                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-slate-400 uppercase tracking-widest hover:text-resistance transition-colors disabled:opacity-50"
                    >
                        <svg
                            className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {refreshing
                            ? (t('browse.refreshing') || 'Atualizando...')
                            : (t('browse.refresh') || 'Atualizar salas')
                        }
                    </button>

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
