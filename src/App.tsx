
import React, { useState, useCallback } from 'react';
import { Phase, Player, Role } from './types';
import { useGameLogic } from './hooks/useGameLogic';
import HomeView from './views/HomeView';
import SetupView from './views/SetupView';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';

export default function App() {
  const [view, setView] = useState<'HOME' | 'CREATE' | 'JOIN' | 'LOBBY' | 'GAME'>('HOME');
  const [playerName, setPlayerName] = useState('Agente_' + Math.floor(Math.random() * 999));
  const { 
    gameState, setGameState, isHost, setIsHost, peer, setPeer, 
    hostConn, setHostConn, setConnections, broadcastState, processAction 
  } = useGameLogic();

  const handleInitPeer = useCallback(function(code: string, asHost: boolean) {
    // @ts-ignore
    const p = new window.Peer('RES-' + code);
    p.on('open', function() {
      setPeer(p);
      if (asHost) {
        setIsHost(true);
        const hostP: Player = { 
          id: 'p-host', 
          name: playerName, 
          role: Role.HUMAN, 
          isAi: false, 
          isHost: true, 
          avatarSeed: Math.floor(Math.random() * 9000) 
        };
        setGameState({
          phase: Phase.LOBBY, 
          roomCode: code, 
          players: [hostP], 
          leaderIndex: 0, 
          currentMissionIndex: 0,
          missions: [], 
          failedVoteCount: 0, 
          proposedTeam: [], 
          logs: ['> PROTOCOLO: ' + code], 
          winner: null, 
          isProcessingAi: false
        });
        setView('LOBBY');
      }
    });
    p.on('connection', function(conn: any) {
      if (asHost) {
        conn.on('open', function() {
          setConnections(function(prev) { return [...prev, conn]; });
          conn.on('data', function(data: any) {
            if (data.type === 'JOIN_REQUEST') {
                setGameState(function(s) {
                    if (!s) return s;
                    const newP: Player = { 
                      id: 'p-' + Math.random().toString(36).substr(2, 5), 
                      name: data.name, 
                      role: Role.HUMAN, 
                      isAi: false, 
                      isHost: false, 
                      avatarSeed: Math.floor(Math.random() * 9000) 
                    };
                    const ns = { ...s, players: [...s.players, newP] };
                    broadcastState(ns);
                    return ns;
                });
            } else if (data.type === 'ACTION') {
              processAction(data.action, data.payload);
            }
          });
        });
      }
    });
  }, [playerName, setGameState, setIsHost, setPeer, setConnections, broadcastState, processAction]);

  const handleJoin = useCallback(function(code: string) {
    // @ts-ignore
    const p = new window.Peer();
    p.on('open', function() {
      const conn = p.connect('RES-' + code);
      conn.on('open', function() {
        setHostConn(conn);
        conn.send({ type: 'JOIN_REQUEST', name: playerName });
        conn.on('data', function(data: any) {
          if (data.type === 'STATE_UPDATE') {
            setGameState(data.state);
            setView(data.state.phase === Phase.LOBBY ? 'LOBBY' : 'GAME');
          }
        });
      });
      setPeer(p);
    });
  }, [playerName, setGameState, setHostConn, setPeer]);

  const sendAction = useCallback(function(action: string, payload: any) {
    if (isHost) {
      processAction(action, payload);
    } else if (hostConn) {
      hostConn.send({ type: 'ACTION', action: action, payload: payload });
    }
  }, [isHost, hostConn, processAction]);

  return (
    <div className="min-h-screen bg-dark text-slate-200 font-sans selection:bg-resistance selection:text-white">
      {view === 'HOME' && <HomeView onNavigate={setView} />}
      {(view === 'CREATE' || view === 'JOIN') && (
        <SetupView 
          mode={view} 
          playerName={playerName} 
          onNameChange={setPlayerName} 
          onInit={handleInitPeer} 
          onJoin={handleJoin} 
          onBack={function() { setView('HOME'); }} 
        />
      )}
      {view === 'LOBBY' && gameState && (
        <LobbyView 
          state={gameState} 
          isHost={isHost} 
          onAddAi={function(ai) { 
            const ns = {...gameState, players: [...gameState.players, ai]}; 
            broadcastState(ns); 
          }} 
          onRemove={function() { 
            const ns = {...gameState, players: gameState.players.slice(0, -1)}; 
            broadcastState(ns); 
          }}
          onStart={function() { setView('GAME'); }}
          broadcast={broadcastState}
        />
      )}
      {view === 'GAME' && gameState && (
        <GameView 
          state={gameState} 
          playerName={playerName} 
          sendAction={sendAction} 
          isHost={isHost}
        />
      )}
    </div>
  );
}
