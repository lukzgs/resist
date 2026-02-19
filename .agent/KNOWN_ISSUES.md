# Issues Conhecidas do Projeto

> Lista rastreável de problemas técnicos identificados. Atualizar conforme forem resolvidos.
>
> Referência: [CODE_QUALITY_REPORT.md](file:///home/lukzgs/projects/resist/docs/pt-br/CODE_QUALITY_REPORT.md)

---

## Prioridade Alta 🔴

### ~~1. `GameView.tsx` — Componente Gigante (SRP)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

### 2. Acessos Profundos a Objetos (Lei de Demeter)
- **Arquivos**: `GameView.tsx`, `gameHandlers.ts`, `timerHandlers.ts`, `joinHandler.ts`
- **Princípio violado**: Lei de Demeter
- **Descrição**: 25+ ocorrências de acessos como `ctx.gameState.players[ctx.gameState.leaderIndex].name` e `ctx.gameState.missions[index].votes[player.id]`.
- **Impacto**: Se a estrutura de `GameState` mudar, 25+ locais quebram.
- **Correção**: Criar helpers em `server/src/game/state.ts`: `getLeader(state)`, `getCurrentMission(state)`.

---

## Prioridade Média 🟡

### 3. `server.ts` — Switch/Case Gigante (OCP)
- **Arquivo**: `server/src/server.ts` (725 linhas)
- **Princípio violado**: OCP (Open/Closed)
- **Descrição**: O `onMessage` usa um `switch` case para despachar mensagens. Adicionar novo tipo requer modificar o switch.
- **Correção**: Substituir por mapa de despachante (`Map<MessageType, Handler>`).

### 4. `GameHandlerContext` — Interface Muito Ampla (ISP)
- **Arquivo**: `server/src/handlers/gameHandlers.ts`
- **Princípio violado**: ISP (Interface Segregation)
- **Descrição**: Passa todo o poder do servidor (room, broadcast, scheduleRoomClosure) para qualquer handler, mesmo os simples como `vote`.
- **Correção**: Criar interfaces menores: `VoteContext`, `ConnectionContext`.

### 5. Frontend Sem Guard Clauses (Fail Fast)
- **Arquivo**: `src/views/GameView.tsx` (L24, L431)
- **Princípio violado**: Fail Fast
- **Descrição**: `state.players[state.leaderIndex]` pode ser `undefined` se o índice estiver inconsistente. Sem guard clause, o componente crasha.
- **Correção**: Adicionar `if (!leader) return null;` antes de usar.

### 6. Estilos Tailwind Repetidos (DRY)
- **Arquivos**: `src/views/*`, `src/components/*`
- **Princípio violado**: DRY
- **Descrição**: Combinações como `bg-black/40 border border-white/5 backdrop-blur-sm` copiadas em múltiplos componentes.
- **Correção**: Extrair classes utilitárias para `index.css` (`.glass-panel`, etc).

---

## Prioridade Baixa 🟢

### 7. `state.ts` — Mistura de Dados e Config (SRP)
- **Arquivo**: `server/src/game/state.ts` (82 linhas)
- **Descrição**: `createInitialState` define dados voláteis e configs padrão de timer juntos.
- **Correção**: Separar configs em objeto `defaultTimerConfig`.

### ~~8. `GameView` — Composição (Composição > Herança)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

---

## ✅ Resolvidos

| # | Issue | Correção | Data |
|---|-------|----------|------|
| ~~9~~ | `activeTimers` global no módulo (Risco Crítico) | Movido para instância `ResistServer` | 2026-02-19 |
| ~~10~~ | Timer limits hardcoded (DRY) | Centralizado em `TIMER_LIMITS` (`shared/constants.ts`) | 2026-02-19 |
| ~~11~~ | Regras do jogo duplicadas (DRY/SSOT) | `GAME_RULES_BY_COUNT` em `shared/constants.ts` | 2026-02-19 |
| ~~12~~ | `PlayerCard.tsx` ternários complexos (KISS) | Refatorado com `resolveCardStyle()` | 2026-02-19 |
| ~~13~~ | `usePartySocket.ts` 686 linhas (SRP) | Extraído `useSession.ts` + `useGameActions.ts` | 2026-02-19 |
| ~~14~~ | `MIN_MISSIONS_TO_WIN` hardcoded | Constante em `shared/constants.ts` | 2026-02-19 |
| ~~15~~ | Bug `LobbyView.tsx` L225 (teamVoteSeconds) | Corrigido: `TL.teamSelectionSeconds` → `TL.teamVoteSeconds` | 2026-02-19 |
| ~~1~~ | `GameView.tsx` 690 linhas (SRP) | Extraído `DraggableLog`, `GameHeader`, `PhaseControls`, `GameOverScreen`, `useVoteReveal` — reduzido para 140L | 2026-02-20 |
| ~~8~~ | `GameView` composição > herança | Resolvido com extração de `PhaseControls` (issue #1) | 2026-02-20 |
