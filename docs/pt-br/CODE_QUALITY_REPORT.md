# Relatório de Auditoria de Qualidade de Código (v2)

Análise técnica do projeto **Resist**, cobrindo **SOLID**, **Clean Code** (DRY, KISS, YAGNI), **Lei de Demeter**, **Fail Fast** e **Composição sobre Herança**.

| Meta | Valor |
|------|-------|
| Data | 2026-02-19 |
| Escopo | 100% dos arquivos (`src/`, `server/`, `shared/`) |
| Versão anterior | 2026-02-15 |

> [!NOTE]
> Itens marcados com ~~tachado~~ foram corrigidos desde o último relatório.

---

## 1. Princípios SOLID

### SRP (Princípio da Responsabilidade Única)

| Arquivo | Linhas | Status | Diagnóstico |
|---------|--------|--------|-------------|
| `GameView.tsx` | 690 | 🔴 Aberto | Gerencia UI de 5 fases, drag-and-drop do log, e desenha modais. |
| ~~`usePartySocket.ts`~~ | ~~686~~ → 511 | ✅ Parcial | Sessão extraída p/ `useSession.ts` (111L), ações p/ `useGameActions.ts` (79L). Ainda mistura conexão WebSocket + reconexão + health check. |
| `state.ts` | 82 | 🟡 Menor | `createInitialState` define dados voláteis e configs padrão de timer juntos. |

**O que ainda falta:**

*   🔴 **`GameView.tsx` (690 linhas)** — maior violação de SRP do projeto.
    *   Gerencia: fases do jogo (5), drag-and-drop de log flutuante, timers, revelação de votos.
    *   **Correção**: Extrair `<TeamSelectionPhase />`, `<VotingPhase />`, `<MissionPhase />`, e `<DraggableLog />`.

*   � **`server.ts` (725 linhas)** — O `onMessage` é um `switch` gigante que despacha para handlers. Funciona, mas viola SRP ao ser responsável por parsing + despacho + broadcast.

---

### OCP (Aberto/Fechado)

*   🟡 **`server.ts` — `switch/case`**: Adicionar um novo tipo de mensagem exige modificar o `switch` no `server.ts` e criar um handler. Não é aberto para extensão.
    *   **Melhoria sugerida**: Mapa de despachante (`Map<MessageType, Handler>`) para registrar novos comandos sem tocar no `server.ts`.
*   🟢 **Handlers individuais** (`handleVote`, `handleMissionAction`, etc.) são bem isolados e substituíveis.

### LSP (Substituição de Liskov)

*   🟢 **Sem violações**. O projeto usa TypeScript com interfaces, sem herança de classes. `Party.Server` é implementado corretamente por `ResistServer` e `RegistryServer`.

### ISP (Segregação de Interface)

*   🟡 **`GameHandlerContext`** — Passa todo o poder do servidor (room, gameState, connections, broadcast, scheduleRoomClosure) para qualquer handler. Um handler simples como `vote` não precisa de `scheduleRoomClosure`.
    *   **Melhoria sugerida**: Criar interfaces menores (`VoteContext`, `ConnectionContext`).

### DIP (Inversão de Dependência)

*   🟢 **Ponto forte**: O servidor injeta estado e callbacks nos handlers. Facilita testes unitários.
*   ✅ **Melhoria recente**: `useGameActions.ts` recebe `send` como dependência injetada (DIP puro).

---

## 2. Clean Code & Práticas

### DRY (Don't Repeat Yourself)

| Item | Status | Detalhes |
|------|--------|----------|
| ~~Limites de Timer~~ | ✅ Corrigido | Centralizados em `shared/constants.ts` → `TIMER_LIMITS`. Usados em `LobbyView.tsx` e `timerHandlers.ts`. |
| ~~Regras do Jogo~~ | ✅ Corrigido | `GAME_RULES_BY_COUNT` em `shared/constants.ts`. Antes havia cópia em `shared/types.ts`. |
| ~~`MIN_MISSIONS_TO_WIN`~~ | ✅ Corrigido | Antes era `3` hardcoded em `timerHandlers.ts`. Agora usa a constante. |
| Estilos Tailwind | 🟡 Aberto | Strings como `bg-black/40 border border-white/5 backdrop-blur-sm` são repetidas em views. Não é crítico, mas poderia usar classes utilitárias no `index.css`. |

### S.S.O.T. (Single Source of Truth)

