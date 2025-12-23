# Plano de Migração: PeerJS → PartyKit

## Resumo

Migrar o sistema de comunicação peer-to-peer (WebRTC/PeerJS) para WebSocket via PartyKit, melhorando significativamente a conectividade e eliminando problemas de NAT/Firewall.

---

## Arquitetura Atual vs Nova

### Atual (PeerJS)
```
Jogador 1 (Host) ←──WebRTC──→ Jogador 2
                 ←──WebRTC──→ Jogador 3
                 ←──WebRTC──→ ...
```
**Problemas:** NAT, Firewall, STUN/TURN, conexões instáveis

### Nova (PartyKit)
```
Jogador 1 ──┐
Jogador 2 ──┼──→ PartyKit Server ──→ Broadcast
Jogador 3 ──┘         │
                      └── Estado centralizado
```
**Benefícios:** 100% conectividade, simples, confiável

---

## Fases de Implementação

### Fase 1: Setup do PartyKit (Backend)
**Tempo estimado: 30 minutos**

#### 1.1 Criar projeto PartyKit
```bash
mkdir resist-server
cd resist-server
npm init -y
npm install partykit
```

#### 1.2 Estrutura do servidor
```
resist-server/
├── package.json
├── partykit.json
└── src/
    └── server.ts      # Lógica do servidor
```

#### 1.3 Configuração (partykit.json)
```json
{
  "name": "resist-game",
  "main": "src/server.ts"
}
```

#### 1.4 Servidor WebSocket (src/server.ts)
O servidor precisa:
- Gerenciar salas de jogo (rooms)
- Armazenar estado do jogo em memória
- Sincronizar estado entre jogadores
- Broadcast de mensagens
- Processar ações do jogo

**Mensagens suportadas:**
| Tipo | Direção | Descrição |
|------|---------|-----------|
| `JOIN` | Client → Server | Jogador entra na sala |
| `STATE_SYNC` | Server → Client | Sincroniza estado com todos |
| `ACTION` | Client → Server | Ação do jogador |
| `PLAYER_LEFT` | Server → Client | Jogador saiu |

---

### Fase 2: Adaptação do Frontend
**Tempo estimado: 1-2 horas**

#### 2.1 Instalar dependências
```bash
npm install partysocket
```

#### 2.2 Arquivos a modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/App.tsx` | Remover PeerJS, usar PartySocket |
| `src/hooks/useGameLogic.ts` | Adaptar para WebSocket |
| `index.html` | Remover script do PeerJS |

#### 2.3 Novo hook: usePartySocket
Criar `src/hooks/usePartySocket.ts`:
- Gerencia conexão WebSocket
- Reconexão automática
- Envio/recebimento de mensagens

#### 2.4 Mudanças no App.tsx
**Remover:**
- Configuração de ICE servers
- `new window.Peer()`
- Handlers de conexão P2P
- Lógica de host/client separada

**Adicionar:**
- `PartySocket` do partysocket
- Todos os jogadores conectam igual (não há "host")
- Estado gerenciado pelo servidor

---

### Fase 3: Mudança de Arquitetura de Estado
**Tempo estimado: 1 hora**

#### Atual: Host é dono do estado
```
Host: mantém gameState, processa ações, broadcast
Client: envia ações, recebe estado
```

#### Novo: Servidor é dono do estado
```
Servidor: mantém gameState, processa ações, broadcast
Todos: enviam ações, recebem estado (iguais)
```

#### Impacto nos arquivos:
| Arquivo | Mudança |
|---------|---------|
| `useGameLogic.ts` | Mover lógica de processamento para servidor |
| `LobbyView.tsx` | Remover distinção host/client no broadcast |
| `App.tsx` | Simplificar - todos usam mesmo fluxo |

---

### Fase 4: Lógica de Jogo no Servidor
**Tempo estimado: 1-2 horas**

Mover para o servidor:
- [ ] Processamento de ações (`processAction`)
- [ ] Atribuição de papéis (shuffle roles)
- [ ] Regras do jogo (votação, missões)
- [ ] Lógica de IA (opcional - pode manter no client)

