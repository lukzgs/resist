import { Role, Player } from '../types';
import { GAME_RULES_BY_COUNT } from '../../shared/constants';
import { useTranslation } from '../i18n';

interface GameHeaderProps {
    roomCode: string;
    players: Player[];
}

export default function GameHeader({ roomCode, players }: GameHeaderProps) {
    const { t } = useTranslation();

    const activePlayersCount = players.filter(p => !p.isSpectator).length;
    const terminatorCount = activePlayersCount >= 5 && activePlayersCount <= 10
        ? GAME_RULES_BY_COUNT[activePlayersCount].spyCount
        : 0;

    return (
        <header className="px-6 py-4 border-b border-white/5 bg-black/80 backdrop-blur-xl flex justify-between items-center shrink-0 z-50">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-10 h-10 bg-spy/10 border border-spy/40 rounded flex items-center justify-center animate-pulse">
                        <div className="w-3 h-3 bg-spy rounded-sm shadow-glow-red"></div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-black animate-ping"></div>
                </div>
                <div>
                    <h1 className="font-display font-black text-2xl text-white leading-none tracking-tighter">SKYNET_INFILTRATION</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-spy uppercase tracking-[0.3em] font-black">Active_Threat_Detected</span>
                        <span className="w-8 h-[1px] bg-spy/40"></span>
                        <span className="text-xs font-mono text-slate-300 uppercase tracking-widest font-bold">2029_SYS_LINK</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Badge de terminators */}
                <div className="hidden md:flex items-center gap-2 bg-spy/10 px-3 py-2 rounded-lg border border-spy/30">
                    <span className="text-xs font-mono text-spy uppercase tracking-widest">{t('game.terminators_count')}:</span>
                    <span className="text-lg font-display font-black text-spy">
                        {terminatorCount}
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                    <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">{t('game.room')}:</span>
                    <span className="text-lg font-display font-black text-resistance tracking-widest">{roomCode.replace(/0/g, 'Ø')}</span>
                </div>
            </div>
        </header>
    );
}
