# Bugs corrigidos

Registro do que foi diagnosticado e corrigido nesta branch, com a evidência de
cada achado. Separado entre bugs que já existiam no sistema e bugs
introduzidos durante a própria correção.

Branch: `fix/signup-workspace-provisioning`

---

## 1. Workspace incompleto após o cadastro

**Origem:** código existente. **Status:** corrigido em `bf3cc80`.

### Sintomas

O login funcionava, mas o painel apresentava dois erros em sequência:

```
Organization is missing a slug
Organization permission required
```

### Causa

Em `packages/auth/src/index.ts`, o hook `user.create.after` (a chamada está na
linha 174) criava a organização e marcava o usuário como proprietário em
`tenantMember`, mas não preenchia três peças:

1. **slug da organização** — `tenant.slug` é `text("slug").unique()` sem
   `.notNull()` (`packages/db/src/schema/tenant.ts:40`), ou seja, aceitaria
   `NULL`. A rota do dashboard exige slug, então a org sem slug não tinha
   página.
2. **papéis e permissões** — o RBAC não era semeado.
3. **vínculo do proprietário** — o owner legado em `tenantMember.role` não
   satisfaz a cadeia que a autorização consulta
   (`tenantRoleAssignment → tenantRole → tenantRolePermission →
   tenantPermission`, em `packages/api/src/authorization/organization.ts`),
   daí o "permission required".

Por que o login passava: a sessão não depende de slug nem de RBAC. A falha só
aparecia quando o dashboard consultava a organização.

### Detalhe relevante

`backfillOrganizationRbac` **já existia** completo em
`packages/api/src/organization-rbac.ts:242` e não era chamada de lugar nenhum.
O reparo estava escrito, só nunca ligado.

### Correção

- Movido o seeding de RBAC de `packages/api` para `@whatsapp-flow/db`. Era
  obrigatório: `auth` não pode importar de `api` (dependência invertida) e o
  import direto criaria ciclo.
- Criado `provisionWorkspace` em `packages/db/src/provision-workspace.ts`:
  slug único e transliterado, seed do RBAC, role do owner, tudo em transação.
- Hook de signup passou a chamar `provisionWorkspace` diretamente.
- Criado `packages/db/scripts/backfill-organizations.ts` + `db:backfill` para
  reparar orgs já quebradas.

### Colisão de slug

Resolvida por hash, não por sufixo numérico. Testado: `"Herickson's workspace"`
→ `herickson-s-workspace`; `"李雷"` → `workspace-1bcff45a` (fallback quando não
há alfabeto latino). 8 casos passando.

---

## 2. Slug derivado do nome errado (bug introduzido por mim)

**Origem:** introduzido em `bf3cc80`. **Status:** corrigido em `9014eaa`.

`repairWorkspaceSlug` derivava o slug do nome da **organização**, que o signup
define como `"<nome do usuário>'s workspace"`. O resultado era
`herickson-s-workspace` em vez de `herickson-maia`.

### Correção

A função agora recebe o nome do **criador**, e o script de backfill faz
`innerJoin` com `user` para lê-lo.

---

## 3. `tenantRoleAssignment` sem import (bug introduzido por mim)

**Origem:** introduzido em `bf3cc80`. **Status:** corrigido em `9014eaa`.

Este é o mais grave dos que eu introduzi. O arquivo usava
`tenantRoleAssignment` na inserção da role do owner, mas o símbolo **nunca foi
importado** — aparecia só num comentário e no ponto de uso. Ou seja:
`provision-workspace.ts` **não compilava**.

Como não havia bun instalado no ambiente onde a mudança foi escrita, typecheck
não rodou e o erro passou. Só apareceu na revisão manual.

### Correção

Import adicionado em `packages/db/src/provision-workspace.ts`, junto de
`tenant` e `tenantMember`, vindos de `./schema/tenant`.

---

## Alarme falso (não é bug)

