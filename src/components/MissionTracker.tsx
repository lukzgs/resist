import React from 'react';
import { Mission } from '../types';

interface Props {
  missions: Mission[];
  currentMissionIndex: number;
}

const MissionTracker: React.FC<Props> = ({ missions, currentMissionIndex }) => {
  return (
    <div className="relative w-full max-w-3xl mx-auto py-6 px-4">
      {/* Connecting Line */}
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10 -translate-y-1/2 rounded-full overflow-hidden">
        <div 
            className="h-full bg-gradient-to-r from-transparent via-slate-600 to-transparent opacity-50"
        />
      </div>

      <div className="flex justify-between items-center">
        {missions.map((m, idx) => {
          let ringColor = 'border-slate-700 bg-dark';
          let textColor = 'text-slate-500';
          let shadow = '';
          let scale = 'scale-100';

          if (m.status === 'SUCCESS') {
            ringColor = 'border-resistance bg-resistance/20';
            textColor = 'text-resistance';
            shadow = 'shadow-glow-blue';
          } else if (m.status === 'FAIL') {
            ringColor = 'border-spy bg-spy/20';
            textColor = 'text-spy';
            shadow = 'shadow-glow-red';
          } else if (idx === currentMissionIndex) {
            ringColor = 'border-yellow-500 bg-yellow-500/10 animate-pulse';
            textColor = 'text-yellow-400';
            shadow = 'shadow-glow-gold';
            scale = 'scale-110';
          }

          return (
            <div key={idx} className={`relative flex flex-col items-center group transition-all duration-500 ${scale}`}>
                {/* Node */}
                <div className={`
                    w-12 h-12 md:w-16 md:h-16 rounded-full border-2 md:border-4 flex items-center justify-center
                    backdrop-blur-sm z-10 transition-colors duration-300
                    ${ringColor} ${shadow}
                `}>
                    <span className={`font-display font-bold text-xl md:text-2xl ${textColor}`}>
                        {m.requiredPlayers}
                    </span>
                </div>
                
                {/* Label */}
                <div className="absolute -bottom-8 flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-semibold">
                        M-{m.roundNumber}
                    </span>
                    {m.requiresTwoFails && (
                        <span className="text-[9px] text-red-500 font-bold whitespace-nowrap mt-0.5 px-1.5 py-0.5 bg-red-500/10 rounded border border-red-500/20">
                            2 FAILS
                        </span>
                    )}
                </div>

                {/* Active Indicator */}
                {idx === currentMissionIndex && (
                    <div className="absolute -top-3 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,1)]" />
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MissionTracker;