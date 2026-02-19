# Issues Conhecidas do Projeto

> Lista rastreável de problemas técnicos identificados. Atualizar conforme forem resolvidos.
>
> Referência: [CODE_QUALITY_REPORT.md](file:///home/lukzgs/projects/resist/docs/pt-br/CODE_QUALITY_REPORT.md)

---

## Prioridade Alta 🔴

### ~~1. `GameView.tsx` — Componente Gigante (SRP)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

### ~~2. Acessos Profundos a Objetos (Lei de Demeter)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

---

## Prioridade Média 🟡

### ~~3. `server.ts` — Switch/Case Gigante (OCP)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

### 4. `GameHandlerContext` — Interface Muito Ampla (ISP)
- **Arquivo**: `server/src/handlers/gameHandlers.ts`
- **Princípio violado**: ISP (Interface Segregation)
- **Descrição**: Passa todo o poder do servidor (room, broadcast, scheduleRoomClosure) para qualquer handler, mesmo os simples como `vote`.
- **Correção**: Criar interfaces menores: `VoteContext`, `ConnectionContext`.

### ~~5. Frontend Sem Guard Clauses (Fail Fast)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

### 6. Estilos Tailwind Repetidos (DRY)
- **Arquivos**: `src/views/*`, `src/components/*`
- **Princípio violado**: DRY
- **Descrição**: Combinações como `bg-black/40 border border-white/5 backdrop-blur-sm` copiadas em múltiplos componentes.
- **Correção**: Extrair classes utilitárias para `index.css` (`.glass-panel`, etc).

---

## Prioridade Baixa 🟢

### ~~7. `state.ts` — Mistura de Dados e Config (SRP)~~ ✅ Resolvido
- Movido para tabela de resolvidos abaixo.

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
| ~~2~~ | Acessos profundos (Lei de Demeter) | Criado `shared/stateHelpers.ts` com `getLeader()` e `getCurrentMission()`, 17 acessos substituídos | 2026-02-20 |
| ~~3~~ | `server.ts` switch/case gigante (OCP) | Criado `messageRouter.ts` com mapa de despachante + `handleSetPublic.ts` | 2026-02-20 |
| ~~5~~ | Frontend sem guard clauses (Fail Fast) | `getLeader()` retorna `Player \| undefined`, guards em 4 consumidores | 2026-02-20 |
| ~~7~~ | `state.ts` mistura dados e config (SRP) | Extraído `DEFAULT_TIMER_CONFIG` constante | 2026-02-20 |
