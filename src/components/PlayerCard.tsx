
import React from 'react';
import { Player, Role } from '../types';
import { AVATAR_URL } from '../constants';

interface PlayerCardProps {
  player: Player;
  isLeader: boolean;
  isInTeam: boolean;
  showIdentity: boolean;
  compact?: boolean;
  vote?: boolean | null;
  hasVoted?: boolean;  // Para modo anônimo - indica que votou sem revelar o voto
  isDisconnected?: boolean;
  isMe?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isLeader,
  isInTeam,
  showIdentity,
  compact = false,
  vote = undefined,
  hasVoted = false,
  isDisconnected = false,
  isMe = false
}) => {

  // Base styles for glassmorphism
  const baseClasses = "relative flex flex-col items-center p-3 rounded-xl transition-all duration-300 backdrop-blur-md border-2";

  // Dynamic styles - função pura: mapeia estado para estilos sem mutação de variáveis (KISS/SRP)
  const isTerminator = player.role === Role.TERMINATOR;
  const roleColor = isTerminator ? 'text-spy' : 'text-resistance';

  function resolveCardStyle(): { border: string; shadow: string } {
    if (isDisconnected) {
      return { border: 'border-red-500/30 bg-red-900/10', shadow: '' };
    }
    if (isInTeam) {
      const bg = (isMe && showIdentity && isTerminator)
        ? 'from-yellow-500/20 to-red-500/10'
        : isMe
          ? 'from-yellow-500/20 to-cyan-500/10'
          : 'from-yellow-500/10 to-transparent';
      return {
        border: `border-yellow-400/80 bg-gradient-to-b ${bg}`,
        shadow: 'shadow-[0_0_25px_-5px_rgba(234,179,8,0.4)]',
      };
    }
    if (isMe && showIdentity) {
      return isTerminator
        ? { border: 'border-red-500/70 bg-red-500/10', shadow: 'shadow-[0_0_25px_-5px_rgba(239,68,68,0.5)] ring-1 ring-red-500/30' }
        : { border: 'border-cyan-400/70 bg-cyan-500/10', shadow: 'shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/30' };
    }
    if (isMe) {
      return { border: 'border-cyan-400/70 bg-cyan-500/10', shadow: 'shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/30' };
    }
    return { border: 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20', shadow: '' };
  }

  const { border: borderClass, shadow: shadowClass } = resolveCardStyle();


  return (
    <div className={`${baseClasses} ${borderClass} ${shadowClass} group ${isDisconnected ? 'opacity-50' : ''}`}>
      {/* Leader Badge */}
      {isLeader && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black text-xs font-display font-bold px-4 py-1 rounded-full z-20 shadow-lg tracking-wider animate-pulse border border-yellow-300/50">
          LEADER
        </div>
      )}

      {/* "YOU" indicator */}
      {isMe && !isLeader && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r ${showIdentity && isTerminator ? 'from-red-600 to-red-400' : 'from-cyan-600 to-cyan-400'} text-black text-xs font-display font-bold px-3 py-0.5 rounded-full z-20 shadow-lg tracking-wider`}>
          VOCÊ
        </div>
      )}

      <div className="relative mb-3">
        {/* Avatar Container */}
        <div className={`rounded-full p-1 ${isInTeam ? 'bg-yellow-500/20' : 'bg-transparent'}`}>
          <img
            src={AVATAR_URL(player.avatarSeed)}
            alt={player.name}
            className={`rounded-full object-cover bg-slate-800 border-2 ${isInTeam ? 'border-yellow-400' : isDisconnected ? 'border-red-500/50 grayscale' : 'border-slate-700'} ${compact ? 'w-10 h-10' : 'w-14 h-14 md:w-16 md:h-16'} transition-transform duration-300 group-hover:scale-105`}
          />
        </div>

        {/* Online/Offline Status Indicator - sempre visível */}
        <div
          className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center z-10 ${isDisconnected ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`}
          title={isDisconnected ? 'Offline' : 'Online'}
        >
          {isDisconnected && <span className="text-[8px] font-bold text-white">✕</span>}
        </div>

        {/* Vote Badge - mostra voto explícito (modo não-anônimo) */}
        {vote !== undefined && (
          <div className={`absolute -bottom-1 -right-1 w-7 h-7 flex items-center justify-center rounded-full border-2 border-slate-900 text-xs font-bold shadow-lg z-10 ${vote === null
            ? 'bg-slate-600 text-white animate-pulse'
            : vote
              ? 'bg-green-500 text-black'
              : 'bg-red-500 text-white'
            }`}>
            {vote === null ? '...' : vote ? 'YES' : 'NO'}
          </div>
        )}

        {/* Badge de "votou" - modo anônimo (não revela o voto) */}
        {vote === undefined && hasVoted && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 flex items-center justify-center rounded-full border-2 border-cyan-500/70 bg-black/90 text-cyan-400 text-sm font-bold shadow-[0_0_8px_rgba(34,211,238,0.4)] z-10">
            ✓
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <div className="font-display font-bold text-slate-200 text-base md:text-lg truncate tracking-wide">{player.name}</div>

        {/* Identity Reveal / Role Tag */}
        <div className="h-4 flex items-center justify-center mt-1">
          {showIdentity ? (
            <div className={`text-xs uppercase font-bold tracking-widest px-2 rounded-sm bg-black/40 ${roleColor}`}>
              {player.role === Role.TERMINATOR ? 'TERM' : 'HUMAN'}
            </div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
          )}
        </div>
      </div>

      {/* Decorative corner lines */}
      <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${isInTeam ? 'border-yellow-500/50' : 'border-white/10'} rounded-tl-lg`} />
      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${isInTeam ? 'border-yellow-500/50' : 'border-white/10'} rounded-br-lg`} />
    </div>
  );
};

export default PlayerCard;