
import { useState, useRef, useCallback } from 'react';
import { GameState, Phase, Player, Role } from '../types';
import { getAiTeamVote, getAiMissionAction } from '../services/geminiService';

export function useGameLogic() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [peer, setPeer] = useState<any>(null);
  const [hostConn, setHostConn] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = gameState;

  const broadcastState = useCallback((newState: GameState) => {
    connections.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'STATE_UPDATE', state: newState });
      }
    });
    setGameState(newState);
  }, [connections]);

  const processAction = useCallback(async (action: string, payload: any) => {
    setGameState((s) => {
      if (!s) return s;
      let newState = { ...s };

      switch (action) {
        case 'SELECT_PLAYER':
          const id = payload.id;
          if (newState.proposedTeam.includes(id)) {
            newState.proposedTeam = newState.proposedTeam.filter(pId => pId !== id);
          } else {
            const currentMission = newState.missions[newState.currentMissionIndex];
            if (newState.proposedTeam.length < currentMission.requiredPlayers) {
              newState.proposedTeam = [...newState.proposedTeam, id];
            }
          }
          break;

        case 'SUBMIT_TEAM':
          newState.phase = Phase.TEAM_VOTE;
          newState.logs = [...newState.logs, `> ESQUADRÃO PROPOSTO PELO COMANDANTE.`];
          break;

        case 'VOTE':
          const { playerId, approve } = payload;
          const missionV = { ...newState.missions[newState.currentMissionIndex] };
          missionV.votes = { ...missionV.votes, [playerId]: approve };
          newState.missions = [...newState.missions];
          newState.missions[newState.currentMissionIndex] = missionV;

          if (Object.keys(missionV.votes).length === newState.players.length) {
            const approvals = Object.values(missionV.votes).filter(v => v).length;
            const approved = approvals > newState.players.length / 2;

            if (approved) {
              newState.phase = Phase.MISSION_EXECUTION;
              newState.failedVoteCount = 0;
            } else {
              newState.failedVoteCount++;
              if (newState.failedVoteCount >= 5) {
                newState.phase = Phase.GAME_OVER;
                newState.winner = Role.TERMINATOR;
              } else {
                newState.phase = Phase.TEAM_SELECTION;
                newState.leaderIndex = (newState.leaderIndex + 1) % newState.players.length;
                newState.proposedTeam = [];
              }
            }
          }
          break;

        case 'MISSION_ACTION':
          const { success } = payload;
          const currentM = { ...newState.missions[newState.currentMissionIndex] };
          currentM.missionOutcomes = [...currentM.missionOutcomes, success];
          newState.missions = [...newState.missions];
          newState.missions[newState.currentMissionIndex] = currentM;

          if (currentM.missionOutcomes.length === currentM.requiredPlayers) {
            // Resolver Missão
            const fails = currentM.missionOutcomes.filter(r => !r).length;
            const isFailed = currentM.requiresTwoFails ? fails >= 2 : fails >= 1;
            
            newState.missions[newState.currentMissionIndex].status = isFailed ? 'FAIL' : 'SUCCESS';
            
            const successes = newState.missions.filter(m => m.status === 'SUCCESS').length;
            const failures = newState.missions.filter(m => m.status === 'FAIL').length;
            
            if (successes >= 3) {
              newState.winner = Role.HUMAN;
              newState.phase = Phase.GAME_OVER;
            } else if (failures >= 3) {
              newState.winner = Role.TERMINATOR;
              newState.phase = Phase.GAME_OVER;
            } else {
              newState.currentMissionIndex++;
              newState.phase = Phase.TEAM_SELECTION;
              newState.leaderIndex = (newState.leaderIndex + 1) % newState.players.length;
              newState.proposedTeam = [];
            }
          }
          break;
      }

      broadcastState(newState);
      return newState;
    });
  }, [broadcastState]);

  return {
    gameState, setGameState,
    isHost, setIsHost,
    peer, setPeer,
    hostConn, setHostConn,
    setConnections,
    broadcastState,
    processAction,
  };
}
