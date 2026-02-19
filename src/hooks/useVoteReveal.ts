import { useState, useRef, useEffect } from 'react';
import { GameState, Phase } from '../types';

interface VoteResult {
    approvals: number;
    rejections: number;
    approved: boolean;
}

interface UseVoteRevealReturn {
    revealVotes: boolean;
    lastVoteResult: VoteResult | null;
}

/**
 * Hook that manages the vote reveal animation timing.
 * - Waits 1 second after all active players have voted before revealing.
 * - Captures vote results when the phase transitions away from TEAM_VOTE.
 * - Resets state when a new vote round begins.
 */
export function useVoteReveal(state: GameState): UseVoteRevealReturn {
    const [lastVoteResult, setLastVoteResult] = useState<VoteResult | null>(null);
    const lastPhase = useRef(state.phase);
    const [revealVotes, setRevealVotes] = useState(false);
    const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const activePlayers = state.players.filter(p => !p.isSpectator);
    const currentMission = state.missions[state.currentMissionIndex];
    const totalVotes = Object.keys(currentMission.votes).length;
    const allVoted = totalVotes === activePlayers.length && activePlayers.length > 0;

    // Reveal votes after 1 second delay when all players have voted
    useEffect(() => {
        if (state.phase === Phase.TEAM_VOTE && allVoted && !revealVotes) {
            revealTimeoutRef.current = setTimeout(() => {
                setRevealVotes(true);
            }, 1000);
        }

        return () => {
            if (revealTimeoutRef.current) {
                clearTimeout(revealTimeoutRef.current);
            }
        };
    }, [state.phase, allVoted, revealVotes]);

    // Capture vote result when phase transitions from TEAM_VOTE
    useEffect(() => {
        if (lastPhase.current === Phase.TEAM_VOTE && state.phase !== Phase.TEAM_VOTE) {
            const votes = Object.values(currentMission.votes) as boolean[];
            const approvals = votes.filter(v => v === true).length;
            const rejections = votes.filter(v => v === false).length;
            const approved = approvals > rejections;
            setLastVoteResult({ approvals, rejections, approved });
        }
        // Reset when a new vote round begins
        if (state.phase === Phase.TEAM_VOTE && lastPhase.current !== Phase.TEAM_VOTE) {
            setLastVoteResult(null);
            setRevealVotes(false);
        }
        lastPhase.current = state.phase;
    }, [state.phase, state.currentMissionIndex, currentMission.votes]);

    return { revealVotes, lastVoteResult };
}
