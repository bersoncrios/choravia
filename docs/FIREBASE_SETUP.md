# Firebase — Execução e publicação

Projeto fornecido pelo usuário: **wildwoods-b3684**, com Google Authentication e Firestore já configurados segundo o usuário. A configuração pública do cliente foi salva em `.env.local`, ignorado pelo Git. Não há chave de conta de serviço no frontend. Analytics não foi ativado; measurementId não é usado.

## Estado desta entrega

O cliente usa Auth e Firestore diretamente para save, inventário, encontros, desafios, trocas e GM. Não usa Cloud Functions nem App Check/reCAPTCHA. Consulte [a migração e seus limites de confiança](FIRESTORE_DIRECT.md). A publicação em produção é uma etapa separada da alteração local.

## Cliente real

```sh
npm ci
npm run dev
```

Abra `http://localhost:5173` para testar o endereço local. Confirme no Authentication que `localhost` está em Authorized domains, sem protocolo ou porta. Projetos criados após 28/04/2025 não incluem esse domínio automaticamente; não foi possível verificar a lista do projeto real neste ambiente. Google continua sendo a alternativa quando o provedor anônimo não estiver habilitado; não é necessário recriar o banco ou os usuários.

O cliente prepara Firebase Auth em segundo plano, mas movimento, captura e comandos ficam bloqueados até haver uma conta Google. O primeiro acesso cria a conta; se o Google já possuir conta, o jogador pode abri-la explicitamente, sem mesclar inventários. O login Google pode vincular a sessão anônima interna; essa sessão nunca libera jogo visitante.

### Aviso COOP no popup Google

Vite (dev/preview) e Firebase Hosting declaram `Cross-Origin-Opener-Policy: same-origin-allow-popups`, compatível com o fluxo de popup. Reinicie o Vite após alterar sua configuração; para Hosting, publicar só a build não atualiza cabeçalhos, é preciso aplicar a configuração de Hosting. Esta alteração ainda não foi publicada automaticamente.

`Cross-Origin-Opener-Policy policy would block the window.closed call` pode aparecer durante o monitoramento do popup pelo SDK, inclusive com autenticação concluída. Os cabeçalhos da janela Google não são controlados pelo aplicativo. O resultado de signInWithPopup/linkWithPopup e a identidade Google na interface determinam se o login concluiu; um erro `auth/*` ou a ausência de sessão exige investigação adicional. Não suprimir o console nem trocar automaticamente para redirect, que tem requisitos próprios de domínio e armazenamento.

