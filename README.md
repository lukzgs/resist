# 🤖 Skynet Infiltration Protocol

*[🇺🇸 English](#-skynet-infiltration-protocol-1) | 🇧🇷 Português*

> Um jogo multiplayer online de dedução social inspirado em **The Resistance**, com temática de **Terminator**.

<div align="center">

![Skynet](https://img.shields.io/badge/SKYNET-ACTIVE-red?style=for-the-badge&logo=robot)
![Players](https://img.shields.io/badge/PLAYERS-5--10-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-green?style=for-the-badge)

**[🎮 Jogar Agora](https://resist.any-pages.com)** · **[📖 Documentação](.agent/implementation_plan_partykit.md)**

</div>

---

## 🎯 Sobre o Jogo

**Skynet Infiltration Protocol** é uma adaptação digital do jogo de tabuleiro *The Resistance*. Os jogadores são divididos em dois times secretos:

| Time | Objetivo |
|------|----------|
| 🛡️ **Humanos (Resistência)** | Completar 3 missões com sucesso |
| 🔴 **Terminators (Skynet)** | Sabotar 3 missões ou causar 5 rejeições de equipe |

Os Terminators conhecem uns aos outros, mas os Humanos não sabem quem são os infiltradores. Use dedução, persuasão e blefe para vencer!

---

## ✨ Features

- 🌐 **100% Online** - Conexão via WebSocket, sem necessidade de P2P
- 🔄 **Reconexão Automática** - Não perca seu lugar se a conexão cair
- 👥 **Modo Espectador** - Entre durante uma partida e assista
- 🗳️ **Votos Anônimos** - Opção configurável pelo host
- 🌍 **Bilíngue** - Português e Inglês
- 📱 **Responsivo** - Funciona em desktop e mobile

---

## 🎮 Como Jogar

1. **Criar/Entrar** - Crie uma sala ou entre com um código de 4 caracteres
2. **Aguardar** - Espere 5-10 jogadores no lobby
3. **Missões** - O líder seleciona jogadores para a missão
4. **Votação** - Todos votam se aprovam a equipe proposta
5. **Execução** - Membros da equipe escolhem sucesso ou sabotagem (Terminators podem sabotar)
6. **Resultado** - 3 vitórias de um time encerra o jogo

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Estilização** | TailwindCSS 4 |
| **Backend** | [PartyKit](https://partykit.io) (WebSocket serverless) |
| **Deploy** | Vercel (frontend) + PartyKit Cloud (backend) |

---

## 🚀 Desenvolvimento Local

### Pré-requisitos

- Node.js 18+
- npm

### Instalação

```bash
# Clone o repositório
git clone https://github.com/lukzgs/resist.git
cd resist

# Instale as dependências
npm install
cd server && npm install && cd ..
```

### Executar

```bash
# Terminal 1 - Backend (porta 1999)
cd server && npm run dev

# Terminal 2 - Frontend (porta 3000)
npm run dev
```

Acesse `http://localhost:3000` e crie uma sala!

### Deploy

```bash
# Frontend (Vercel)
npm run build
vercel --prod

# Backend (PartyKit)
cd server && npx partykit deploy
```

---

## 📁 Estrutura do Projeto

```
resist/
├── src/                      # Frontend React
│   ├── App.tsx               # Roteamento e estado global
│   ├── views/                # HomeView, LobbyView, GameView...
│   ├── components/           # PlayerCard, LanguageSelector
│   └── hooks/usePartySocket  # WebSocket + reconexão
│
├── server/src/               # Backend PartyKit
│   ├── server.ts             # Orquestração WebSocket
│   ├── handlers/             # JOIN, VOTE, MISSION...
│   ├── game/state.ts         # Gerenciamento de estado
│   └── utils/crypto.ts       # IDs, UUIDs, shuffle
│
├── shared/types.ts           # Tipos compartilhados
└── index.html                # Entry point
```

---

## 📋 Regras por Número de Jogadores

| Jogadores | Terminators | Missões (tamanho) |
|:---------:|:-----------:|:-----------------:|
| 5 | 2 | 2, 3, 2, 3, 3 |
| 6 | 2 | 2, 3, 4, 3, 4 |
| 7 | 3 | 2, 3, 3, 4*, 4 |
| 8 | 3 | 3, 4, 4, 5*, 5 |
| 9 | 3 | 3, 4, 4, 5*, 5 |
| 10 | 4 | 3, 4, 4, 5*, 5 |

> *\* Missões que requerem 2 sabotagens para falhar*

---

## 🔒 Segurança

- ✅ Content Security Policy (CSP) headers
- ✅ Session IDs gerados no servidor (UUID v4)
- ✅ Rate limiting (30 requisições/minuto)
- ✅ Sanitização de inputs

---

## 📝 Licença

MIT License - Use e modifique livremente.

---

<div align="center">

**"O futuro não está escrito. Não há destino além do que fazemos para nós mesmos."**

*— John Connor*

<br>

</div>

---

# 🤖 Skynet Infiltration Protocol

*🇺🇸 English | [🇧🇷 Português](#-skynet-infiltration-protocol)*

> A multiplayer online social deduction game inspired by **The Resistance**, with a **Terminator** theme.

<div align="center">

![Skynet](https://img.shields.io/badge/SKYNET-ACTIVE-red?style=for-the-badge&logo=robot)
![Players](https://img.shields.io/badge/PLAYERS-5--10-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-green?style=for-the-badge)

**[🎮 Play Now](https://resist.any-pages.com)** · **[📖 Documentation](.agent/implementation_plan_partykit.md)**

</div>

---

## 🎯 About the Game

**Skynet Infiltration Protocol** is a digital adaptation of the board game *The Resistance*. Players are divided into two secret teams:

| Team | Objective |
|------|-----------|
| 🛡️ **Humans (Resistance)** | Complete 3 missions successfully |
| 🔴 **Terminators (Skynet)** | Sabotage 3 missions or cause 5 team rejections |

The Terminators know each other, but the Humans don't know who the infiltrators are. Use deduction, persuasion, and bluffing to win!

---

## ✨ Features

- 🌐 **100% Online** - WebSocket connection, no P2P needed
- 🔄 **Auto-Reconnect** - Don't lose your spot if connection drops
- 👥 **Spectator Mode** - Join during a match and watch
- 🗳️ **Anonymous Voting** - Configurable option by host
- 🌍 **Bilingual** - Portuguese and English
- 📱 **Responsive** - Works on desktop and mobile

---

## 🎮 How to Play

1. **Create/Join** - Create a room or join with a 4-character code
2. **Wait** - Wait for 5-10 players in the lobby
3. **Missions** - The leader selects players for the mission
4. **Voting** - Everyone votes whether they approve the proposed team
5. **Execution** - Team members choose success or sabotage (Terminators can sabotage)
6. **Result** - 3 wins by one team ends the game

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | TailwindCSS 4 |
| **Backend** | [PartyKit](https://partykit.io) (serverless WebSocket) |
| **Deploy** | Vercel (frontend) + PartyKit Cloud (backend) |

---

## 🚀 Local Development

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/lukzgs/resist.git
cd resist

# Install dependencies
npm install
cd server && npm install && cd ..
```

### Run

```bash
# Terminal 1 - Backend (port 1999)
cd server && npm run dev

# Terminal 2 - Frontend (port 3000)
npm run dev
```

Access `http://localhost:3000` and create a room!

### Deploy

```bash
# Frontend (Vercel)
npm run build
vercel --prod

# Backend (PartyKit)
cd server && npx partykit deploy
```

---

## 📁 Project Structure

```
resist/
├── src/                      # React Frontend
│   ├── App.tsx               # Routing and global state
│   ├── views/                # HomeView, LobbyView, GameView...
│   ├── components/           # PlayerCard, LanguageSelector
│   └── hooks/usePartySocket  # WebSocket + reconnection
│
├── server/src/               # PartyKit Backend
│   ├── server.ts             # WebSocket orchestration
│   ├── handlers/             # JOIN, VOTE, MISSION...
│   ├── game/state.ts         # State management
│   └── utils/crypto.ts       # IDs, UUIDs, shuffle
│
├── shared/types.ts           # Shared types
└── index.html                # Entry point
```

---

## 📋 Rules by Player Count

| Players | Terminators | Missions (size) |
|:-------:|:-----------:|:---------------:|
| 5 | 2 | 2, 3, 2, 3, 3 |
| 6 | 2 | 2, 3, 4, 3, 4 |
| 7 | 3 | 2, 3, 3, 4*, 4 |
| 8 | 3 | 3, 4, 4, 5*, 5 |
| 9 | 3 | 3, 4, 4, 5*, 5 |
| 10 | 4 | 3, 4, 4, 5*, 5 |

> *\* Missions that require 2 sabotages to fail*

---

## 🔒 Security

- ✅ Content Security Policy (CSP) headers
- ✅ Server-generated session IDs (UUID v4)
- ✅ Rate limiting (30 requests/minute)
- ✅ Input sanitization

---

## 📝 License

MIT License - Use and modify freely.

---

<div align="center">

**"The future is not set. There is no fate but what we make for ourselves."**

*— John Connor*

<br>

</div>
