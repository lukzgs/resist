# Test Coverage Status

This document maps the progress of our automated test coverage of the Skynet Protocol and outlines what still needs to be implemented, along with technical reasoning.

## 🟢 Implemented Tests (Completed)

The core infrastructure utilizing Vitest and React Testing Library is fully setup.

- **`LanguageSelector.test.tsx` (Component Test)**
  - **Location**: `src/__tests__/components/LanguageSelector.test.tsx`
  - **What it does**: Ensures the component renders, the texts "PT/EN" are present, and that user clicks don't break the application rendering state.
- **`HomeView.test.tsx` (View/Screen Test)**
  - **Location**: `src/__tests__/views/HomeView.test.tsx`
  - **What it does**: Renders the complete interface with the translation provider, searches for the user-facing "CREATE ROOM" button, and verifies that the routing callback function responds correctly.

---

## 🔴 Missing Tests (Next Steps)

To guarantee the integrity of an online social deduction multiplayer game, the following interfaces require testing:

### 1. Game Screens and Components (Frontend)
- **`LobbyView` Components** (e.g., `PlayerCard`)
  - **Why we need them**: To gain visual certainty that players (Host, Disconnected, Spectators) receive their respective correct UI badges conditionally rendered.
- **`GameView` Components** (e.g., `VoteTracker`, `PhaseControls`, `MissionTracker`)
  - **Why we need them**: The heart of the interactive game loop. We must simulate clicks on "Sabotage" to ensure the buttons get correctly blocked from double-click fraud and accurately fire the submit callbacks.

### 2. State Machine and Game Rules (Backend / PartyKit)
- **Global Balancing Rules Validation (`server/src/utils`)**
  - **Why we need them**: For a room with 7 players, the code must correctly compute `4 Resistance and 3 Skynet`. Pure raw unit tests prevent human-errors breaking hard-coded bounds of the actual game proportions.
- **State Machine and Handlers (`gameHandlers.ts` / `disconnectHandlers.ts`)**
  - **Why we need them**: The game states are Authoritative. We need to instantiate a fake Lobby with 5 users proposing votes, to assure that the backend perfectly evaluates the condition without socket overhead and flawlessly switches the game phase correctly.