Um contador de chaves acusou `apps/server/src/index.ts` como desbalanceado
(`{}=+1`, `[]=+1`). **Não é erro.** É artefato do contador com o regex de
media-type na linha 169, que contém chaves e um backtick dentro:

```ts
return /^[!#$%&'*+.^_`|~\w-]+\/[!#$%&'*+.^_`|~\w-]+$/.test(mimeType)
```

A contagem é **idêntica** antes e depois das minhas mudanças, o que confirma que
não introduzi nada ali. Registrado para não ser reencaminhado depois.

---

## O que NÃO foi verificado

Isto é importante e deve acompanhar qualquer uso deste código:

- **Não rodou typecheck.** `bun` não está instalado no ambiente de
  desenvolvimento e o clone não tinha `node_modules`.
- **Não rodou a suíte de testes.**
- **Não rodou o build.**
- O backfill **não foi executado** contra um banco real. Ele exige
  `DATABASE_URL` válida em `apps/server/.env`.
- A camada de SSR/hidratação do provider de i18n não foi exercitada em
  execução.

O que **foi** verificado: a lógica pura de slug (executando, 8 casos) e a de
i18n (negociação `Accept-Language` com pesos `q=`, interpolação de placeholders,
fallback de chave inexistente). O resto foi checagem estática e revisão manual.

Antes de mergear:

```bash
bun install
bun run check:ci
```

O bug nº 3 é exatamente o tipo de falha que um `check:ci` pega em segundos e
custou uma revisão manual inteira para encontrar.

---

## Checklist pendente para o revisor

1. `provisionWorkspace` é idempotente quando a org já existe sem slug?
2. Existe corrida entre a checagem e a inserção do slug único? Duas requisições
   de signup simultâneas podem gerar o mesmo slug?
3. Se o hook falhar depois da criação do usuário, o usuário fica sem
   organização? (login funciona, painel não)
4. O backfill é seguro em produção com volume alto? Ele roda tudo em memória.
5. `createDb()` e os novos exports de `@whatsapp-flow/db` compilam?
6. O provider de i18n funciona em SSR, hidratação e navegação client-side?
7. O cookie `wf_locale` continua válido entre sessões?
8. Faltam chaves de tradução dinâmicas nos 70 dicionários?
9. Textos em inglês ainda existem hardcoded nas 28 rotas não traduzidas?
## Validação para integração na main — 2026-10-02

A revisão anterior acima registrava uma implementação ainda não validada.
Esta etapa corrigiu os bloqueios encontrados antes da integração:

- Lockfile atualizado para incluir o workspace MCP; instalação com
  `bun install --frozen-lockfile` confirmada sem alterações.
- MCP usa `appRouter.createCaller`, imports exportados corretamente e
  `tenantId` nas operações de leitura e alteração de fluxo.
- Schemas MCP gerados pelo Zod com argumentos, obrigatoriedade e enums reais.
- JSX da tela de login corrigido, chave de lista corrigida e tipo do roteador
  assíncrono ajustado; imports e formatação revisados.
- Mocks de testes existentes atualizados para os exports atuais de WhatsApp
  e transporte Meta. A suíte deve usar `bun test --isolate`, pois os mocks de
  módulos não podem contaminar os outros arquivos.

Validação executada com Bun 1.3.13:

- `bun install --frozen-lockfile`: passou.
- `VITE_SERVER_URL=https://n8n-whatsapp-flow-api.ubufeb.easypanel.host bun run check:ci`:
  passou (tipos, Biome e builds de Web/API).
- `bun test --isolate`: 206 testes passaram, zero falhas.

Limites: build local não substitui um deploy validado. O HTTP 500 em
`flow.list` do serviço antigo continua sem causa interna identificada.
O backfill não foi executado nesta etapa contra produção. Traduções ainda
cobrem o shell, login e partes do painel; as rotas restantes precisam de
tradução. MCP exige configuração de `MCP_ENABLED` e `MCP_TOKEN` na API;
esta integração não cria credenciais nem ativa o endpoint em produção.
Os itens de concorrência/idempotência do provisionamento listados acima
continuam como revisão pendente.