**Decisão importante:** Onde processar IA?
- **Opção A:** No servidor (mais seguro, mas precisa de API key)
- **Opção B:** No client do host (mais simples, menos seguro)

**Recomendação:** Manter IA no client por enquanto, migrar depois.

---

### Fase 5: Deploy e Testes
**Tempo estimado: 30 minutos**

#### 5.1 Deploy do servidor
```bash
cd resist-server
npx partykit deploy
# Output: https://resist-game.username.partykit.dev
```

#### 5.2 Configurar URL no frontend
```typescript
const PARTYKIT_HOST = "resist-game.username.partykit.dev";
```

#### 5.3 Testes
- [ ] Criar sala
- [ ] Entrar em sala existente
- [ ] Múltiplos jogadores
- [ ] Desconexão/reconexão
- [ ] Fluxo completo do jogo

---

## Checklist de Implementação

### Backend (PartyKit)
- [ ] Criar projeto resist-server
- [ ] Configurar partykit.json
- [ ] Implementar server.ts com:
  - [ ] Gerenciamento de conexões
  - [ ] Estado do jogo por sala
  - [ ] Handler JOIN
  - [ ] Handler ACTION
  - [ ] Handler de desconexão
  - [ ] Broadcast de estado
- [ ] Testar localmente (`npx partykit dev`)
- [ ] Deploy (`npx partykit deploy`)

### Frontend
- [ ] Remover PeerJS do index.html
- [ ] Instalar partysocket
- [ ] Criar usePartySocket.ts
- [ ] Refatorar App.tsx:
  - [ ] Remover configuração ICE
  - [ ] Remover lógica de Peer
  - [ ] Implementar PartySocket
  - [ ] Simplificar fluxo (sem host/client)
- [ ] Adaptar useGameLogic.ts
- [ ] Atualizar LobbyView.tsx (remover controles de host exclusivos)
- [ ] Testar integração

---

## Estrutura Final de Arquivos

### Backend (novo repositório ou pasta)
```
resist-server/
├── package.json
├── partykit.json
├── tsconfig.json
└── src/
    ├── server.ts        # Servidor principal
    ├── gameLogic.ts     # Regras do jogo
    └── types.ts         # Tipos compartilhados
```

### Frontend (projeto atual)
```
src/
├── App.tsx              # ⚡ Modificado
├── types.ts             # Igual
├── constants.ts         # Igual
├── hooks/
│   ├── useGameLogic.ts  # ⚡ Simplificado
│   └── usePartySocket.ts # 🆕 Novo
├── components/          # Iguais
├── views/
│   ├── HomeView.tsx     # Igual
│   ├── SetupView.tsx    # Leve mudança (sem distinção create/join)
│   ├── LobbyView.tsx    # ⚡ Simplificado
│   └── GameView.tsx     # Igual
└── services/
    └── geminiService.ts # Igual
```

---

## Cronograma Estimado

| Fase | Tempo | Descrição |
|------|-------|-----------|
| 1 | 30 min | Setup PartyKit + servidor básico |
| 2 | 1.5h | Adaptar frontend |
| 3 | 1h | Mudança de arquitetura de estado |
| 4 | 1.5h | Lógica de jogo no servidor |
| 5 | 30 min | Deploy e testes |
| **Total** | **~5 horas** | Migração completa |

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Latência maior | Baixa | PartyKit usa edge computing |
| Servidor offline | Muito baixa | PartyKit é gerenciado pela Cloudflare |
| Limite de conexões | Baixa | Tier gratuito suporta bastante |
| Perda de estado | Média | Implementar persistência opcional |

---

## Próximos Passos

1. **Aprovar este plano**
2. **Criar o servidor PartyKit** (Fase 1)
3. **Adaptar o frontend** (Fases 2-3)
4. **Testar localmente**
5. **Deploy**

---

## Perguntas para Decisão

1. **Criar servidor em pasta separada ou dentro do projeto atual?**
   - Recomendo: Pasta `server/` dentro do projeto

2. **Onde manter a lógica de IA (Gemini)?**
   - Recomendo: No client por enquanto (mais simples)

3. **Manter compatibilidade com PeerJS ou remover completamente?**
   - Recomendo: Remover completamente (código mais limpo)

