import React, { useState, useCallback, useEffect } from 'react';
import { Phase, Player, Role, GameState } from './types';
import { usePartySocket, clearSession } from './hooks/usePartySocket';
import HomeView from './views/HomeView';
import SetupView from './views/SetupView';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';
import ReconnectView from './views/ReconnectView';

// Chave para salvar o nome no localStorage (persiste entre sessões)
const PLAYER_NAME_KEY = 'resist_player_name';

// Componente de Toast para notificações na tela
function Toast({ message, type, onClose }: { message: string; type: 'error' | 'info' | 'success'; onClose: () => void }) {
  React.useEffect(function () {
    const timer = setTimeout(onClose, 5000);
    return function () { clearTimeout(timer); };
  }, [onClose]);

  const borderColor = type === 'error' ? 'border-spy/50' : type === 'success' ? 'border-resistance/50' : 'border-white/20';
  const iconColor = type === 'error' ? 'text-spy' : type === 'success' ? 'text-resistance' : 'text-slate-300';
  const glowColor = type === 'error' ? 'shadow-glow-red' : type === 'success' ? 'shadow-glow-blue' : '';

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-black/90 text-white px-5 py-3 rounded-xl border ${borderColor} backdrop-blur-xl animate-in slide-in-from-bottom duration-300 max-w-md ${glowColor}`}>
      <div className="flex items-center gap-3">
        <div className={`shrink-0 ${iconColor}`}>
          {type === 'error' && <span className="text-lg">⚠</span>}
          {type === 'success' && <span className="text-lg">✓</span>}
          {type === 'info' && <span className="text-lg">›</span>}
        </div>
        <p className="flex-1 font-mono text-sm uppercase tracking-widest font-bold text-white">{message}</p>
        <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm text-slate-300 hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}

// Chave do localStorage para sessão do App
const APP_SESSION_KEY = 'resist_app_session';

interface AppSession {
  roomCode: string;
  playerName: string;
  avatarSeed: number;
}

// Recupera sessão do localStorage (persiste ao atualizar)
function getStoredSession(): AppSession | null {
  try {
    const stored = localStorage.getItem(APP_SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[App] Erro ao ler sessão:', e);
  }
  return null;
}

// Salva sessão no localStorage (persiste ao atualizar)
function saveSession(session: AppSession) {
  try {
    localStorage.setItem(APP_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[App] Erro ao salvar sessão:', e);
  }
}

// Limpa sessão do localStorage
function clearAppSession() {
  try {
    localStorage.removeItem(APP_SESSION_KEY);
  } catch (e) {
    console.warn('[App] Erro ao limpar sessão:', e);
  }
}

export default function App() {
  // Tenta restaurar sessão anterior
  const storedSession = getStoredSession();
  const isRestoringSession = React.useRef(!!storedSession); // Track if we started from a stored session

  // Se há sessão salva, vai para RECONNECT em vez de conectar automaticamente
  const [view, setView] = useState<'HOME' | 'CREATE' | 'JOIN' | 'LOBBY' | 'GAME' | 'RECONNECT'>(storedSession ? 'RECONNECT' : 'HOME');
  // Prioridade: localStorage > storedSession > nome aleatório
  const [playerName, setPlayerName] = useState(
    localStorage.getItem(PLAYER_NAME_KEY) || storedSession?.playerName || 'Agente_' + Math.floor(Math.random() * 999)
  );
  const [avatarSeed] = useState(storedSession?.avatarSeed || Math.floor(Math.random() * 9000));
  const [roomCode, setRoomCode] = useState(''); // NÃO inicia com roomCode salvo - espera usuário clicar
  const [savedRoomCode] = useState(storedSession?.roomCode || ''); // Guarda para exibir na tela
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const showNotification = useCallback((message: string, type: 'error' | 'info' | 'success' = 'info') => {
    setNotification({ message, type });
  }, []);

  const {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    removePlayer,
    startGame,
    selectPlayer,
    submitTeam,
    vote,
    missionAction,
    setAnonymousVotes,
    setShowRejectionCount,
    restartGame,
    disconnectVote,
  } = usePartySocket({
    roomCode,
    playerName,
    avatarSeed,
    onStateUpdate: (state) => {
      setGameState(state);
      // Limpa notificações de "conectando"
      if (view !== 'GAME' && view !== 'LOBBY' && view !== 'RECONNECT') {
        setNotification(null);
      }

      // Só navega se ainda estamos conectados a uma sala
      // Isso evita que mensagens tardias sobrescrevam a navegação para HOME
      if (!roomCode) {
        return;
      }

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
      // NÃO limpar sessão aqui - permite tentar reconexão ao recarregar página
    },
    onRoomClosed: () => {
      clearAppSession();
      setRoomCode('');
      setGameState(null);
      setView('HOME');
      showNotification('A sala foi fechada.', 'info');
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

  // Salva sessão no localStorage quando conectado
  useEffect(() => {
    if (isConnected && roomCode && playerName) {
      saveSession({ roomCode, playerName, avatarSeed });
      // Salva o nome separadamente para persistir entre partidas
      localStorage.setItem(PLAYER_NAME_KEY, playerName);
    }
  }, [isConnected, roomCode, playerName, avatarSeed]);

  // Timeout para detectar conexão travada - se 15s sem gameState, mostra erro
  useEffect(() => {
    // Só ativa timeout quando está tentando reconectar (tem roomCode mas sem gameState)
    if ((isConnecting || isConnected) && !gameState && roomCode && view === 'RECONNECT') {
      const timeout = setTimeout(() => {
        // Ainda sem gameState = sala vazia ou inexistente
        disconnect();
        setRoomCode('');
        setReconnectError('Não foi possível reconectar. A sala pode não existir mais.');
        clearAppSession(); // Limpa sessão pois a sala não existe
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [isConnecting, isConnected, gameState, roomCode, view, disconnect]);

  // Quando recebe gameState, não está mais restaurando
  useEffect(() => {
    if (gameState) {
      isRestoringSession.current = false;
    }
  }, [gameState]);

  // Encontra o jogador atual
  const myPlayer = gameState?.players.find(p => p.name === playerName);
  const isHost = myPlayer?.isHost || false;

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
      case 'RESTART_GAME':
        restartGame();
        break;
      case 'DISCONNECT_VOTE':
        disconnectVote(payload.endGame);
        break;
    }
  }, [selectPlayer, submitTeam, vote, missionAction, restartGame, disconnectVote]);

  // Handler para voltar (sai da sala e limpa todas as sessões)
  const handleBack = useCallback(() => {
    disconnect();
    clearSession();     // Limpa sessão de WebSocket (localStorage)
    clearAppSession();  // Limpa sessão do App (sessionStorage)
    setRoomCode('');
    setGameState(null);
    setView('HOME');
  }, [disconnect]);

  // Handler para tentar reconectar
  const handleReconnect = useCallback(() => {
    if (savedRoomCode) {
      setReconnectError(null);
      setRoomCode(savedRoomCode); // Isso vai disparar o connect() via useEffect
    }
  }, [savedRoomCode]);

  // Handler para voltar da tela de reconexão
  const handleBackFromReconnect = useCallback(() => {
    disconnect();
    clearAppSession();
    setRoomCode('');
    setGameState(null);
    setReconnectError(null);
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

      {/* Overlay de loading durante conexão (não mostra na tela RECONNECT) */}
      {isConnecting && view !== 'RECONNECT' && (
        <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-resistance border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-mono text-sm text-resistance uppercase tracking-widest animate-pulse">Estabelecendo conexão...</p>
            <button
              onClick={() => {
                disconnect();
                clearAppSession();
                setRoomCode('');
                setView('HOME');
                showNotification('Conexão cancelada.', 'info');
              }}
              className="mt-4 text-xs font-mono text-slate-300 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Indicador de status de conexão (fixo no canto) */}
      {(view === 'LOBBY' || view === 'GAME') && (
        <div className="fixed bottom-4 right-4 z-[9000] flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-mono text-xs text-slate-300 uppercase">
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      )}

      {view === 'HOME' && <HomeView onNavigate={setView} />}

      {view === 'RECONNECT' && (
        <ReconnectView
          roomCode={savedRoomCode}
          playerName={playerName}
          onReconnect={handleReconnect}
          onBackToMenu={handleBackFromReconnect}
          isConnecting={isConnecting}
          error={reconnectError}
        />
      )}

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
          onRemove={removePlayer}
          onStart={handleStart}
          onToggleAnonymousVotes={setAnonymousVotes}
          onToggleShowRejectionCount={setShowRejectionCount}
          onBack={handleBack}
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
