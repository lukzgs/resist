# Best Practices — Regras Obrigatórias para Agentes IA

> **Este arquivo DEVE ser consultado antes de qualquer modificação no código.**
> Ele define as regras de qualidade que o agente IA deve seguir ao escrever ou refatorar código neste projeto.

---

## 1. Princípios SOLID (Aplicados ao Projeto)

### SRP — Responsabilidade Única
- **Componentes React**: Um componente = uma responsabilidade. Se tem >200 linhas, provavelmente faz demais.
- **Hooks**: Separe conexão (`usePartySocket`), sessão (`useSession`) e ações (`useGameActions`).
- **Server handlers**: Cada handler trata um tipo de mensagem. Nunca misture lógica de fases diferentes.
- **Tipos vs Constantes**: `shared/types.ts` = interfaces. `shared/constants.ts` = valores. Nunca misture.

### OCP — Aberto/Fechado
- Prefira **mapas de despachante** (`Map<Type, Handler>`) a blocos `switch/case` ao adicionar novos tipos de mensagem.
- Novos handlers devem ser criados sem modificar os existentes.

### LSP — Substituição de Liskov
- Mantenha interfaces consistentes. Se um componente aceita `Player`, ele deve funcionar com qualquer `Player` válido (ativo, espectador, desconectado).

### ISP — Segregação de Interface
- Não passe o contexto inteiro do servidor para handlers que precisam de pouco. Prefira interfaces menores e focadas.

### DIP — Inversão de Dependência
- Hooks devem receber dependências como parâmetros, não importá-las diretamente.
- Ex: `useGameActions(send)` recebe `send` como callback, em vez de importar o socket.

---

## 2. Clean Code

### Nomes
- Funções: verbos → `getLeader()`, `resolveCardStyle()`, `handleVote()`.
- Variáveis: substantivos descritivos → `activePlayers`, `maxRejections`, `failedVoteCount`.
- Nunca abreviações obscuras. `d` ❌ → `daysSinceUpdate` ✅.

### Funções
- **Pequenas**: <30 linhas idealmente. Se não cabe na tela, extraia.
- **Puras quando possível**: Sem side effects. Ex: `resolveCardStyle()` em `PlayerCard.tsx`.
- **Guard clauses no topo**: Valide pré-condições antes de processar. Fail fast.

### Comentários
- Explique o **porquê**, nunca o **como**. O código explica o como.
- Comentários de seção (`// ─── Tipos ───`) são OK para organizar arquivos longos.

---

## 3. DRY — Não Se Repita

### Regras
- **Constantes compartilhadas** devem viver em `shared/constants.ts`. Nunca hardcode valores que existem lá.
- **Magic numbers**: Proibidos. Toda constante numérica deve ter um nome descritivo.
  - ❌ `if (failedVotes >= 5)`
  - ✅ `if (failedVotes >= rules.maxRejections)`
- **Estilos Tailwind repetidos**: Se a mesma combinação aparece 3+ vezes, considere extrair para `index.css` como classe utilitária.

### Fontes de Verdade (S.S.O.T.)

| Dado | Fonte Única | Localização |
|------|-------------|-------------|
| Tipos do jogo | `GameState`, `Phase`, `Role` | `shared/types.ts` |
| Regras por nº jogadores | `GAME_RULES_BY_COUNT` | `shared/constants.ts` |
| Limites de timer | `TIMER_LIMITS` | `shared/constants.ts` |
| Constantes do jogo | `MIN_MISSIONS_TO_WIN`, etc. | `shared/constants.ts` |

---

## 4. KISS — Mantenha Simples

- Não use abstrações que não simplificam. **Duplicação é mais barata que a abstração errada.**
- Lógica condicional de estilos CSS: use **funções puras** (como `resolveCardStyle()`), não cascatas de `let` + `if/else`.
- Evite over-engineering: não crie factories, builders ou patterns complexos quando uma função simples resolve.

---

## 5. YAGNI — Não Implemente o que Não Precisa

- Não adicione props "para o futuro" em componentes.
- Não crie abstrações genéricas para um único caso de uso.
- Implemente o mínimo que resolve o problema atual.

---

## 6. Lei de Demeter

- **Não acesse objetos profundamente encadeados.** Crie helpers.
  - ❌ `ctx.gameState.players[ctx.gameState.leaderIndex].name`
  - ✅ `getLeader(ctx.gameState).name`
- Helpers de estado devem ficar em `server/src/game/state.ts`.

---

## 7. Fail Fast

- **Server handlers**: Validem pré-condições no topo e retornem cedo.
  ```typescript
  if (ctx.gameState.phase !== Phase.TEAM_VOTE) return;
  ```
- **Frontend**: Nunca assuma que arrays/objetos existem. Use optional chaining ou guard clauses.
  ```typescript
  const leader = state.players[state.leaderIndex];
  if (!leader) return null;
  ```

---

## 8. Composição > Herança

- Componentes React devem usar **composição** (props, children, render props).
- Zero herança de classes. Use funções e hooks.

---

## 9. Padrões Específicos do Projeto

### Estado do Jogo
- Todo estado mutável do servidor pertence à **instância da classe `ResistServer`**, nunca a variáveis globais do módulo.
- Timers → `this.activeTimers` (Map na instância).
- Estado → `this.gameState`.

### WebSocket
- Toda mensagem cliente→servidor deve ser validada com Zod (`server/src/schemas/`).
- Toda mensagem servidor→cliente deve ser tipada com `ServerMessage`.

### Persistência (Cliente)
- Session → `useSession.ts` (localStorage + cookie fallback para iOS).
- Nunca acesse `localStorage` diretamente fora de `useSession.ts`.

---

## 10. Checklist Pré-Modificação

Antes de submeter qualquer mudança, verifique:

- [ ] Nenhum magic number introduzido (use constantes de `shared/constants.ts`)
- [ ] Nenhuma duplicação de lógica existente
- [ ] Componentes/funções com <200 linhas
- [ ] Guard clauses em acessos a arrays/objetos
- [ ] Nomes descritivos em variáveis e funções
- [ ] Tipos importados de `shared/types.ts`, constantes de `shared/constants.ts`
- [ ] Estado do servidor na instância, nunca global
