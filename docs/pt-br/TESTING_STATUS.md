# Status de Cobertura de Testes

Este documento mapeia o progresso atual da cobertura de testes automatizados do Skynet Protocol e lista o que ainda precisa ser implementado, juntamente com a justificativa técnica.

## 🟢 Testes Implementados (Concluídos)

A infraestrutura base utilizando Vitest e React Testing Library está totalmente configurada globalmente.

- **`LanguageSelector.test.tsx` (Teste de Componente)**
  - **Local**: `src/__tests__/components/LanguageSelector.test.tsx`
  - **O que faz**: Garante que o componente carrega, os textos "PT/EN" existem na tela e que os cliques de usuário não quebram o estado de interatividade visual.
- **`HomeView.test.tsx` (Teste de View/Tela)**
  - **Local**: `src/__tests__/views/HomeView.test.tsx`
  - **O que faz**: Renderiza a interface com o provedor de tradução habilitado, pesquisa pelo botão de "Criar Sala" baseando-se no comportamento do usuário e verifica se o sistema de rotas foi invocado perfeitamente.

---

## 🔴 Testes Faltantes (Próximos Passos)

Para garantir a total integridade de um jogo de dedução on-line, as seguintes interfaces carecem de validação:

### 1. Telas e Componentes do Jogo (Frontend)
- **Componentes do `LobbyView`** (ex: `PlayerCard`, `LanguageSelector`)
  - **Por que precisamos**: Para termos a certeza visual de que Jogadores, Hosts, Espectadores e jogadores Desconectados têm os distintivos visuais (badges) renderizadas corretamente.
- **Componentes do `GameView`** (ex: `VoteTracker`, `PhaseControls`, `MissionTracker`)
  - **Por que precisamos**: O coração do jogo fica ali. Precisamos simular testes onde o usuário clica em "Sabotar" para atestar se o botão desabilita temporariamente e se a prop callback é notificada, evitando "duplo-cliques criminosos" ou falsos-positivos na interface.

### 2. State Machine e Regras (Backend / PartyKit)
- **Validação de Variáveis Globais de Balanceamento (`server/src/utils`)**
  - **Por que precisamos**: Em salas com 7 jogadores, o código deve determinar matematicamente que existem `4 Resistências e 3 Skynets`. Precisamos de testes "crus" para impedir que bugs quebrem a proporção do jogo.
- **Máquina de Estado e Handlers (`gameHandlers.ts` / `disconnectHandlers.ts`)**
  - **Por que precisamos**: O _Estado Autoritativo_ está no servidor. Precisamos criar funções falsas de um Lobby, com 5 usuários votando na missão. O teste automatizado tem uma única função base: assegurar que quando um pacote de dados é enviado no websocket, o backend faz as contas corretamente e não permite fraudes.
