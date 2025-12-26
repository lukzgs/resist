# Skynet Infiltration Protocol

> Um jogo multiplayer online inspirado em **The Resistance**, com temática de **Terminator**.

<div align="center">

![Skynet](https://img.shields.io/badge/SKYNET-ACTIVE-red?style=for-the-badge&logo=robot)
![Players](https://img.shields.io/badge/PLAYERS-5--10-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-green?style=for-the-badge)

</div>

## 📖 Sobre o Jogo

**Skynet Infiltration Protocol** é uma adaptação digital do jogo de tabuleiro *The Resistance*, ambientado no universo de Terminator. Os jogadores assumem o papel de membros da Resistência Humana ou de infiltradores Terminators disfarçados.

### 🎯 Objetivo

- **Humanos (Resistência)**: Completar 3 missões com sucesso para vencer
- **Terminators**: Sabotar 3 missões ou conseguir 5 rejeições consecutivas de equipe

### 🎮 Como Jogar

1. **Lobby**: Crie uma sala ou entre com um código de 4 letras
2. **Seleção de Equipe**: O líder seleciona jogadores para a missão
3. **Votação**: Todos votam se aprovam a equipe proposta
4. **Missão**: Os membros da equipe escolhem sucesso ou sabotagem
5. **Resultado**: A missão é bem-sucedida se não houver sabotagens suficientes

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 19, TypeScript, Vite |
| **Estilização** | Tailwind CSS (CDN) |
| **Backend Realtime** | [PartyKit](https://partykit.io) |
| **Comunicação** | WebSockets (PartySocket) |

## 🚀 Rodando Localmente

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/lukzgs/resist.git
cd resist

# Instale as dependências
npm install
```

### Desenvolvimento

```bash
# Terminal 1 - Backend (PartyKit)
npm run party

# Terminal 2 - Frontend (Vite)
npm run dev
```

O frontend estará em `http://localhost:3000` e o servidor PartyKit em `http://localhost:1999`.

### Build de Produção

```bash
# Build do frontend
npm run build

# Deploy do servidor PartyKit
npm run deploy
```

## 📁 Estrutura do Projeto

```
resist/
├── src/                    # Frontend React
│   ├── App.tsx             # Componente principal
│   ├── views/              # Views (Home, Lobby, Game)
│   ├── components/         # Componentes reutilizáveis
│   ├── hooks/              # Custom hooks (usePartySocket)
│   └── types.ts            # Tipos TypeScript
├── server/                 # Backend PartyKit
│   └── src/
│       ├── server.ts       # Lógica do servidor
│       └── types.ts        # Tipos do servidor
├── index.html              # HTML principal
└── package.json            # Dependências
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# .env.local (opcional)
VITE_PARTYKIT_HOST=your-project.username.partykit.dev
```

Para desenvolvimento local, o frontend se conecta automaticamente em `localhost:1999`.

## 🎨 Design

O jogo apresenta uma estética **cyberpunk/terminal** com:

- UI glassmorphism com efeitos de blur
- Animações de scanlines estilo CRT
- Paleta de cores: azul (Resistência) e vermelho (Terminators)
- Tipografia mono-espaçada estilo terminal

## 📋 Regras por Número de Jogadores

| Jogadores | Terminators | Tamanho das Missões |
|-----------|-------------|---------------------|
| 5 | 2 | 2, 3, 2, 3, 3 |
| 6 | 2 | 2, 3, 4, 3, 4 |
| 7 | 3 | 2, 3, 3, 4*, 4 |
| 8 | 3 | 3, 4, 4, 5*, 5 |
| 9 | 3 | 3, 4, 4, 5*, 5 |
| 10 | 4 | 3, 4, 4, 5*, 5 |

*\* Missões que requerem 2 sabotagens para falhar*

## 📝 Licença

MIT License - Sinta-se livre para usar e modificar.

---

<div align="center">

**"O futuro não está escrito. Não há destino além do que fazemos para nós mesmos."**

*— John Connor*

</div>
