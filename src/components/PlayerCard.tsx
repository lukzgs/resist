
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
  terminatorIndex?: number; // Índice único entre terminators para imagem
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
  isMe = false,
  terminatorIndex = 0
}) => {

  // Base styles for glassmorphism
  const baseClasses = "relative flex flex-col items-center p-3 rounded-xl transition-all duration-300 backdrop-blur-md border-2";

  // Dynamic styles - prioridade: isMe > isDisconnected > isInTeam > default
  let borderClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
  let shadowClass = "";

  // Cores baseadas no papel para o próprio jogador
  const isTerminator = player.role === Role.TERMINATOR;
  const meColor = isTerminator
    ? { border: "border-red-500/70 bg-red-500/10", shadow: "shadow-[0_0_25px_-5px_rgba(239,68,68,0.5)] ring-1 ring-red-500/30" }
    : { border: "border-cyan-400/70 bg-cyan-500/10", shadow: "shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/30" };

  if (isMe && showIdentity) {
    borderClass = meColor.border;
    shadowClass = meColor.shadow;
  } else if (isMe) {
    borderClass = "border-cyan-400/70 bg-cyan-500/10";
    shadowClass = "shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/30";
  }

  if (isDisconnected) {
    borderClass = "border-red-500/30 bg-red-900/10";
    shadowClass = "";
  } else if (isInTeam) {
    if (isMe && showIdentity && isTerminator) {
      borderClass = "border-yellow-400/80 bg-gradient-to-b from-yellow-500/20 to-red-500/10";
    } else if (isMe) {
      borderClass = "border-yellow-400/80 bg-gradient-to-b from-yellow-500/20 to-cyan-500/10";
    } else {
      borderClass = "border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-transparent";
    }
    shadowClass = "shadow-[0_0_25px_-5px_rgba(234,179,8,0.4)]";
  }

  const roleColor = player.role === Role.TERMINATOR ? 'text-spy' : 'text-resistance';

  // Background para Terminator quando identidade revelada
  const showTerminatorBg = showIdentity && isTerminator;

  return (
    <div className={`${baseClasses} ${borderClass} ${shadowClass} group ${isDisconnected ? 'opacity-50' : ''}`}>
      {/* Background image para Terminator - usa terminatorIndex para imagem única */}
      {showTerminatorBg && (
        <div
          className="absolute inset-0 rounded-xl bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: `url(/src/assets/avatars/terminators/terminator${(terminatorIndex % 4) + 1}.avif)` }}
        />
      )}
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
        {/* Avatar Container - invisível quando terminator com background, mas mantém espaço */}
        <div className={`rounded-full p-1 ${isInTeam ? 'bg-yellow-500/20' : 'bg-transparent'} ${showTerminatorBg ? 'opacity-0' : ''}`}>
          <img
            src={AVATAR_URL(player.avatarSeed)}
            alt={player.name}
            className={`rounded-full object-cover bg-slate-800 border-2 ${isInTeam ? 'border-yellow-400' : isDisconnected ? 'border-red-500/50 grayscale' : 'border-slate-700'} ${compact ? 'w-10 h-10' : 'w-14 h-14 md:w-16 md:h-16'} transition-transform duration-300 group-hover:scale-105`}
          />
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

      <div className="text-center w-full relative z-10">
        <div className="relative inline-flex items-center justify-center">
          {/* Online/Offline Status Indicator - posição absoluta à esquerda do nome */}
          <div
            className={`absolute -left-4 w-3 h-3 rounded-full border border-slate-900 ${isDisconnected ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
            title={isDisconnected ? 'Offline' : 'Online'}
          />
          <div className={`font-display font-bold text-base md:text-lg truncate tracking-wide ${showTerminatorBg ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' : 'text-slate-200'}`}>{player.name}</div>
        </div>

        {/* Identity Reveal / Role Tag */}
        <div className="h-4 flex items-center justify-center mt-1">
          {showIdentity ? (
            <div className={`text-xs uppercase font-bold tracking-widest px-2 py-0.5 rounded-sm bg-black/70 ${roleColor}`}>
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