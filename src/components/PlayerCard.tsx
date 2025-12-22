
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
}

const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  isLeader, 
  isInTeam, 
  showIdentity,
  compact = false,
  vote = undefined
}) => {
  
  // Base styles for glassmorphism
  const baseClasses = "relative flex flex-col items-center p-3 rounded-xl transition-all duration-300 backdrop-blur-md border";
  
  // Dynamic styles
  let borderClass = "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20";
  let shadowClass = "";

  if (isInTeam) {
    borderClass = "border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-transparent";
    shadowClass = "shadow-[0_0_20px_-5px_rgba(234,179,8,0.3)]";
  }

  const roleColor = player.role === Role.TERMINATOR ? 'text-spy' : 'text-resistance';
  
  return (
    <div className={`${baseClasses} ${borderClass} ${shadowClass} group`}>
      {isLeader && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-[10px] font-display font-bold px-3 py-0.5 rounded-full z-20 shadow-lg tracking-wider">
          LEADER
        </div>
      )}
      
      <div className="relative mb-3">
        {/* Avatar Container with glowing ring if needed */}
        <div className={`rounded-full p-1 ${isInTeam ? 'bg-yellow-500/20' : 'bg-transparent'}`}>
             <img 
                src={AVATAR_URL(player.avatarSeed)} 
                alt={player.name}
                className={`rounded-full object-cover bg-slate-800 border-2 ${isInTeam ? 'border-yellow-400' : 'border-slate-700'} ${compact ? 'w-10 h-10' : 'w-14 h-14 md:w-16 md:h-16'} transition-transform duration-300 group-hover:scale-105`}
            />
        </div>

        {/* Vote Badge */}
        {vote !== undefined && (
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-bold shadow-lg z-10 ${
            vote === null 
              ? 'bg-slate-600 text-white animate-pulse' 
              : vote 
                ? 'bg-green-500 text-black' 
                : 'bg-red-500 text-white'
          }`}>
            {vote === null ? '...' : vote ? 'YES' : 'NO'}
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <div className="font-display font-bold text-slate-200 text-sm md:text-base truncate tracking-wide">{player.name}</div>
        
        {/* Identity Reveal / Role Tag */}
        <div className={`h-4 flex items-center justify-center mt-1`}>
            {showIdentity ? (
                <div className={`text-[10px] uppercase font-bold tracking-widest px-2 rounded-sm bg-black/40 ${roleColor}`}>
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