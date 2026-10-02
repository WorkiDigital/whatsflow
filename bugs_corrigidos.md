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

## Painel de conexão MCP — 2026-10-02

Nova opção **MCP** no menu lateral, em
`/dashboard/<organizationSlug>/mcp`, com URL do endpoint, geração/cópia,
exibição temporária, renovação e revogação do token da própria conta.
A tela está traduzida para português, inglês e espanhol.

O token completo só é devolvido ao ser gerado e permanece no estado local da
tela. O banco armazena um hash SHA-256 e um prefixo. Consultar a conexão não
retorna o segredo. Rotacionar invalida o hash anterior; revogar preserva uma
marca que também bloqueia credenciais antigas da variável MCP_TOKEN para
esse usuário. Contas suspensas não autenticam e não emitem credenciais.
As ferramentas continuam respeitando as permissões por organização.

A nova migration **0006_mcp_tokens** cria `mcp_token` sem alterar dados nas
tabelas existentes. O verificador de migrations reconhece corretamente os
bancos que ainda estão nas seis migrations anteriores.

Antes de publicar esta versão:

1. Aplicar as migrations com `bun run db:migrate` no ambiente da API.
2. Manter `MCP_ENABLED=true` na API para aceitar conexões.
3. Publicar Web/API da main e abrir a opção MCP para gerar o token.

Não é necessário configurar MCP_TOKEN para os tokens gerados na interface.
A variável continua suportada para compatibilidade de contas sem token
emitido/revogado no banco.

Validação: check:ci (tipos, Biome e builds) passou; 216 testes passaram com
`bun test --isolate`, incluindo emissão, rotação, revogação, bloqueio sem
login/conta suspensa e o reconhecimento da nova migration. A migration não
foi executada contra o banco de produção nesta etapa; os testes do ciclo de
token usam um banco simulado. Deploy e teste de navegação em produção seguem
pendentes.

## Seletor de idioma sem resposta — 2026-10-02

A interface usa Menu.Item do Base UI. O seletor de idiomas foi implementado
com `onSelect`, um evento que não é acionado por esse item ao clicar ou
ativar a opção. A correção usa o `onClick` suportado pelo componente.

O roteador no cliente também passou a ler `wf_locale` ao iniciar, em vez de
sempre iniciar com inglês; o documento SSR recebe o idioma do contexto.
Assim a escolha explícita continua sendo usada após recarregar a página.

Teste de interação com React Testing Library e jsdom monta o menu real,
clica em Português e Español, verifica o texto traduzido, o cookie e o
atributo lang, e remonta o provider usando a escolha salva. O teste falhou
com o handler antigo e passou após a correção. Suíte: 217 testes passaram.
Esta etapa modifica o código; a correção precisa do deploy da Web para
chegar à instância publicada.
# Mensagens interativas Baileys — 2026-10-02

- Os nós de botões/lista/respostas rápidas antes enviavam apenas texto, apesar de
  o recebimento reconhecer IDs de mensagens interativas.
- Adicionado transporte protobuf experimental, opt-in por variável da API e por
  nó, com modo texto preservado como padrão. Entrega real ainda requer teste.
- Botões URL não entram nas saídas de resposta; IDs e rótulos resolvidos ficam no
  snapshot da sessão. ID nativo desconhecido não é aceito por coincidência de texto.
- Configuração e aviso no frontend em PT/EN/ES; detalhes em
  [docs/BAILEYS_INTERACTIVE.md](docs/BAILEYS_INTERACTIVE.md).
- `bun run test` agora inclui os testes do web e isola arquivos do pacote WhatsApp,
  evitando que mocks de conexão de um arquivo contaminem os demais.

## HTTP 500 ao abrir Fluxos (`flow.list`) — 2026-10-02

Os logs da API mostraram falha na consulta de `flow.list`; a Web apenas
propagava `Internal server error`. A sessão respondia HTTP 200.

Causa reproduzida com a consulta SQL gerada pelo código de produção em
PostgreSQL via PGlite: `22P02`, `invalid input value for enum
flow_access_capability: "owner"`. O enum do banco contém somente `viewer`
e `editor`, mas a consulta usava `coalesce(capability, 'owner')`. PostgreSQL
tentava converter `owner` para esse enum ao analisar a consulta, mesmo
quando a organização não possuía nenhum fluxo. A anotação de tipo do
TypeScript não converte o tipo SQL.

Correção: `coalesce(capability::text, 'owner')`. `owner` permanece um rótulo
derivado na resposta; não foi adicionado ao enum de concessões. A consulta
foi extraída para `buildFlowListQuery`, usada tanto pelo endpoint quanto
pelo teste. Os filtros por organização e usuário continuam na consulta;
esse rótulo não concede permissões e o middleware de autorização permanece.

Por que escapou: os testes anteriores de listagem devolviam linhas de um
banco simulado, sem executar SQL. Typecheck e build também não verificam
conversões de enums no PostgreSQL.

Prevenção: novo teste executa o SQL real gerado pelo Drizzle em PGlite,
com o enum restrito a `viewer`/`editor`, cobrindo organização vazia,
concessões e isolamento dos filtros por organização/usuário. Os dois testes
falharam com o código antigo e passaram com a conversão para texto. PGlite
é uma dependência apenas de desenvolvimento/teste; produção continua com
PostgreSQL via node-postgres.

Publicação: reimplantar `whatsapp-flow-api` da `main` corrigida. Esta correção
não exige migration, mudança de variáveis de ambiente nem deploy da Web.
Após o deploy, abrir Fluxos e confirmar que `flow.list` responde sem HTTP 500.
Os testes locais não comprovam o estado da instância publicada.

## 2026-10-02 — Tradução incompleta no painel

**Sintoma:** selecionar Português alterava a navegação, mas várias telas, campos, botões e avisos continuavam em inglês.

**Causa:** o idioma já era persistido corretamente; faltava conectar os textos das páginas e componentes ao provedor de tradução. A paleta e os nomes padrão dos blocos também eram exibidos diretamente a partir de constantes em inglês.

**Correção:** catálogo de textos da interface em português e espanhol, consumido pelas páginas de dispositivos, fluxos, sessões, contatos, grupos, canais, conversas, webhooks, registros, auditoria, usuários, funções, conta e configurações. O editor traduz a paleta, os nomes padrão e os formulários sem alterar os dados salvos. Nomes personalizados, mensagens dos contatos, números, tokens, URLs, identificadores técnicos e diagnósticos desconhecidos mantêm o conteúdo original.

**Prevenção:** teste estático impede novos textos literais em JSX e atributos de interface do painel e exige traduções dos textos usados com `panelT`. Testes de interação mudam o idioma em componentes reais, verificam tabelas, campos e estados vazios, e confirmam que a tradução dos blocos não modifica os dados do fluxo. Ao adicionar texto de interface, usar o provedor e incluir português/espanhol no catálogo; não traduzir valores persistidos nem opções enviadas à API.

**Publicação:** implantar `whatsapp-flow-web` a partir da `main` com `Dockerfile.web`. Esta alteração não exige migração de banco nem alterações na API. A situação de cada implantação deve ser confirmada no EasyPanel antes de declarar a atualização disponível em produção.
