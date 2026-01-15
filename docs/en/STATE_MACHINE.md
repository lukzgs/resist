# Game State Machine

Complete documentation of game phases, transitions, and timer behavior.

## Phase Diagram

```mermaid
stateDiagram-v2
    [*] --> LOBBY: Room created
    
    LOBBY --> TEAM_SELECTION: START_GAME (5-10 players)
    
    TEAM_SELECTION --> TEAM_VOTE: SUBMIT_TEAM
    TEAM_SELECTION --> PAUSED_DISCONNECT: Player disconnects
    
    TEAM_VOTE --> MISSION_EXECUTION: Team approved
    TEAM_VOTE --> TEAM_SELECTION: Team rejected (< 5 rejections)
    TEAM_VOTE --> GAME_OVER: 5 rejections (Terminators win)
    TEAM_VOTE --> PAUSED_DISCONNECT: Player disconnects
    
    MISSION_EXECUTION --> TEAM_SELECTION: Mission complete (< 3 wins/fails)
    MISSION_EXECUTION --> GAME_OVER: 3 successes (Humans win)
    MISSION_EXECUTION --> GAME_OVER: 3 failures (Terminators win)
    MISSION_EXECUTION --> PAUSED_DISCONNECT: Player disconnects
    
    PAUSED_DISCONNECT --> DISCONNECT_VOTE: Timeout or max attempts
    PAUSED_DISCONNECT --> TEAM_SELECTION: Player reconnects
    PAUSED_DISCONNECT --> TEAM_VOTE: Player reconnects
    PAUSED_DISCONNECT --> MISSION_EXECUTION: Player reconnects
    
    DISCONNECT_VOTE --> GAME_OVER: Majority votes END
    DISCONNECT_VOTE --> TEAM_SELECTION: Majority votes WAIT + reconnected
    DISCONNECT_VOTE --> TEAM_VOTE: Majority votes WAIT + reconnected
    DISCONNECT_VOTE --> MISSION_EXECUTION: Majority votes WAIT + reconnected
    
    GAME_OVER --> LOBBY: RESTART_GAME
    GAME_OVER --> [*]: Room expires (5 min)
```

## Phase Details

### LOBBY
**Entry**: Room creation  
**Exit**: Host calls START_GAME with 5-10 players

| Allowed Actions | Actor |
|-----------------|-------|
| JOIN | Any |
| LEAVE_ROOM | Any |
| REMOVE_PLAYER | Host |
| SET_ANONYMOUS_VOTES | Host |
| SET_SHOW_REJECTION_COUNT | Host |
| SET_PUBLIC | Host |
| START_GAME | Host |

---

### TEAM_SELECTION
**Entry**: Game start or previous team rejected/mission complete  
**Exit**: Leader submits valid team

| Allowed Actions | Actor |
|-----------------|-------|
| SELECT_PLAYER | Current leader |
| SUBMIT_TEAM | Current leader |

**Timer**: `teamSelectionSeconds` (if enabled)  
**Timer Expiry**: Random team selected, auto-submit

---

### TEAM_VOTE
**Entry**: Leader submits team  
**Exit**: All players vote

| Allowed Actions | Actor |
|-----------------|-------|
| VOTE | All non-spectators (once each) |

**Timer**: `teamVoteSeconds` (if enabled)  
**Timer Expiry**: Non-voters auto-reject

**Outcome Calculation**:
```
approved = approvals > (playerCount / 2)
```

---

### MISSION_EXECUTION
**Entry**: Team approved  
**Exit**: All team members act

| Allowed Actions | Actor |
|-----------------|-------|
| MISSION_ACTION | Team members only (once each) |

**Timer**: `missionVoteSeconds` (if enabled)  
**Timer Expiry**: Non-actors auto-succeed

**Rules**:
- Humans MUST choose success
- Terminators can choose success or sabotage
- Mission fails if: `fails >= (requiresTwoFails ? 2 : 1)`

---

### PAUSED_DISCONNECT
**Entry**: Active player disconnects during game  
**Exit**: Player reconnects or timeout

| Tracking | Value |
|----------|-------|
| `disconnectInfo.pausedPhase` | Phase to return to |
| `disconnectInfo.pausedTimerRemainingMs` | Remaining timer (if any) |
| `disconnectInfo.waitingAttempt` | 1, 2, or 3 |

**Timeouts**:
- Attempt 1: 30 seconds
- Attempt 2: 30 seconds
- Attempt 3: 60 seconds
- After 3 attempts → DISCONNECT_VOTE

---

### DISCONNECT_VOTE
**Entry**: Max reconnect attempts exhausted  
**Exit**: Majority votes

| Allowed Actions | Actor |
|-----------------|-------|
| DISCONNECT_VOTE | All non-spectators |

**Options**:
- `endGame: true` - End game immediately
- `endGame: false` - Wait for player (30 more seconds)

---

### GAME_OVER
**Entry**: Win condition or vote to end  
**Exit**: Host restarts or room expires

| Allowed Actions | Actor |
|-----------------|-------|
| RESTART_GAME | Host |

**Room Expiry**: 5 minutes after game over

---

## Leader Rotation

```mermaid
graph LR
    A[Player 1] --> B[Player 2]
    B --> C[Player 3]
    C --> D[...]
    D --> A
```

Leader advances to next **active** (non-spectator, non-disconnected) player when:
1. Team is rejected
2. Mission completes

---

## Mission Requirements by Player Count

| Players | Terminators | M1 | M2 | M3 | M4 | M5 |
|:-------:|:-----------:|:--:|:--:|:--:|:--:|:--:|
| 5 | 2 | 2 | 3 | 2 | 3 | 3 |
| 6 | 2 | 2 | 3 | 4 | 3 | 3 |
| 7 | 3 | 2 | 3 | 3 | 4* | 4 |
| 8 | 3 | 3 | 4 | 4 | 5* | 5 |
| 9 | 3 | 3 | 4 | 4 | 5* | 5 |
| 10 | 4 | 3 | 4 | 4 | 5* | 5 |

*\* Requires 2 sabotages to fail*

---

## Timer Behavior

```mermaid
graph TD
    A[Timer Started] --> B{Action Completed?}
    B -->|Yes| C[Timer Cancelled]
    B -->|No| D{Player Disconnected?}
    D -->|Yes| E[Timer Paused]
    D -->|No| F{Timeout?}
    F -->|Yes| G[Auto-action triggered]
    F -->|No| B
    E --> H{Player Reconnected?}
    H -->|Yes| I[Timer Resumed]
    H -->|No| E
    I --> B
```

| Timer Type | Duration Range | Auto-Action |
|------------|---------------|-------------|
| `team_selection` | 30-120s | Random team, auto-submit |
| `team_vote` | 30-120s | Non-voters reject |
| `mission_vote` | 5-120s | Non-actors succeed |

---

See also:
- [MESSAGES.md](./MESSAGES.md) - Message protocol details
- [SERVER.md](./SERVER.md) - Handler implementations
