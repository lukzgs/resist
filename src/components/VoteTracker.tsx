import React from 'react';

interface Props {
  failedVotes: number;
}

const VoteTracker: React.FC<Props> = ({ failedVotes }) => {
  return (
    <div className="flex flex-col items-center mt-6">
      <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm">
        <div className="text-sm font-display font-bold text-slate-400 uppercase tracking-widest mr-2">
          Failed Votes
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((num) => {
            const isActive = failedVotes >= num;
            const isDanger = num === 5;
            return (
              <div
                key={num}
                className={`w-8 h-1.5 rounded-full transition-all duration-300 ${isActive
                  ? isDanger
                    ? 'bg-spy shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                    : 'bg-slate-400'
                  : 'bg-slate-800'
                  }`}
              />
            );
          })}
        </div>
        <div className="text-sm font-mono text-spy font-bold opacity-50 ml-2">
          {failedVotes}/5
        </div>
      </div>
    </div>
  );
};

export default VoteTracker;