Referências: [política de popup recomendada pelo Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#cross_origin_opener_policy), [relato no SDK Firebase com login concluído e esse aviso](https://github.com/firebase/firebase-js-sdk/issues/8541), [requisitos do fluxo redirect](https://firebase.google.com/docs/auth/web/redirect-best-practices).

### Resultado do login separado dos serviços online

A interface agora confirma “Login Google concluído” somente após a operação de autenticação retornar com sucesso. Erros de Authentication aparecem numa área própria com o código real `auth/...`. Falhas posteriores ao carregar inventário/trocas ficam sob “Serviços online” e não transformam uma autenticação bem-sucedida em falha de login.

Se o popup fecha sem entrar, use esse código para diagnosticar: unauthorized-domain exige autorizar localhost; popup-closed-by-user indica fechamento ou perda de comunicação; network-request-failed exige identificar a URL bloqueada na aba Network. O aviso COOP não contém essa informação. Não foram alterados CORS do Firestore, App Check, Rules ou as proteções do navegador.

Não houve troca automática para redirect em localhost: a recomendação oficial exige um domínio/handler compatível com as restrições de armazenamento entre sites. A configuração atual usa o handler do domínio Firebase e o aplicativo em localhost, portanto uma conversão às cegas poderia introduzir uma falha adicional.

Referência adicional: [Firebase Auth: domínios autorizados e localhost](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

O jogo não utiliza App Check/reCAPTCHA. As variáveis `VITE_FIREBASE_APPCHECK_*` não são utilizadas. No Console Firebase → App Check, desative enforcement nos serviços usados pelo jogo se estiver ativo, incluindo Firestore/Authentication. Essa configuração remota não é alterada pelas Security Rules.

Publique o frontend atualizado e as Rules/índices; não é necessário publicar Functions:

```sh
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project wildwoods-b3684
```

### Painel Game Master

O botão do painel consulta `users/{uid}.role` no documento próprio do jogador. Para liberar sua conta, encontre o UID em Authentication → Users e crie/edite `users/{uid}` no Firestore com `role` do tipo string e valor `admin`, depois recarregue o jogo. Usuários sem esse campo são jogadores normais. Regras deixam o jogador atualizar apenas o próprio perfil autenticado, sem permitir editar role. O painel usa Firestore diretamente. As Security Rules exigem a role de administrador; gravações administrativas têm recibo de auditoria. Publique as Rules atualizadas para habilitá-lo.

## Salvar progresso pessoal na conta Google

O perfil autenticado mostra nome, email e foto/avatar e mantém esses campos em users/{uid}. As regras conferem os valores com o token Auth e bloqueiam edição de role pelo cliente. O estado da expedição na conta fica em users/{uid}/online/state; o save pessoal do jogo fica em users/{uid}/saves/solo. O bootstrap migra documentos legados automaticamente.

O save pessoal usa Firestore diretamente em users/{uid}/saves/solo e não depende de publicar Functions. As regras novas em firestore.rules permitem somente o dono, validam os campos e impedem recuo da revisão e listagem pública; criaturas e trocas usam regras próprias de propriedade e transações. Se App Check estiver imposto no próprio Firestore pelo console, desative essa exigência para usar o cliente sem App Check.

Quando não houver save remoto, a primeira conta pode receber a expedição do visitante, cujo cache é preservado. Quando houver save remoto e nenhum cache daquela conta, o jogo o restaura. Alterações concorrentes pedem escolha, mantendo backup. O indicador distingue gravação local, envio pendente e confirmação da conta.

Se o aplicativo mostrar permission-denied, inspecione as regras atuais em Firestore Database → Rules e aplique as regras da entrega, preservando políticas de outras coleções usadas no projeto. As regras não foram publicadas automaticamente neste ambiente. Nenhum estado pessoal é promovido a inventário validado; negociações usam transações do Firestore.

Detalhes de protocolo, conflitos e tamanho: CLOUD_SAVE.md.

## Emuladores: banco isolado

Use uma versão atual do Firebase CLI com suporte a Node 22 e Java compatível com o emulador. `.firebaserc` mantém o projeto padrão **demo-wildwoods** para os testes, e o alias **production** aponta para o projeto real.

```sh
npx firebase-tools emulators:exec --only auth,firestore --project demo-wildwoods "npm run test:emulator"
```

Esse comando deve falhar se a suíte não puder iniciar; não considerar testes ignorados como aprovação das regras. O script recusa projeto real e hosts externos. As verificações exercitam Rules, save pessoal, captura/replay, aceites concorrentes e expiração contra os serviços emulados reais.

Para jogar usando emuladores, preserve seu `.env.local` real, crie uma cópia dele e substitua temporariamente o conteúdo pelo `.env.example`. Inicie os emuladores com `emulators:start` e reinicie o Vite. O adaptador só aceita emuladores em uma origem local e com projectId começando por `demo-`; isso impede apontar os testes para o banco real por engano.

Portas: Auth 9099, Firestore 8080 e UI 4000. Hub/logging também precisam abrir portas próprias. Trocar somente a porta da UI não resolve o bloqueio EPERM observado aqui.

## Preparação para publicar no projeto existente

Antes de publicar, inspecione as Rules existentes e preserve políticas de coleções que não pertençam ao jogo. Execute build, testes e suíte emulada. Publique as Rules/índices pelo comando acima e o frontend na Vercel. A migração não apaga dados nem funções existentes.

Após publicar, validar duas contas independentes: capturar online, oferecer, fechar a página do remetente, aceitar na outra conta e conferir propriedade ao retornar. Validar também falta de rede antes/depois do commit, token rotacionado e regras de leitura. Nenhuma criatura do save local pode ser promovida a negociável.

## Fontes oficiais

- [Firebase Auth anônimo e vinculação](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Google Authentication na web](https://firebase.google.com/docs/auth/web/google-signin)
- [Transações e validação atômica com getAfter](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Testar com Emulator Suite](https://firebase.google.com/docs/emulator-suite/connect_and_prototype)
- [Condições das Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
