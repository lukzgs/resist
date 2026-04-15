# Server Reference

Detailed documentation for the PartyKit backend server.

## File Structure

```
server/src/
├── server.ts           # Main ResistServer class
├── types.ts            # Re-exports shared types
├── registry.ts         # Public rooms registry
├── handlers/
│   ├── index.ts        # Handler exports
│   ├── joinHandler.ts  # JOIN, LEAVE, REMOVE
│   ├── gameHandlers.ts # Core game actions
│   ├── disconnectHandlers.ts  # Pause/reconnect
│   └── timerHandlers.ts       # Timer management
├── game/
│   └── state.ts        # State utilities
└── utils/
    └── crypto.ts       # UUID, shuffle
```

---

## ResistServer Class

Main server class extending PartyKit's `Party.Server`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `gameState` | `GameState \| null` | Current game state |
| `connections` | `Map<string, string>` | connectionId → playerId |
| `disconnectedPlayers` | `Map<string, Timeout>` | playerId → reconnect timer |
| `gracePeriodTimers` | `Map<string, Timeout>` | playerId → grace period timer (25s before pausing) |
| `gameOverTimeout` | `Timeout \| null` | Room expiry timer |

### Lifecycle Methods

#### onStart()
Called when room starts or wakes from hibernation.
- Loads state from PartyKit storage
- Restores connections map
- Schedules expiration check

#### onConnect(conn, ctx)
Called when client connects.
- Stores connection
- Later mapped to player via JOIN

#### onClose(conn)
Called when client disconnects.
- Marks player as disconnected
- Starts **grace period** (25s) before pausing game
- If player reconnects within grace period, game continues uninterrupted
- Only after grace period, triggers `PAUSED_DISCONNECT` phase

#### onMessage(message, sender)
Routes messages to appropriate handlers.
- Parses JSON message
- Validates message type
- Calls handler function

#### onAlarm()
Called by PartyKit alarm system.
- Checks room expiration
- Handles timer expiry
- Processes disconnect timeouts

---

## Handler Functions

### joinHandler.ts

#### handleJoin(ctx, conn, data)
Process JOIN message.

```typescript
// Flow:
1. Validate name (1-20 chars, sanitized)
2. Check if reconnecting (sessionId match)
3. If reconnecting:
   - Restore player connection
   - Resume game if was paused
4. If new:
   - Create player object
   - Assign as host if first
   - Check spectator status (game in progress)
5. Generate/return sessionId
6. Broadcast state
```

#### handleLeaveRoom(ctx, conn)
Process voluntary leave.

#### handleRemovePlayer(ctx, conn, playerId)
Host kicks player (lobby only).

---

### gameHandlers.ts

#### handleToggleSpectator(ctx, conn, targetPlayerId?)
Toggle spectator status of a player.

```typescript
// Requirements:
- Phase must be LOBBY
- Sender must be in the room
- If toggling another player, sender must be the host
- Host cannot become a spectator

// Actions:
1. Identify target player
2. Toggle isSpectator flag
3. Broadcast state
```

#### handleTransferHost(ctx, conn, targetPlayerId)
Transfers the host role to another player.

```typescript
// Requirements:
- Phase must be LOBBY
- Sender must be the host
- Target must not be a spectator

// Actions:
1. Target player becomes host
2. Sender loses host status
3. Broadcast state
```

#### handleStartGame(ctx, conn)
Start the game.

```typescript
// Requirements:
- Phase must be LOBBY
- Sender must be host
- 5-10 connected players

// Actions:
1. Get rules for player count
2. Shuffle and assign roles
3. Create mission objects
4. Set initial leader (random)
5. Transition to TEAM_SELECTION
6. Start timer (if enabled)
```

#### handleSelectPlayer(ctx, conn, playerId)
Toggle player in proposed team.

```typescript
// Requirements:
- Phase must be TEAM_SELECTION
- Sender must be current leader

// Actions:
1. If player in team → remove
2. If not in team AND team not full → add
```

#### handleSubmitTeam(ctx, conn)
Confirm team selection.

```typescript
// Requirements:
- Phase must be TEAM_SELECTION
- Sender must be current leader
- Team size must match mission requirement

// Actions:
1. Clear previous votes
2. Transition to TEAM_VOTE
3. Start vote timer (if enabled)
```

#### handleVote(ctx, conn, approve)
Vote on team.

```typescript
// Requirements:
- Phase must be TEAM_VOTE
- Sender must be non-spectator
- Sender hasn't voted yet

// Actions:
1. Record vote
2. If all voted:
   - Count approvals
   - approved = approvals > playerCount/2
   - If approved → MISSION_EXECUTION
   - If rejected:
     - Increment failedVoteCount
     - If 5 rejections → GAME_OVER (Terminators win)
     - Else → TEAM_SELECTION, next leader
```

