# Skynet Infiltration Protocol - Documentação Técnica

## Visão Geral

Jogo multiplayer de dedução social baseado em "The Resistance", com tema inspirado em Terminator. Jogadores devem identificar infiltradores (Terminators) enquanto completam missões para salvar a humanidade.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Estilização** | TailwindCSS 4 |
| **Backend** | PartyKit (WebSocket serverless) |
| **Comunicação** | WebSocket via `partysocket` |
| **Deploy** | Vercel (frontend) + PartyKit (backend) |

---

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│  React + Vite (localhost:3000 / Vercel)         │
│                                                  │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ App.tsx │──│ Views/   │──│ Components/  │   │
│  └────┬────┘  └──────────┘  └──────────────┘   │
│       │                                          │
│  ┌────▼────────────────┐                        │
│  │ usePartySocket.ts   │ (WebSocket + Estado)   │
│  └────────┬────────────┘                        │
└───────────┼──────────────────────────────────────┘
            │ WebSocket
┌───────────▼──────────────────────────────────────┐
│                    Backend                        │
│  PartyKit Server (Cloudflare Edge)               │
│                                                   │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │ server.ts │──│ handlers/  │──│ game/      │  │
│  │ (350 LOC) │  │ (4 files)  │  │ state.ts   │  │
│  └───────────┘  └────────────┘  └────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │ utils/crypto.ts (IDs, UUIDs, shuffle)   │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## Estrutura de Arquivos

### Frontend (`/src`)
```
src/
├── App.tsx              # Componente principal, roteamento de views
├── index.tsx            # Entry point
├── types.ts             # Re-exporta tipos do shared
├── constants.ts         # GAME_RULES, AVATAR_URL
├── i18n.tsx             # Internacionalização (PT/EN)
├── hooks/
│   └── usePartySocket.ts  # WebSocket, reconexão, ações
├── components/
│   ├── PlayerCard.tsx     # Card de jogador
│   └── LanguageSelector.tsx
└── views/
    ├── HomeView.tsx       # Tela inicial
    ├── SetupView.tsx      # Criar/Entrar sala
    ├── LobbyView.tsx      # Sala de espera
    ├── GameView.tsx       # Jogo em andamento
    └── ReconnectView.tsx  # Reconexão automática
```

### Backend (`/server/src`)
```
server/src/
├── server.ts            # Orquestração WebSocket (~350 LOC)
├── types.ts             # Re-exporta tipos do shared
├── utils/
│   └── crypto.ts        # generateId, generateUUID, shuffle
├── game/
│   └── state.ts         # createInitialState, addLog, sanitizeName
└── handlers/
    ├── index.ts         # Barrel exports
    ├── joinHandler.ts   # JOIN, LEAVE_ROOM, REMOVE_PLAYER
    ├── gameHandlers.ts  # START, VOTE, MISSION, etc.
    └── disconnectHandlers.ts  # Sistema de pausa/votação
```

### Shared (`/shared`)
```
shared/
└── types.ts             # GameState, Player, Phase, Role, etc.
```

---

## Features Implementadas

### Gameplay
- ✅ Suporte a 5-10 jogadores
- ✅ Distribuição aleatória de papéis (Humanos vs Terminators)
- ✅ Sistema de missões com votação de equipe
- ✅ Votação anônima (configurável pelo host)
- ✅ Contador de rejeições (configurável)
- ✅ Botão "Nova Partida" após fim de jogo

### Conectividade
- ✅ WebSocket via PartyKit (100% conectividade)
- ✅ Reconexão automática com backoff exponencial
- ✅ Identificação por playerId (não por nome)
- ✅ Sessão persistida no localStorage

### Sistema de Desconexão
- ✅ Pausa automática quando jogador desconecta
- ✅ Tempo de espera para reconexão (2 min)
- ✅ Votação para encerrar ou continuar esperando
- ✅ Até 3 tentativas de espera

### Modo Espectador
- ✅ Novos jogadores entram como espectadores se jogo em andamento
- ✅ Espectadores não afetam votações nem missões
- ✅ Desconexão de espectadores não pausa o jogo

### UI/UX
- ✅ Design cyberpunk/Terminator
- ✅ Internacionalização (Português/Inglês)
- ✅ Avatares aleatórios (picsum.photos)
- ✅ Log de eventos draggable e colapsável
- ✅ Toasts para notificações
- ✅ Animações e transições suaves

### Segurança
- ✅ Content Security Policy (CSP) headers
- ✅ Session IDs gerados no servidor (UUID v4)
- ✅ Rate limiting no servidor (30 msg/min)
- ✅ Sanitização de nomes de jogadores

---

## Fluxo de Comunicação

### Conexão
```
Cliente                          Servidor
   │                                │
   │──── WebSocket Connect ────────▶│
   │                                │
   │◀─── onConnect (state) ─────────│
   │                                │
   │──── JOIN { name, sessionId } ──▶│
   │                                │
   │◀─── SESSION_ESTABLISHED ───────│
   │     { sessionId, playerId }    │
   │                                │
   │◀─── STATE { gameState } ───────│
```

### Ações do Jogo
```
Cliente A                        Servidor                       Clientes
   │                                │                              │
   │──── VOTE { approve: true } ───▶│                              │
   │                                │                              │
   │                                │──── STATE (broadcast) ──────▶│
   │◀───────────────────────────────│                              │
```

---

## Comandos de Desenvolvimento

```bash
# Frontend (porta 3000)
npm run dev

# Backend (porta 1999)
cd server && npm run dev

# Typecheck
npm run typecheck
cd server && npm run typecheck

# Deploy
npm run build                    # Frontend para Vercel
cd server && npx partykit deploy # Backend para PartyKit
```

---

## Variáveis de Ambiente

### Frontend (`.env`)
```
VITE_PARTYKIT_HOST=your-project.username.partykit.dev
```

### Backend
Não requer variáveis (serverless).

---

## Issues Conhecidas

| Issue | Prioridade | Status |
|-------|------------|--------|
| Estado em memória (sem persistência) | Alta | Pendente |
| Código de sala previsível | Alta | Pendente |
| setTimeout em lógica crítica | Média | Pendente |
| Imagens externas (picsum) | Baixa | Pendente |

---

## Histórico de Refatorações

| Data | Mudança |
|------|---------|
| 2025-12-31 | Migração PeerJS → PartyKit |
| 2025-12-31 | Separação de responsabilidades no servidor (6 módulos) |
| 2026-01-01 | CSP Headers implementados |
| 2026-01-01 | Identificação de jogador por ID (não nome) |
