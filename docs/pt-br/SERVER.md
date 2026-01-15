# Referência do Servidor

Documentação detalhada do servidor backend PartyKit.

## Estrutura de Arquivos

```
server/src/
├── server.ts           # Classe principal ResistServer
├── types.ts            # Re-exporta tipos compartilhados
├── registry.ts         # Registry de salas públicas
├── handlers/
│   ├── index.ts        # Exports dos handlers
│   ├── joinHandler.ts  # JOIN, LEAVE, REMOVE
│   ├── gameHandlers.ts # Ações principais do jogo
│   ├── disconnectHandlers.ts  # Pausar/reconectar
│   └── timerHandlers.ts       # Gerenciamento de timer
├── game/
│   └── state.ts        # Utilitários de estado
└── utils/
    └── crypto.ts       # UUID, shuffle
```

---

## Classe ResistServer

Classe principal do servidor estendendo `Party.Server` do PartyKit.

### Propriedades

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `gameState` | `GameState \| null` | Estado atual do jogo |
| `connections` | `Map<string, string>` | connectionId → playerId |
| `disconnectedPlayers` | `Map<string, Timeout>` | playerId → timer reconexão |
| `gracePeriodTimers` | `Map<string, Timeout>` | playerId → timer grace period (25s antes de pausar) |
| `gameOverTimeout` | `Timeout \| null` | Timer expiração da sala |

### Métodos de Ciclo de Vida

#### onStart()
Chamado quando sala inicia ou acorda da hibernação.
- Carrega estado do storage PartyKit
- Restaura mapa de conexões
- Agenda verificação de expiração

#### onConnect(conn, ctx)
Chamado quando cliente conecta.
- Armazena conexão
- Mapeado para jogador via JOIN depois

#### onClose(conn)
Chamado quando cliente desconecta.
- Marca jogador como desconectado
- Inicia **grace period** (25s) antes de pausar o jogo
- Se jogador reconectar no grace period, jogo continua sem interrupção
- Apenas após grace period, entra na fase `PAUSED_DISCONNECT`

#### onMessage(message, sender)
Roteia mensagens para handlers apropriados.
- Faz parse da mensagem JSON
- Valida tipo de mensagem
- Chama função handler

#### onAlarm()
Chamado pelo sistema de alarme do PartyKit.
- Verifica expiração da sala
- Lida com expiração de timer
- Processa timeouts de desconexão

---

## Funções Handler

### joinHandler.ts

#### handleJoin(ctx, conn, data)
Processa mensagem JOIN.

```typescript
// Fluxo:
1. Validar nome (1-20 chars, sanitizado)
2. Verificar se reconectando (sessionId corresponde)
3. Se reconectando:
   - Restaurar conexão do jogador
   - Resumir jogo se estava pausado
4. Se novo:
   - Criar objeto player
   - Atribuir como host se primeiro
   - Verificar status de espectador (jogo em progresso)
5. Gerar/retornar sessionId
6. Broadcast do estado
```

#### handleLeaveRoom(ctx, conn)
Processa saída voluntária.

#### handleRemovePlayer(ctx, conn, playerId)
Host expulsa jogador (apenas lobby).

---

### gameHandlers.ts

#### handleStartGame(ctx, conn)
Inicia o jogo.

```typescript
// Requisitos:
- Fase deve ser LOBBY
- Sender deve ser host
- 5-10 jogadores conectados

// Ações:
1. Obter regras para quantidade de jogadores
2. Embaralhar e atribuir papéis
3. Criar objetos de missão
4. Definir líder inicial (aleatório)
5. Transicionar para TEAM_SELECTION
6. Iniciar timer (se habilitado)
```

#### handleSelectPlayer(ctx, conn, playerId)
Alternar jogador no time proposto.

```typescript
// Requisitos:
- Fase deve ser TEAM_SELECTION
- Sender deve ser líder atual

// Ações:
1. Se jogador no time → remover
2. Se não no time E time não cheio → adicionar
```

#### handleSubmitTeam(ctx, conn)
Confirmar seleção do time.

```typescript
// Requisitos:
- Fase deve ser TEAM_SELECTION
- Sender deve ser líder atual
- Tamanho do time deve corresponder ao requisito da missão

// Ações:
1. Limpar votos anteriores
2. Transicionar para TEAM_VOTE
3. Iniciar timer de votação (se habilitado)
```

#### handleVote(ctx, conn, approve)
Votar no time.

