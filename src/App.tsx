import React, { useState, useCallback, useEffect } from 'react';
import { Phase, Player, Role, GameState } from './types';
import { usePartySocket } from './hooks/usePartySocket';
import HomeView from './views/HomeView';
import SetupView from './views/SetupView';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';

// Componente de Toast para notificações na tela
function Toast({ message, type, onClose }: { message: string; type: 'error' | 'info' | 'success'; onClose: () => void }) {
  React.useEffect(function () {
    const timer = setTimeout(onClose, 5000);
    return function () { clearTimeout(timer); };
  }, [onClose]);

  const bgColor = type === 'error' ? 'bg-spy/90' : type === 'success' ? 'bg-green-500/90' : 'bg-resistance/90';

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl border border-white/20 backdrop-blur-md animate-in slide-in-from-top duration-300 max-w-md`}>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          {type === 'error' && <span className="text-2xl">⚠️</span>}
          {type === 'success' && <span className="text-2xl">✅</span>}
          {type === 'info' && <span className="text-2xl">ℹ️</span>}
        </div>
        <div className="flex-1">
          <p className="font-mono text-sm uppercase tracking-wide font-bold">{message}</p>
        </div>
        <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors text-lg">
          ×
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'HOME' | 'CREATE' | 'JOIN' | 'LOBBY' | 'GAME'>('HOME');
  const [playerName, setPlayerName] = useState('Agente_' + Math.floor(Math.random() * 999));
  const [avatarSeed] = useState(Math.floor(Math.random() * 9000));
  const [roomCode, setRoomCode] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  const showNotification = useCallback((message: string, type: 'error' | 'info' | 'success' = 'info') => {
    setNotification({ message, type });
  }, []);

  const {
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempt,
    connect,
    disconnect,
    addAi,
    removePlayer,
    startGame,
    selectPlayer,
    submitTeam,
    vote,
    missionAction,
  } = usePartySocket({
    roomCode,
    playerName,
    avatarSeed,
    onStateUpdate: (state) => {
      setGameState(state);
      // Navega para a view correta baseado na fase
      if (state.phase === Phase.LOBBY) {
        setView('LOBBY');
      } else {
        setView('GAME');
      }
    },
    onError: (message) => {
      showNotification(message, 'error');
    },
    onPlayerJoined: (name) => {
      showNotification(`${name} entrou na sala`, 'success');
    },
    onPlayerLeft: (name) => {
      showNotification(`${name} saiu da sala`, 'info');
    },
    onConnectionChange: (status) => {
      setConnectionStatus(status);
      if (status === 'reconnecting') {
        showNotification('Conexão perdida. Reconectando...', 'info');
      } else if (status === 'connected' && connectionStatus === 'reconnecting') {
        showNotification('Conexão restabelecida!', 'success');
      }
    },
  });

  // Gera código de sala (para criar)
  const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  // Handler para criar sala
  const handleCreate = useCallback(() => {
    const code = generateCode();
    setRoomCode(code);
    showNotification('Criando sala...', 'info');
    // O connect será chamado pelo useEffect quando roomCode mudar
  }, [showNotification]);

  // Handler para entrar na sala
  const handleJoin = useCallback((code: string) => {
    if (!code || code.length < 2) {
      showNotification('Digite um código de sala válido', 'error');
      return;
    }
    setRoomCode(code.toUpperCase());
    showNotification('Conectando à sala...', 'info');
  }, [showNotification]);

  // Conecta quando roomCode é definido
  useEffect(() => {
    if (roomCode && !isConnected && !isConnecting) {
      connect();
    }
  }, [roomCode, isConnected, isConnecting, connect]);

  // Encontra o jogador atual
  const myPlayer = gameState?.players.find(p => p.name === playerName);
  const isHost = myPlayer?.isHost || false;

  // Handler para adicionar IA
  const handleAddAi = useCallback(() => {
    const aiName = 'T-' + (Math.floor(Math.random() * 900) + 100);
    const aiSeed = Math.floor(Math.random() * 9999);
    addAi(aiName, aiSeed);
  }, [addAi]);

  // Handler para iniciar o jogo
  const handleStart = useCallback(() => {
    startGame();
  }, [startGame]);

  // Handler para ações do jogo
  const sendAction = useCallback((action: string, payload: any) => {
    switch (action) {
      case 'SELECT_PLAYER':
        selectPlayer(payload.id);
        break;
      case 'SUBMIT_TEAM':
        submitTeam();
        break;
      case 'VOTE':
        vote(payload.approve);
        break;
      case 'MISSION_ACTION':
        missionAction(payload.success);
        break;
    }
  }, [selectPlayer, submitTeam, vote, missionAction]);

  // Handler para voltar
  const handleBack = useCallback(() => {
    disconnect();
    setRoomCode('');
    setGameState(null);
    setView('HOME');
  }, [disconnect]);

  return (
    <div className="min-h-screen bg-dark text-slate-200 font-sans selection:bg-resistance selection:text-white">
      {/* Sistema de notificações */}
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Overlay de loading durante conexão */}
      {isConnecting && (
        <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-resistance border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-mono text-sm text-resistance uppercase tracking-widest animate-pulse">Estabelecendo conexão...</p>
          </div>
        </div>
      )}

      {/* Overlay de reconexão */}
      {isReconnecting && (
        <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm mx-auto p-8">
            <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-mono text-lg text-yellow-500 uppercase tracking-widest animate-pulse">Reconectando...</p>
            <p className="font-mono text-sm text-slate-400">Tentativa {reconnectAttempt} de 10</p>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-4">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(reconnectAttempt / 10) * 100}%` }}
              ></div>
            </div>
            <p className="font-mono text-xs text-slate-500 mt-4">Não feche esta página. Tentando restabelecer conexão...</p>
          </div>
        </div>
      )}

      {/* Indicador de status de conexão (fixo no canto) */}
      {(view === 'LOBBY' || view === 'GAME') && (
        <div className="fixed bottom-4 right-4 z-[9000] flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-mono text-xs text-slate-400 uppercase">
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      )}

      {view === 'HOME' && <HomeView onNavigate={setView} />}

      {(view === 'CREATE' || view === 'JOIN') && (
        <SetupView
          mode={view}
          playerName={playerName}
          onNameChange={setPlayerName}
          onInit={handleCreate}
          onJoin={handleJoin}
          onBack={handleBack}
        />
      )}

      {view === 'LOBBY' && gameState && (
        <LobbyView
          state={gameState}
          isHost={isHost}
          onAddAi={handleAddAi}
          onRemove={removePlayer}
          onStart={handleStart}
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
