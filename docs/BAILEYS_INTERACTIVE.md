# Mensagens interativas no WhatsFlow

## O que foi implementado

No editor de flows, os nós **Send Buttons**, **Send List** e **Quick Reply** agora
oferecem um seletor de envio. O padrão continua **Texto numerado (compatível)**;
flows existentes não passam a enviar formatos novos automaticamente.

- Botões de resposta com IDs estáveis, ligados às saídas `option:<id>`.
- Botões de URL separados das opções de resposta.
- Lista com seções, linhas, descrição e rótulo do menu.
- Imagem de cabeçalho por URL, corpo e rodapé.
- Respostas nativas normalizadas e retomada a partir do snapshot persistido.
- Campos novos e aviso de compatibilidade em português, inglês e espanhol.

## Limitação importante: envio nativo experimental

Baileys está fixado pelo lockfile em **7.0.0-rc13**. Seus protobufs descrevem
mensagens interativas e a biblioteca reconhece respostas, mas a interface padrão
`sendMessage` dessa versão não oferece um contrato de envio de botões/listas.
O modo nativo implementado usa os exports reais `prepareWAMessageMedia`,
`generateWAMessageFromContent` e `relayMessage` com `interactiveMessage` /
`nativeFlowMessage` (`quick_reply`, `cta_url`, `single_select`).

Isso **não comprova entrega nem renderização** em Android, iOS ou WhatsApp Web.
O histórico público do próprio Baileys registra falhas de exibição nesse tipo:
https://github.com/WhiskeySockets/Baileys/issues/1918.
Não se promete equivalência com o cartão da API oficial mostrado como referência.
Não foram feitos envios reais durante a implementação.

## Ativação no EasyPanel

1. Publicar **API e web** a partir da `main` de `WorkiDigital/whatsflow`.
2. No serviço **whatsapp-flow-api → Ambiente**, adicionar apenas se quiser testar:

   ```dotenv
   BAILEYS_NATIVE_INTERACTIVE=true
   ```

3. Salvar e implantar novamente a API.
4. No editor, selecionar um dos nós interativos e escolher
   **Nativo Baileys (experimental)**. Usar dispositivo Baileys conectado e chat privado.
5. Fazer um teste manual em um número de teste autorizado, verificando a mensagem
   no celular e o retorno da opção para a ramificação do flow.

Não há nova migration, banco ou serviço. Não modificar serviços n8n existentes.
Para desativar: `BAILEYS_NATIVE_INTERACTIVE=false` e voltar os nós ao modo texto.

## Validação e comportamento

- Nativo: corpo de 1–1024 caracteres, rodapé até 60, até 3 botões no total,
  com ao menos uma resposta; lista de 1–10 linhas, sem seções vazias.
- IDs únicos, não vazios e sem espaços externos; rótulos até 24 caracteres.
- URL HTTP(S) sem credenciais; rótulo do menu até 20 caracteres.
- URL abre o navegador: **não dispara resposta nem ramificação**. O flow aguarda
  uma opção de resposta ou o timeout. Mensagens apenas com CTA não são suportadas
  nesses nós de espera; inclua pelo menos uma resposta.
- Texto: opções numeradas; imagem e botões de URL viram links no corpo.
- Meta Cloud API aceita esse modo texto, mas rejeita o transporte experimental.
- Não há fallback automático depois de falha nativa: o envio pode ter acontecido,
  e reenviar como texto poderia duplicar mensagens.
- `send-template` permanece reservado a templates aprovados da Meta. Templates
  legados recebidos são reconhecidos, mas não se habilitou seu envio pelo Baileys.
- Enquetes nativas existentes permanecem inalteradas. Chamadas de voz/vídeo não
  foram incluídas nesta alteração.

## Verificação antes de uso

Rodar `bun install --frozen-lockfile`, `bun run test` e `bun run check:ci`.
Os testes verificam protobuf, IDs, validação, feature flag, retorno por opção,
snapshot após reinício, modo texto e isolamento entre provedores. São testes
locais com sockets/HTTP simulados, não uma confirmação de funcionamento no WhatsApp.

Resultado local nesta implementação: `bun test --isolate` com 235 testes passando;
`bun run check:ci` passou (typecheck, lint e builds da API/web). Avisos já existentes
de lint e de tamanho do bundle não impedem o build.