```typescript
// Requisitos:
- Fase deve ser TEAM_VOTE
- Sender deve ser não-espectador
- Sender ainda não votou

// Ações:
1. Registrar voto
2. Se todos votaram:
   - Contar aprovações
   - aprovado = aprovações > quantidadeJogadores/2
   - Se aprovado → MISSION_EXECUTION
   - Se rejeitado:
     - Incrementar failedVoteCount
     - Se 5 rejeições → GAME_OVER (Terminators vencem)
     - Senão → TEAM_SELECTION, próximo líder
```

#### handleMissionAction(ctx, conn, success)
Executar ação da missão.

```typescript
// Requisitos:
- Fase deve ser MISSION_EXECUTION
- Sender deve ser membro do time
- Sender ainda não agiu

// Regras especiais:
- Humanos → sempre sucesso (forçado)
- Terminators → podem escolher

// Ações:
1. Registrar resultado
2. Se todos agiram:
   - Contar falhas
   - falha = falhas >= (requiresTwoFails ? 2 : 1)
   - Atualizar status da missão
   - Verificar condições de vitória
   - Se sem vencedor → próxima missão, próximo líder
```

---

### disconnectHandlers.ts

#### handlePlayerDisconnect(ctx, playerId)
Chamado quando conexão do jogador fecha.

```typescript
// Ações:
1. Marcar jogador como desconectado
2. Se jogo ativo e não-espectador:
   - Pausar jogo
   - Armazenar pausedPhase
   - Armazenar estado do timer (se ativo)
   - Iniciar timeout de reconexão
```

#### handlePlayerReconnect(ctx, playerId)
Chamado quando jogador reentra.

```typescript
// Ações:
1. Limpar timeout de reconexão
2. Restaurar estado do jogador
3. Se jogo estava pausado por este jogador:
   - Resumir para pausedPhase
   - Resumir timer (se estava rodando)
```

#### handleDisconnectVote(ctx, conn, endGame)
Votar para encerrar ou esperar.

```typescript
// Requisitos:
- Fase deve ser DISCONNECT_VOTE
- Sender deve ser não-espectador

// Ações:
1. Registrar voto
2. Se todos votaram:
   - Calcular resultado
   - Se maioria ENCERRAR → GAME_OVER
   - Se maioria ESPERAR → Esperar mais, ou resumir se reconectou
```

---

### timerHandlers.ts

#### startTimer(ctx, timerType)
Iniciar timer de contagem regressiva.

```typescript
// Define:
- gameState.currentTimerEndsAt = agora + duração
- gameState.currentTimerType = timerType
- Agenda alarme
```

#### cancelTimer(ctx)
Cancelar timer ativo.

#### pauseTimer(ctx)
Pausar timer (armazenar tempo restante).

#### resumeTimer(ctx)
Resumir timer pausado.

#### handleTimerExpiry(ctx, timerType)
Chamado quando timer expira.

```typescript
// Por tipo de timer:
- team_selection: Auto-selecionar time aleatório, submeter
- team_vote: Não-votantes auto-rejeitam
- mission_vote: Não-agentes auto-sucedem
```

---

## Utilitários de Estado (game/state.ts)

| Função | Descrição |
|--------|-----------|
| `addLog(state, msg)` | Adicionar entrada de log (máx 100) |
| `getPlayerByConnection(state, conns, connId)` | Encontrar jogador por conexão |
| `getActivePlayers(state)` | Não-espectador, não-desconectado |
| `getSanitizedState(state, playerId)` | Preparar estado para cliente |

---

## Registry (registry.ts)

Sala PartyKit separada gerenciando lista de salas públicas.

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/parties/registry/main` | GET | Listar salas públicas |
| `/parties/registry/main` | POST | Atualizar info da sala |

---

## Segurança

### Rate Limiting
Aplicado em `onMessage`:
- Máx 30 mensagens por minuto por conexão
- Mensagens em excesso descartadas silenciosamente

### Validação de Input
Todos payloads de mensagem validados:
- Nome: 1-20 chars, entidades HTML removidas
- IDs: Devem existir no estado
- Booleans: Convertidos de truthy/falsy

### Segurança de Sessão
- Session IDs: UUID v4, gerados no servidor
- Armazenados por jogador, validados na reconexão
- Nenhuma sessão gerada pelo cliente aceita

---

Veja também:
- [MESSAGES.md](./MESSAGES.md) - Detalhes do protocolo
- [STATE_MACHINE.md](./STATE_MACHINE.md) - Lógica de fases
