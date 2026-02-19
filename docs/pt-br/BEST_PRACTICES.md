# Melhores Práticas de Desenvolvimento de Software

Este documento serve como um guia de referência para os princípios e regras de desenvolvimento adotados neste projeto, visando manter o código limpo, sustentável e escalável.

## Princípios SOLID

O SOLID é um acrônimo para cinco princípios de design que tornam o software mais compreensível, flexível e sustentável.

### S - Single Responsibility Principle (SRP)
**Princípio da Responsabilidade Única**

> "Uma classe deve ter um, e apenas um, motivo para mudar."

**Explicação:** Uma classe (ou módulo/função) deve ser responsável por apenas uma parte da funcionalidade do software. Se uma classe assume muitas responsabilidades, ela se torna acoplada e frágil a mudanças.

**Exemplo:**
- **Ruim:** Uma classe `User` que lida com autenticação, validação de dados e envio de emails.
- **Bom:** Separar em `UserAuthentication`, `UserValidator` e `EmailService`.

### O - Open/Closed Principle (OCP)
**Princípio Aberto/Fechado**

> "Entidades de software (classes, módulos, funções, etc.) devem estar abertas para extensão, mas fechadas para modificação."

**Explicação:** Você deve ser capaz de estender o comportamento de uma classe sem modificar seu código fonte original. Isso geralmente é alcançado através de polimorfismo e abstração.

**Exemplo:**
- **Ruim:** Um `switch` case gigante para calcular descontos que precisa ser alterado a cada novo tipo de desconto.
- **Bom:** Uma interface `DiscountStrategy` com implementações diferentes. Novas estratégias podem ser adicionadas criando novas classes sem tocar no código existente.

### L - Liskov Substitution Principle (LSP)
**Princípio da Substituição de Liskov**

> "As classes derivadas devem ser substituíveis por suas classes base."

**Explicação:** Se `S` é um subtipo de `T`, então objetos do tipo `T` podem ser substituídos por objetos do tipo `S` sem alterar as propriedades desejáveis do programa (como corretude). Basicamente, subclasses não devem quebrar o comportamento esperado da classe pai.

**Exemplo:**
- **Ruim:** Uma classe `Quadrado` herdando de `Retangulo` e alterando o comportamento de `setAltura` para mudar também a largura (violando a expectativa de quem usa `Retangulo`).
- **Bom:** Ambas implementarem uma interface `Shape` ou manterem comportamentos consistentes.

### I - Interface Segregation Principle (ISP)
**Princípio da Segregação de Interface**

> "Muitas interfaces específicas são melhores do que uma interface única."

**Explicação:** Nenhum cliente deve ser forçado a depender de métodos que não utiliza. Divida interfaces grandes em interfaces menores e mais específicas.

**Exemplo:**
- **Ruim:** Uma interface `Worker` com métodos `eat()` e `work()`. Robôs implementam `Worker` mas não comem, sendo forçados a implementar `eat()` vazia ou lançando erro.
- **Bom:** Interfaces separadas `Workable` e `Eatable`.

### D - Dependency Inversion Principle (DIP)
**Princípio da Inversão de Dependência**

> "Dependa de abstrações, não de implementações concretas."

**Explicação:** Módulos de alto nível não devem depender de módulos de baixo nível. Ambos devem depender de abstrações. Abstrações não devem depender de detalhes. Detalhes devem depender de abstrações.

**Exemplo:**
- **Ruim:** Uma classe `OrderService` instanciando diretamente `MySQLDatabase` dentro dela.
- **Bom:** `OrderService` depende de uma interface `DatabaseRepository`, que é implementada por `MySQLDatabase` e injetada via construtor.

---

## Clean Code (Código Limpo)

O objetivo do Clean Code é escrever código que seja fácil de entender e manter. O código é lido muito mais vezes do que é escrito.

### Nomes Significativos
- Use nomes que revelem intenção. Evite abreviações obscuras.
- **Ruim:** `int d; // elapsed time in days`
- **Bom:** `int elapsedTimeInDays;`
- **Ruim:** `function getThem() { ... }`
- **Bom:** `function getFlaggedCells() { ... }`

### Funções Pequenas
- Funções devem fazer uma coisa apenas, e fazê-la bem.
- Devem ser pequenas (idealmente, caber em uma tela sem rolar).
- Evite efeitos colaterais (side effects).

### Comentários
- "Não comente o código ruim, reescreva-o."
- Comentários devem explicar o *porquê*, não o *como* (o código deve explicar o como).
- Código autoexplicativo é sempre preferível a comentários.

### Formatação
- Mantenha consistência na indentação e espaçamento.
- Agrupe linhas relacionadas e separe blocos lógicos com linhas em branco.

### Tratamento de Erros
- Use exceções em vez de códigos de retorno.
- Não retorne `null` se puder evitar (use Optionals ou objetos vazios).
- Não passe `null` como argumento.

---

## Outras Práticas Importantes

### DRY (Don't Repeat Yourself)
- "Não se repita."
- Evite duplicação de lógica. Se você copia e cola código, provavelmente deveria abstraí-lo em uma função ou componente reutilizável.

### KISS (Keep It Simple, Stupid)
- "Mantenha simples, estúpido."
- A solução mais simples é geralmente a melhor. Evite complexidade desnecessária e over-engineering.

### YAGNI (You Aren't Gonna Need It)
- "Você não vai precisar disso."
- Não implemente funcionalidades baseadas em suposições futuras. Implemente apenas o que é necessário agora.

### Boy Scout Rule
- "Deixe o acampamento mais limpo do que você o encontrou."
- Ao tocar em um arquivo de código, tente deixá-lo um pouco melhor do que estava antes (renomear uma variável, extrair uma função, etc.).

---

## Arquitetura e Estrutura

Para projetos que crescem, a organização é vital.

- **Clean Architecture / Hexagonal**: Separe o "Coração" (Business Logic) da "Casca" (Infraestrutura, UI, DB). Isso permite que você mude a UI sem tocar na regra de negócio.
- **SoC (Separation of Concerns)**: Separe responsabilidades em camadas bem definidas.
- **DDD Concepts (Domain-Driven Design)**:
    - **Ubiquitous Language**: Use os mesmos termos que as pessoas de negócio usam no código.
    - **Bounded Contexts**: Divida o sistema em áreas menores e independentes (ex: Autenticação vs. Gamificação).

---

## Estratégia de Testes (A Pirâmide)

1. **Unit Tests (Base)**: Muitos, rápidos, testam funções isoladas.
2. **Integration Tests (Meio)**: Testam a comunicação entre módulos (ex: API batendo no Banco).
3. **E2E Tests (Topo)**: Poucos, simulam o usuário real no navegador.
- **TDD (Test-Driven Development)**: Escreva o teste antes do código. Isso força você a pensar na interface antes da implementação.

---

## Práticas Modernas de Desenvolvimento

- **Code Reviews**: Não é sobre apontar erros, é sobre compartilhar conhecimento e garantir consistência.
- **CI/CD (Continuous Integration / Delivery)**: Automação total. Se o teste falha, o deploy não acontece.
- **Observabilidade**: Logar não é suficiente. Você precisa de métricas e rastreamento para entender o que acontece em produção (Traces, Metrics, Logs).
- **Shift Left Security**: Pense na segurança desde o início, não como um passo final.

---

Este documento deve evoluir com o projeto. Se encontrar padrões ou regras novas que melhorem nosso fluxo, proponha alterações aqui.
