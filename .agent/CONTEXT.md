# Project Context for AI Agents

> **Read this file first** when starting work on this project.

## Quick Reference

| Need | Documentation |
|------|---------------|
| **⚠️ Code quality rules** | [.agent/BEST_PRACTICES.md](file:///home/lukzgs/projects/resist/.agent/BEST_PRACTICES.md) |
| **⚠️ Known issues** | [.agent/KNOWN_ISSUES.md](file:///home/lukzgs/projects/resist/.agent/KNOWN_ISSUES.md) |
| Quick project overview | [docs/en/OVERVIEW.md](file:///home/lukzgs/projects/resist/docs/en/OVERVIEW.md) |
| Server/backend changes | [docs/en/SERVER.md](file:///home/lukzgs/projects/resist/docs/en/SERVER.md) |
| Frontend/UI changes | [docs/en/CLIENT.md](file:///home/lukzgs/projects/resist/docs/en/CLIENT.md) |
| WebSocket messages | [docs/en/MESSAGES.md](file:///home/lukzgs/projects/resist/docs/en/MESSAGES.md) |
| Game state/flow changes | [docs/en/STATE_MACHINE.md](file:///home/lukzgs/projects/resist/docs/en/STATE_MACHINE.md) |
| Architecture decisions | [docs/en/ARCHITECTURE.md](file:///home/lukzgs/projects/resist/docs/en/ARCHITECTURE.md) |
| Code quality audit | [docs/pt-br/CODE_QUALITY_REPORT.md](file:///home/lukzgs/projects/resist/docs/pt-br/CODE_QUALITY_REPORT.md) |

## Key Files

| Purpose | Path |
|---------|------|
| Entry point (client) | `src/App.tsx` |
| Main server class | `server/src/server.ts` |
| Shared types | `shared/types.ts` |
| Game handlers | `server/src/handlers/` |
| React views | `src/views/` |
| React hooks | `src/hooks/` |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4
- **Backend**: PartyKit (serverless WebSocket)
- **Deploy**: Vercel (frontend) + PartyKit Cloud (backend)

## Game Domain

- **Roles**: `HUMAN` (Resistance) vs `TERMINATOR` (Skynet)
- **Objective**: Complete 3 missions (Humans) or sabotage 3 missions (Terminators)
- **Players**: 5-10 per game

---

## ⚠️ MANDATORY: Documentation Update Policy

> [!CAUTION]
> **When modifying code, you MUST update the corresponding documentation.**

### What to Update

| Change Type | Update Required |
|-------------|-----------------|
| New message type | `MESSAGES.md` |
| New game phase | `STATE_MACHINE.md` |
| New handler | `SERVER.md` |
| New component/view | `CLIENT.md` |
| New hook | `CLIENT.md` |
| Architecture change | `ARCHITECTURE.md` |
| Any significant change | `OVERVIEW.md` (if affects summary) |

### How to Update

1. **Identify affected docs** based on the table above
2. **Update English version** in `docs/en/`
3. **Update Portuguese version** in `docs/pt-br/`
4. **Update diagrams** if flow changed (Mermaid in STATE_MACHINE.md)

> [!IMPORTANT]
> **Timing**: Documentation updates MUST be done **ONLY WHEN the user requests commits**.
> When the user asks to commit, update the documentation FIRST, then proceed with the commits.
> This ensures that only approved changes are documented.

### Checklist Template

When completing a feature, verify:

```markdown
- [ ] Code changes complete
- [ ] MESSAGES.md updated (if new messages)
- [ ] STATE_MACHINE.md updated (if state changes)
- [ ] SERVER.md updated (if backend changes)
- [ ] CLIENT.md updated (if frontend changes)
- [ ] OVERVIEW.md updated (if significant feature)
- [ ] Both EN and PT-BR versions synced
```

---

## Portuguese Documentation

Para documentação em português, consulte `docs/pt-br/`.
