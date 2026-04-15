# Skynet Infiltration Protocol - Visão Geral Rápida

> Um jogo multiplayer online de dedução social inspirado em **The Resistance** com temática de **Terminator**.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Estilização | TailwindCSS 4 |
| Backend | PartyKit (WebSocket serverless) |
| Testes | Vitest + React Testing Library |
| Deploy | Vercel + PartyKit Cloud |

## Estrutura do Projeto

```
resist/
├── src/                          # Frontend React
│   ├── App.tsx                   # Componente principal, roteamento, estado
│   ├── views/                    # Componentes de página
│   │   ├── HomeView.tsx          # Página inicial
│   │   ├── SetupView.tsx         # Configuração nome/sala
│   │   ├── LobbyView.tsx         # Lobby pré-jogo
│   │   ├── GameView.tsx          # Tela principal do jogo
│   │   ├── BrowseRoomsView.tsx   # Lista de salas públicas
│   │   └── ReconnectView.tsx     # Tratamento de reconexão
│   ├── components/               # Componentes UI reutilizáveis
│   │   ├── PlayerCard.tsx        # Exibição avatar/info jogador
│   │   ├── MissionTracker.tsx    # Círculos de progresso missão
│   │   ├── VoteTracker.tsx       # Indicador votos rejeitados
│   │   ├── TimerCircle.tsx       # Timer de contagem regressiva
│   │   └── LanguageSelector.tsx  # Alternador de idioma
│   ├── hooks/
│   │   └── usePartySocket.ts     # Conexão WebSocket + reconexão
│   └── i18n.tsx                  # Traduções (PT-BR, EN)
│
├── server/src/                   # Backend PartyKit
│   ├── server.ts                 # Classe principal ResistServer
│   ├── handlers/
│   │   ├── joinHandler.ts        # JOIN, LEAVE, REMOVE_PLAYER
│   │   ├── gameHandlers.ts       # START, VOTE, MISSION, etc.
│   │   ├── disconnectHandlers.ts # Pausar/resumir, voto desconexão
│   │   └── timerHandlers.ts      # Iniciar/cancelar/pausar timers
│   ├── game/state.ts             # Utilitários de estado (logs, busca jogador)
│   ├── registry.ts               # Registry de salas públicas
│   └── utils/crypto.ts           # UUID, shuffle
│
└── shared/types.ts               # Tipos TypeScript compartilhados
```

## Domínio do Jogo

### Papéis
- `HUMAN` (Resistência) - Completar 3 missões para vencer
- `TERMINATOR` (Skynet) - Sabotar 3 missões para vencer

### Fases (Máquina de Estados)
```
LOBBY → TEAM_SELECTION ⟷ TEAM_VOTE → MISSION_EXECUTION → GAME_OVER
                                          ↓
                              PAUSED_DISCONNECT ⟷ DISCONNECT_VOTE
```

| Fase | Descrição |
|------|-----------|
| `LOBBY` | Aguardando jogadores, host configura jogo |
| `TEAM_SELECTION` | Líder seleciona time para missão |
| `TEAM_VOTE` | Todos votam para aprovar/rejeitar time |
| `MISSION_EXECUTION` | Membros do time escolhem sucesso/sabotagem |
| `GAME_OVER` | Jogo encerrado, vencedor declarado |
| `PAUSED_DISCONNECT` | Jogador desconectou, aguardando reconexão |
| `DISCONNECT_VOTE` | Votação para encerrar ou esperar |

### Condições de Vitória
- **Humanos vencem**: 3 missões bem-sucedidas
- **Terminators vencem**: 3 missões falhadas OU 5 rejeições consecutivas de time

## Tipos Principais (shared/types.ts)

```typescript
enum Role { HUMAN, TERMINATOR }
enum Phase { LOBBY, TEAM_SELECTION, TEAM_VOTE, MISSION_EXECUTION, GAME_OVER, PAUSED_DISCONNECT, DISCONNECT_VOTE }

interface Player { id, name, role, isHost, avatarSeed, sessionId?, disconnected?, isSpectator? }
interface Mission { roundNumber, requiredPlayers, requiresTwoFails, status, team, votes, missionOutcomes }
interface GameState { phase, players, roomCode, missions, leaderIndex, proposedTeam, ... }
```

## Protocolo de Mensagens

### Cliente → Servidor
| Mensagem | Propósito |
|----------|-----------|
| `JOIN` | Entrar/criar sala |
| `START_GAME` | Host inicia jogo |
| `SELECT_PLAYER` | Líder seleciona membro do time |
| `SUBMIT_TEAM` | Líder confirma time |
| `VOTE` | Aprovar/rejeitar time |
| `MISSION_ACTION` | Escolha sucesso/sabotagem |
| `RESTART_GAME` | Iniciar novo jogo |
| `DISCONNECT_VOTE` | Votar encerrar/esperar jogador desconectado |

### Servidor → Cliente
| Mensagem | Propósito |
|----------|-----------|
| `STATE` | Broadcast completo do estado do jogo |
| `ERROR` | Feedback de erro |
| `SESSION_ESTABLISHED` | ID de sessão para reconexão |
| `ROOM_CLOSED` | Sala expirada/fechada |

## Tarefas Comuns de Desenvolvimento

| Tarefa | Onde Procurar |
|--------|---------------|
| Adicionar novo tipo de mensagem | `shared/types.ts`, `server/src/server.ts` |
| Modificar lógica do jogo | `server/src/handlers/gameHandlers.ts` |
| Alterar componente UI | `src/components/` |
| Modificar fase do jogo | `shared/types.ts`, `gameHandlers.ts` |
| Adicionar tradução | `src/i18n.tsx` |
| Mudanças de estilo | `src/index.css`, `tailwind.config.js` |

---

Para documentação detalhada, veja:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Design do sistema
- [SERVER.md](./SERVER.md) - Referência do backend
- [CLIENT.md](./CLIENT.md) - Referência do frontend
- [MESSAGES.md](./MESSAGES.md) - Detalhes do protocolo
- [STATE_MACHINE.md](./STATE_MACHINE.md) - Diagramas de fluxo do jogo
- [TESTING_STATUS.md](./TESTING_STATUS.md) - Cobertura de Testes Atual
