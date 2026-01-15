# Skynet Infiltration Protocol - Quick Overview

> A multiplayer online social deduction game inspired by **The Resistance** with a **Terminator** theme.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | TailwindCSS 4 |
| Backend | PartyKit (serverless WebSocket) |
| Deploy | Vercel + PartyKit Cloud |

## Project Structure

```
resist/
├── src/                          # React Frontend
│   ├── App.tsx                   # Main component, routing, state
│   ├── views/                    # Page components
│   │   ├── HomeView.tsx          # Landing page
│   │   ├── SetupView.tsx         # Name/room setup
│   │   ├── LobbyView.tsx         # Pre-game lobby
│   │   ├── GameView.tsx          # Main game screen
│   │   ├── BrowseRoomsView.tsx   # Public rooms list
│   │   └── ReconnectView.tsx     # Reconnection handling
│   ├── components/               # Reusable UI components
│   │   ├── PlayerCard.tsx        # Player avatar/info display
│   │   ├── MissionTracker.tsx    # Mission progress circles
│   │   ├── VoteTracker.tsx       # Failed votes indicator
│   │   ├── TimerCircle.tsx       # Countdown timer
│   │   └── LanguageSelector.tsx  # i18n toggle
│   ├── hooks/
│   │   └── usePartySocket.ts     # WebSocket connection + reconnection
│   └── i18n.tsx                  # Translations (PT-BR, EN)
│
├── server/src/                   # PartyKit Backend
│   ├── server.ts                 # Main ResistServer class
│   ├── handlers/
│   │   ├── joinHandler.ts        # JOIN, LEAVE, REMOVE_PLAYER
│   │   ├── gameHandlers.ts       # START, VOTE, MISSION, etc.
│   │   ├── disconnectHandlers.ts # Pause/resume, disconnect vote
│   │   └── timerHandlers.ts      # Timer start/cancel/pause/resume
│   ├── game/state.ts             # State utilities (logs, player lookup)
│   ├── registry.ts               # Public rooms registry
│   └── utils/crypto.ts           # UUID, shuffle
│
└── shared/types.ts               # Shared TypeScript types
```

## Game Domain

### Roles
- `HUMAN` (Resistance) - Complete 3 missions to win
- `TERMINATOR` (Skynet) - Sabotage 3 missions to win

### Phases (State Machine)
```
LOBBY → TEAM_SELECTION ⟷ TEAM_VOTE → MISSION_EXECUTION → GAME_OVER
                                          ↓
                              PAUSED_DISCONNECT ⟷ DISCONNECT_VOTE
```

| Phase | Description |
|-------|-------------|
| `LOBBY` | Waiting for players, host configures game |
| `TEAM_SELECTION` | Leader selects team for mission |
| `TEAM_VOTE` | All players vote to approve/reject team |
| `MISSION_EXECUTION` | Team members choose success/sabotage |
| `GAME_OVER` | Game ended, winner declared |
| `PAUSED_DISCONNECT` | Player disconnected, waiting for reconnect |
| `DISCONNECT_VOTE` | Voting whether to end or wait |

### Win Conditions
- **Humans win**: 3 successful missions
- **Terminators win**: 3 failed missions OR 5 consecutive team rejections

## Key Types (shared/types.ts)

```typescript
enum Role { HUMAN, TERMINATOR }
enum Phase { LOBBY, TEAM_SELECTION, TEAM_VOTE, MISSION_EXECUTION, GAME_OVER, PAUSED_DISCONNECT, DISCONNECT_VOTE }

interface Player { id, name, role, isHost, avatarSeed, sessionId?, disconnected?, isSpectator? }
interface Mission { roundNumber, requiredPlayers, requiresTwoFails, status, team, votes, missionOutcomes }
interface GameState { phase, players, roomCode, missions, leaderIndex, proposedTeam, ... }
```

## Message Protocol

### Client → Server
| Message | Purpose |
|---------|---------|
| `JOIN` | Join/create room |
| `START_GAME` | Host starts game |
| `SELECT_PLAYER` | Leader selects team member |
| `SUBMIT_TEAM` | Leader confirms team |
| `VOTE` | Approve/reject team |
| `MISSION_ACTION` | Success/sabotage choice |
| `RESTART_GAME` | Start new game |
| `DISCONNECT_VOTE` | Vote to end/wait for disconnected player |

### Server → Client
| Message | Purpose |
|---------|---------|
| `STATE` | Full game state broadcast |
| `ERROR` | Error feedback |
| `SESSION_ESTABLISHED` | Session ID for reconnection |
| `ROOM_CLOSED` | Room expired/closed |

## Common Development Tasks

| Task | Where to Look |
|------|---------------|
| Add new message type | `shared/types.ts`, `server/src/server.ts` |
| Modify game logic | `server/src/handlers/gameHandlers.ts` |
| Change UI component | `src/components/` |
| Modify game phase | `shared/types.ts`, `gameHandlers.ts` |
| Add translation | `src/i18n.tsx` |
| Styling changes | `src/index.css`, `tailwind.config.js` |

---

For detailed documentation, see:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [SERVER.md](./SERVER.md) - Backend reference
- [CLIENT.md](./CLIENT.md) - Frontend reference
- [MESSAGES.md](./MESSAGES.md) - Protocol details
- [STATE_MACHINE.md](./STATE_MACHINE.md) - Game flow diagrams