*   🟢 **`shared/types.ts`** — Fonte única para tipos (`GameState`, `Phase`, `Role`). Frontend e backend importam dele.
*   🟢 **`shared/constants.ts`** — ✅ Nova fonte única para configurações (`TIMER_LIMITS`, `GAME_RULES_BY_COUNT`, `MIN_MISSIONS_TO_WIN`).
*   🟢 **`src/constants.ts`** — Re-exporta `GAME_RULES_BY_COUNT` como `GAME_RULES` para compatibilidade do frontend.

### KISS (Keep It Simple)

| Item | Status | Detalhes |
|------|--------|----------|
| ~~`PlayerCard.tsx`~~ | ✅ Corrigido | Antes: cascata `if/else` com variáveis `let` mutáveis. Agora: função pura `resolveCardStyle()` que mapeia estado → estilos sem mutação. |
| `GameView.tsx` | 🔴 Aberto | Lógica de drag-and-drop (linhas 72-177) misturada com lógica de fase do jogo. Complexidade desnecessária no mesmo componente. |

### YAGNI (You Aren't Gonna Need It)

*   🟡 **Dupla persistência (localStorage + Cookie)** em `useSession.ts` — Implementa fallback para Cookie visando iOS Safari. Dado o histórico real de bugs no iOS (documentado em conversas anteriores), **é justificado**. Não é YAGNI.

### Lei de Demeter

*   🔴 **Acessos profundos a objetos** — Ainda presente em 25+ locais:

    ```typescript
    // Padrão recorrente no frontend e servidor:
    state.players[state.leaderIndex].name     // 2 ocorrências no GameView
    ctx.gameState.players[ctx.gameState.leaderIndex]  // 5 ocorrências nos handlers
    ctx.gameState.missions[missionIndex].votes[player.id]  // 10 ocorrências
    ```

    **Correção sugerida**: Criar helpers no `state.ts`:
    ```typescript
    export function getLeader(state: GameState): Player { ... }
    export function getCurrentMission(state: GameState): Mission { ... }
    ```

### Fail Fast

*   🟢 **Handlers do servidor**: Verificam pré-condições no topo (`if (phase !== TEAM_VOTE) return`).
*   � **Frontend**: `state.players[state.leaderIndex]` na linha 24 do `GameView.tsx` pode ser `undefined` se o índice estiver inconsistente. Deveria ter guard clause.

### Composição > Herança

*   🟢 **React**: Componentes funcionais com composição. Zero herança de classes.
*   🟡 **Oportunidade**: `GameView` deveria aceitar o componente de fase como render prop ou children, em vez de chavear tudo internamente com if/else.

---

## 3. Riscos Críticos

| # | Risco | Status |
|---|-------|--------|
| 1 | ~~Variável global `activeTimers` no módulo `timerHandlers.ts`~~ | ✅ **Corrigido** — Movida para propriedade da instância `ResistServer` (L78 do `server.ts`). Passada via `ctx.activeTimers`. |
| 2 | `cleanupTimers` agora recebe o `Map` como parâmetro | ✅ Correto — Assinatura: `cleanupTimers(activeTimers, roomCode)`. |

---

## 4. Scorecard

| Princípio | Antes (15/02) | Agora (19/02) | Δ |
|-----------|---------------|---------------|---|
| SRP | 🔴 3 violações | 🟡 1.5 violações | ↑ |
| OCP | 🟡 | 🟡 | = |
| LSP | 🟢 | 🟢 | = |
| ISP | 🟡 | 🟡 | = |
| DIP | 🟢 | 🟢+ | ↑ |
| DRY | 🔴 2 violações | 🟡 1 menor | ↑↑ |
| KISS | 🔴 | 🟡 | ↑ |
| YAGNI | 🟡 | 🟢 (justificado) | ↑ |
| Demeter | 🔴 | 🔴 | = |
| Fail Fast | 🟡 | 🟡 | = |
| Composição | 🟢 | 🟢 | = |
| **Risco Crítico** | 🔴 1 | ✅ 0 | ↑↑ |

---

## 5. Próximos Passos (Plano de Ação)

1. **Curto Prazo — SRP do `GameView.tsx`**: Extrair componentes de fase (`TeamSelectionPhase`, `VotingPhase`, `MissionPhase`, `DraggableLog`). Maior ganho de manutenibilidade.
2. **Curto Prazo — Lei de Demeter**: Criar helpers `getLeader()`, `getCurrentMission()` em `state.ts` e usar nos handlers e views.
3. **Médio Prazo — OCP do `server.ts`**: Substituir `switch/case` por mapa de despachante para facilitar extensão.
4. **Baixa Prioridade — DRY Tailwind**: Extrair classes utilitárias recorrentes para o `index.css`.