#### handleMissionAction(ctx, conn, success)
Execute mission action.

```typescript
// Requirements:
- Phase must be MISSION_EXECUTION
- Sender must be team member
- Sender hasn't acted yet

// Special rules:
- Humans → always success (forced)
- Terminators → can choose

// Actions:
1. Record outcome
2. If all acted:
   - Count fails
   - fail = fails >= (requiresTwoFails ? 2 : 1)
   - Update mission status
   - Check win conditions
   - If no winner → next mission, next leader
```

---

### disconnectHandlers.ts

#### handlePlayerDisconnect(ctx, playerId)
Called when player connection closes.

```typescript
// Actions:
1. Mark player as disconnected
2. If game active and non-spectator:
   - Start grace period (25s)
   - If player reconnects within grace period → game continues
   - If grace period expires → pause game, start reconnect timeout
   - Guard Rail: stores original pausedPhase if transiting from another pause
```

#### handlePlayerReconnect(ctx, playerId)
Called when player rejoins.

```typescript
// Actions:
1. Clear reconnect timeout
2. Restore player state
3. If game was paused for this player:
   - Resume to pausedPhase explicitly
   - Resume timer (if was running)
4. Broadcast individualized state mapping (playerId injected for role visibility)
```

#### handleDisconnectVote(ctx, conn, endGame)
Vote to end or wait.

```typescript
// Requirements:
- Phase must be DISCONNECT_VOTE
- Sender must be non-spectator

// Actions:
1. Record vote
2. If all voted:
   - Calculate result
   - If majority END → GAME_OVER
   - If majority WAIT → Wait longer, or resume if reconnected
```

---

### timerHandlers.ts

#### startTimer(ctx, timerType)
Start countdown timer.

```typescript
// Sets:
- gameState.currentTimerEndsAt = now + duration
- gameState.currentTimerType = timerType
- Schedules alarm
```

#### cancelTimer(ctx)
Cancel active timer.

#### pauseTimer(ctx)
Pause timer (store remaining time).

#### resumeTimer(ctx)
Resume paused timer.

#### handleTimerExpiry(ctx, timerType)
Called when timer expires.

```typescript
// Per timer type:
- team_selection: Auto-select random team, submit
- team_vote: Non-voters auto-reject
- mission_vote: Non-actors auto-succeed
```

---

## State Utilities (game/state.ts)

| Function | Description |
|----------|-------------|
| `addLog(state, msg)` | Add log entry (max 100) |
| `getPlayerByConnection(state, conns, connId)` | Find player by connection |
| `getActivePlayers(state)` | Non-spectator, non-disconnected |
| `getSanitizedState(state, targetPlayerId)` | Scrub state for the receiver: masks non-terminators as UNKNOWN, calculates hasVoted, shields anonymous votes. |

---

## Registry (registry.ts)

Separate PartyKit room managing public room list.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/parties/registry/main` | GET | List public rooms |
| `/parties/registry/main` | POST | Update room info |

---

## Security

### Rate Limiting
Applied in `onMessage`:
- Max 30 messages per minute per connection
- Excess messages silently dropped

### Input Validation
All message payloads validated:
- Name: 1-20 chars, HTML entities stripped
- IDs: Must exist in state
- Booleans: Coerced from truthy/falsy

### Session Security
- Session IDs: UUID v4, server-generated
- Stored per-player, validated on reconnect
- No client-generated sessions accepted

---

## Deployment

To deploy the server to the PartyKit cloud environment:

```bash
cd server
npx partykit deploy
```

This will deploy `src/server.ts` to `https://resist-server.lukzgs.partykit.dev`.

## Observability Planning: Events & Slack Logger (Upcoming Feature)

Currently, system events utilize the traditional terminal structure. One of the scheduled steps is the creation of an **Event Bus** that will send essential match alerts to a Slack workspace channel. The system will be designed ensuring loose coupling for testability.

**Where it fits in the Backend:**
- **Location:** `server/src/utils/logger.ts` encapsulating formatting logic (Game Over Messages, Expiring Rooms, Unexpected Errors).
- **How it operates:** During *Handlers* (e.g., when sending a broadcast reporting a Skynet Victory), our Server will instantiate the `SlackLogger` class, executing an HTTP request via `.fetch()` to a "Secret Webhook URL" provided in the `.env` environment variables.
- **Silent Mode**: If the environment lacks the secret webhook URL in `.env`, the service will gracefully return and generate a decorated local console log instead. This architecture leaves the environment ready to scale without creating bots that lock or flood your serverless script memory.

---

See also:
- [MESSAGES.md](./MESSAGES.md) - Protocol details
- [STATE_MACHINE.md](./STATE_MACHINE.md) - Phase logic
