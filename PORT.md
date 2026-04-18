# Skynet Infiltration Protocol

> Multiplayer online social deduction game inspired by **The Resistance** with a **Terminator** theme.

![Skynet](https://img.shields.io/badge/SKYNET-ACTIVE-red?style=for-the-badge&logo=robot)
![Players](https://img.shields.io/badge/PLAYERS-5--10-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-green?style=for-the-badge)

<!-- pt -->

## Título
Skynet Infiltration Protocol

## Contexto
A motivação principal foi criar uma versão web do jogo de tabuleiro 'The Resistance' para jogar com amigos à distância. O desafio técnico consistiu em garantir a consistência de estado entre múltiplos clientes conectados via WebSocket, orquestrando fluxos complexos como informações ocultas (papéis secretos), votações simultâneas, transições de fase e reconexão automática de jogadores — tudo em tempo real e de forma instantânea.

## Solução
Desenvolvimento de uma plataforma multiplayer completa usando WebSockets para comunicação bidirecional em tempo real. O backend foi construído com uma arquitetura server-authoritative baseada em uma máquina de estados robusta que controla com precisão as diferentes fases do jogo (seleção de equipe, votação, execução de missão). O sistema inclui reconexão automática via session IDs, modo espectador para jogadores tardios, sistema de timers com pause/resume, e sanitização de estado por jogador para proteger informações ocultas.

## Tecnologias
React 19, TypeScript, Vite, TailwindCSS 4, PartyKit (WebSockets), Vitest

## Arquitetura
Arquitetura Cliente-Servidor orientada a eventos via WebSockets. O frontend React consome sinais em tempo real do backend serverless PartyKit, responsável por manter o estado das salas em memória. O servidor é a única fonte de verdade — toda lógica de jogo roda no backend, enquanto o cliente apenas exibe o estado e encaminha inputs. Handlers stateless recebem objetos de contexto, facilitando testes e manutenção. Um sistema de registry separado gerencia a listagem de salas públicas.

<!-- en -->

## Title
Skynet Infiltration Protocol

## Context
The main motivation was to create a web version of the board game 'The Resistance' to play remotely with friends. The technical challenge consisted of ensuring state consistency across multiple WebSocket-connected clients, orchestrating complex flows such as hidden information (secret roles), simultaneous voting, phase transitions, and automatic player reconnection — all in real-time and instantaneously.

## Solution
Development of a complete multiplayer platform using WebSockets for real-time bidirectional communication. The backend was built with a server-authoritative architecture based on a robust state machine that accurately controls the different game phases (team selection, voting, mission execution). The system includes automatic reconnection via session IDs, spectator mode for late joiners, a timer system with pause/resume, and per-player state sanitization to protect hidden information.

## Stack
React 19, TypeScript, Vite, TailwindCSS 4, PartyKit (WebSockets), Vitest

## Architecture
Event-driven Client-Server architecture via WebSockets. The React frontend consumes real-time signals from the PartyKit serverless backend, which holds the temporal state of rooms in-memory. The server is the single source of truth — all game logic runs on the backend, while the client only displays state and forwards inputs. Stateless handlers receive context objects, making testing and maintenance straightforward. A separate registry system manages the public rooms listing.
