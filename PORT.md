# Skynet Infiltration Protocol

> Multiplayer online social deduction game inspired by **The Resistance** with a **Terminator** theme.

![Skynet](https://img.shields.io/badge/SKYNET-ACTIVE-red?style=for-the-badge&logo=robot)
![Players](https://img.shields.io/badge/PLAYERS-5--10-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-green?style=for-the-badge)

## Link
https://resist-any.pages.dev/

<!-- pt -->

## Título
Skynet Infiltration Protocol

## Contexto
O objetivo foi adaptar o jogo de tabuleiro 'The Resistance' para web. O desafio técnico principal foi garantir a consistência de estado entre múltiplos clientes via WebSocket, orquestrando informações ocultas, votações simultâneas e reconexão automática em tempo real.

## Solução
Desenvolvi um backend server-authoritative com WebSockets. Uma máquina de estados robusta controla as fases do jogo. Implementei reconexão via session IDs, timers pausáveis, modo espectador e sanitização de estado por jogador para proteger papéis secretos.

## Tecnologias
React 19, TypeScript, Vite, TailwindCSS 4, PartyKit (WebSockets), Vitest

## Arquitetura
Arquitetura event-driven Cliente-Servidor. O frontend em React consome eventos do backend serverless (PartyKit) que mantém o estado em memória. O servidor centraliza a lógica de jogo usando handlers stateless. Um registry paralelo gerencia as salas públicas.

<!-- en -->

## Title
Skynet Infiltration Protocol

## Context
The goal was to adapt 'The Resistance' board game for the web. The main technical challenge was ensuring state consistency across multiple WebSocket clients, orchestrating hidden information, simultaneous voting, and real-time automatic reconnection.

## Solution
Developed a server-authoritative WebSocket backend. A robust state machine controls game phases. Implemented session ID-based reconnection, pausable timers, spectator mode, and per-player state sanitization to protect secret roles.

## Stack
React 19, TypeScript, Vite, TailwindCSS 4, PartyKit (WebSockets), Vitest

## Architecture
Event-driven Client-Server architecture. The React frontend consumes real-time events from the serverless backend (PartyKit) which holds the in-memory state. The server acts as the single source of truth, using stateless handlers. A parallel registry manages public rooms.
