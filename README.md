# Choravia

Jogo de exploração e captura em Angular standalone, Signals, TypeScript estrito e HTML5 Canvas. Quatro áreas estão conectadas em uma expedição única por conta Google; save, encontros e trocas usam Firestore direto e aguardam homologação de produção.

## Executar

Use Node 22.12+ da linha 22 ou Node 24 (veja `.nvmrc`).

```sh
npm ci
npm run dev
```

Abra a URL impressa pelo Vite, normalmente `http://127.0.0.1:5173`. O jogo precisa de uma origem HTTP local ou HTTPS para os recursos de persistência e bloqueio entre abas. Não abra `index.html` diretamente pelo explorador de arquivos.

## Publicar na Vercel

`vercel.json` fixa o build de produção em AOT (`npm run build`) e publica somente `dist/`. No projeto Vercel, a raiz deve ser a pasta deste repositório. Após cada deploy, o HTML deve carregar um arquivo `/assets/index-*.js`; `/src/dev.ts` é apenas a entrada de desenvolvimento.

```sh
npm test
npm run build
npm run build:backend
npm run test:browser
```

`test:combat` verifica fases, PV intermediários, recargas, as cinco habilidades, captura e retomada no combate clássico. `test:ui` cobre também a compatibilidade tática e os diálogos. Todos usam identidades fictícias em memória, sem criar usuários reais.

`test:browser` precisa do servidor local em execução e de Google Chrome instalado; `CHROME_PATH` aceita outro caminho de executável Chromium. O teste cria um perfil temporário, sem acessar seu perfil pessoal. `build` compila templates Angular em modo estrito com AOT, aplica o linker do Angular às bibliotecas parciais e gera `dist/` estático. A compilação falha se uma declaração parcial não for ligada. O modo de desenvolvimento usa JIT; a produção não inclui o compilador de templates.

## Jogar

- Entrar com Google é obrigatório antes de mover o personagem. No primeiro acesso, escolha tom de pele, cabelo, cor do cabelo, roupa e acessório; as opções iniciais são gratuitas e podem ser alteradas depois nas configurações.
- Após criar a aparência, escolha um dos cinco Ecos iniciais. Você começa com 120 Sementes; aproxime-se de um vaso e pressione `E` para quebrá-lo e ganhar mais 8 uma única vez.
- Davi, no caminho a leste da primeira clareira, aceita um duelo opcional; vencê-lo uma vez rende 24 Sementes. Duelo não permite capturar o Eco do NPC.
- Na Clareira Antiga, restaure o santuário ativando os selos de Fogo, Eletricidade e Terra com Ecos correspondentes; a solução rende 40 Sementes.
- Abra **Loja** no cabeçalho para comprar cosméticos com Sementes. A capa, lenço e broche personalizam o Guardião; a Marca de musgo decora o Eco ativo; as Botas de trilha aceleram um pouco a caminhada sem mudar batalhas. Não há compras com dinheiro real.
- WASD/setas ou direcional touch para caminhar. A grama clara ao norte inicia um encontro após oito passos.
- Nos novos encontros, escolha Atacar, a habilidade elemental do seu Eco, Defender, Vínculo ou Fugir. A interface mostra sua ação e depois a resposta do adversário; só então libera a próxima escolha. Acelerar conclui a apresentação da rodada. A habilidade exige uma rodada de recarga. Combates táticos já salvos conservam a grade até terminarem.
- Reduza a vida selvagem a 50% ou menos e use Vínculo. No modo clássico não existe requisito de distância. O primeiro vínculo elegível é garantido. Evite zerar a vida.
- Com Braseco de PV cheios, no primeiro encontro guiado, use três ataques básicos em Brotatu e então Vínculo. Para outros Ecos ou encontros, acompanhe os PV: não derrote o alvo antes de capturar.
- Iara, de roupa amarela no caminho a oeste do início, recupera a coleção gratuitamente. Escolha outra criatura saudável no painel Seus Ecos.
- Caminhe pelo caminho central para leste até o Arco Enraizado para chegar à Clareira Antiga; atravesse o arco novamente para voltar.
- Na Clareira Antiga, aproxime-se da pedra central e pressione `E` ou use Ouvir o marco para descobrir uma lembrança.
- O menu superior permite som, movimento reduzido, pulso ritual opcional e exportação do save. O timing do pulso não muda a probabilidade de captura.
- Com acesso administrativo, o botão **GM** permite consultar por UID ou buscar prefixo do nome, conceder Sementes/cosméticos com auditoria, redefinir save com confirmação e ver o histórico. Defina manualmente `users/{uid}.role = "admin"` no Firestore. As operações usam Firestore direto e exigem login e role autorizada pelas Security Rules; encontros e trocas usam transações protegidas pelas Rules.

## Persistência e limites

IndexedDB mantém snapshot versionado e backup, incluindo batalhas em andamento. Apenas uma aba grava por vez usando Web Locks; navegador sem esse recurso pode jogar em sessão temporária. Falha de gravação interrompe novas mutações e permite exportar o estado; recarregue para recuperar o snapshot persistido. A exportação é para recuperação manual: importação ainda não possui interface.

Existe uma única expedição vinculada à conta Google. Mundo, personagem, PV, saldo e coleção usam o mesmo save da conta, com cache local para recuperação. A coleção antiga é reconciliada com o inventário de trocas por IDs e recibos estáveis; repetir a migração não duplica Ecos nem recupera criaturas já transferidas. As ações aceitas desta expedição contam para as Trilhas do dia. Sem conexão, a expedição pausa. O cliente grava a conta, o inventário e as recompensas por transações Firestore. As Rules protegem propriedade e transferências; os resultados de batalha são calculados no navegador. Nenhum analytics externo está ativo. Eventos locais ficam numa fila dos últimos 100 registros; eventos da conta são gravados com IDs determinísticos.

## Firebase e trocas

O mapa não libera movimento até entrar com Google. A primeira autenticação cria ou acessa a conta; depois, o jogador escolhe a aparência gratuita do Guardião e um Eco inicial. O cabeçalho identifica a conta e o painel mostra nome, email e foto/avatar, com Trocar conta e Sair. O perfil Auth fica em `users/{uid}`; o progresso de jogo fica em `users/{uid}/saves/solo`, sem email/nome/foto. A caminhada é agrupada em intervalos de 1,5 s e ações importantes solicitam sincronização imediata. O indicador só mostra “Progresso salvo na conta Google” depois da confirmação do Firestore.

Visitante e cada conta usam caches separados. Entrar em outro dispositivo restaura o save da conta; alterações concorrentes oferecem escolha entre as versões, com backup local. Sair retorna ao visitante. Esse salvamento pessoal não depende de Cloud Functions, mas precisa das regras de acesso em `firestore.rules`. Se aparecer `permission-denied`, confira e publique as regras no projeto; não liberar escrita geral no banco.

O save pessoal continua sem autoridade sobre as criaturas negociáveis. Detalhes e limites: [perfil e salvamento](docs/CLOUD_SAVE.md).

A configuração fornecida para `wildwoods-b3684` está em `.env.local`. A integração usa o Google Authentication e o Firestore desse projeto; não recria esses recursos. O SDK carrega depois do mapa. Se o login anônimo estiver desabilitado, use Entrar com Google. Conta anônima pode ser vinculada ao Google; conta já existente é aberta explicitamente, sem merge de inventários.

O cliente usa Firestore direto, sem Cloud Functions ou reCAPTCHA. As Rules atualizadas precisam ser publicadas. Encontros, inventário e trocas usam transações do Firestore; a sincronização pessoal usa Firestore diretamente, conforme as regras do projeto. A interface mantém o jogo disponível enquanto esses serviços estiverem em preparação. Ver [configuração e execução Firebase](docs/FIREBASE_SETUP.md).

Depois da homologação e publicação, a interface permite ofertar um Eco da conta por uma espécie, gerar/copiar/compartilhar link, visualizar oferta, selecionar a criatura de resposta, confirmar, cancelar e substituir link. Oferta bloqueia a criatura e expira em 24 horas. O token só integra o fragmento do link e a memória da página; Firestore guarda seu hash e recebe uma prova do token na conclusão da troca.

Para executar testes reais nos emuladores, sem usar o banco de produção:

```sh
npm run build:backend
npx firebase-tools emulators:exec --only auth,firestore --project demo-wildwoods "npm run test:emulator"
```

É necessário Firebase CLI atual e Java compatível. O teste recusa projeto real e endereços externos. A revisão de expedição única aprovou 11 testes nos emuladores Auth/Firestore com dados isolados; isso não substitui a homologação no projeto de produção. Veja o [registro de validação](docs/SINGLE_EXPEDITION.md).

## Arquitetura e validação

`src/app/domain` contém regras e contratos puros; `application` orquestra a expedição da conta, cache de recuperação, reconciliação de inventário e portas; `adapters` implementa Canvas, áudio, IndexedDB e Firebase; `ui` contém Angular e controles. `src/app/domain/online-engine` contém o motor transacional compartilhado. `functions/src` preserva adaptadores legados, sem uso pelo cliente. Ver [migração para Firestore direto](docs/FIRESTORE_DIRECT.md). Assets são desenhados por código, sem imagens ou fontes remotas.

A documentação em [docs/README.md](docs/README.md) reúne design e backlog. Verificações e limites estão nos relatórios da [Sprint 1](docs/SPRINT_1_REPORT.md) e [Sprint 2](docs/SPRINT_2_REPORT.md). A meta de 5 segundos, a compatibilidade visual mobile e o fluxo com duas contas reais exigem homologação; build e testes em memória não comprovam esses resultados.

Expedição única e migração: [SINGLE_EXPEDITION.md](docs/SINGLE_EXPEDITION.md). Para verificar o fluxo completo sem Firebase real, use `npm run test:account` com o servidor local ativo. As novas Rules e o frontend precisam ser publicados juntos; esta revisão não publica automaticamente.

As atualizações de coleção ocorrem em segundo plano após a preparação inicial da conta, com tentativas automáticas em falhas transitórias. O indicador de salvamento fica junto ao perfil; detalhes estão em Configurações. Conflitos entre dispositivos exigem escolha explícita. Veja [sincronização em segundo plano](docs/BACKGROUND_SYNC.md).

## Apresentação e navegação

A raiz `/` apresenta Choravia, seu mundo e os cinco Ecos iniciais. **Começar minha jornada** leva a `/entrar` quando não há sessão; com uma conta conectada, **Continuar minha jornada** abre `/jogar`. A marca no jogo permite voltar à apresentação preservando a expedição. Links de troca em `/troca/{id}` continuam abrindo o fluxo existente.

O sistema visual compartilhado define cores, fontes locais, controles e layouts para celular, tablet e desktop. Veja [sistema visual](docs/UI_DESIGN_SYSTEM.md). `npm run test:welcome` verifica a apresentação e a navegação com identidades simuladas; os testes de jogo entram diretamente por `/jogar`.

O botão **Menu** abre os painéis laterais **Mapa e diário**, **Mochila e missão**, **Companheiro**, **Trilhas do dia** e **Conta e trocas**, liberando a área principal para o mapa. Feche pelo botão, por Escape ou pelo fundo. A conta permanece conectada com o painel fechado.

Administradores podem usar **GM → Conteúdo e eventos** para criar acessórios de broche/lenço/coroa com cor e preço, ajustar PV/ataque/defesa dos Ecos e criar/conceder badges de eventos ou marcos por UID. Badges aparecem no painel Companheiro. As alterações têm auditoria e revisão para conflitos entre GMs. Esta feature requer as novas Rules junto do frontend; veja [operação de conteúdo](docs/GM_LIVE_OPS.md) e `npm run test:live-ops`.


## Coleta renovável e missão de campo

Na clareira inicial, novos pontos de erva, fruto, seiva e cristal renovam às 00h UTC. Há um baú único que permanece aberto e um esconderijo que muda de lugar por ciclo. Pressione E perto de um ponto ou use o botão contextual. Vasos antigos deixam cacos e conservam suas recompensas já recebidas.

Em **Menu → Mochila e missão**, reúna 2 ervas e 2 seivas, fabrique uma lanterna e entregue no marco de Iara para restaurar sua luz. Os novos materiais usam um ledger próprio da conta, recibos imutáveis e ciclos verificados pelas Rules, sem alterar o formato do save antigo. Esta entrega requer frontend e Rules compatíveis; não foi publicada. Veja [regras e limites](docs/FIELD_EXPLORATION.md), [diagnóstico e roadmap](docs/EVOLUTION_ROADMAP.md) e `npm run test:field`.


**Menu → Mapa e diário** mostra o circuito das quatro regiões, locais visitados e o Diário dos Ecos. Encontros e duelos registram observações; as descobertas permanecem após trocas, enquanto o diário distingue as espécies da coleção atual. Saves antigos recuperam somente fatos ainda presentes no snapshot. Veja [diário de exploração](docs/EXPLORATION_JOURNAL.md) e `npm run test:journal`.


## Atividades de campo e apresentação sonora

Os cinco elementos ajudam a restaurar mecanismos nos mapas existentes; cada um também tem solução manual gratuita. A ponte restaurada da Gruta das Marés abre uma travessia opcional. **Mapa e diário → Atividades de campo** registra as memórias recuperadas e os treinos. Depois de vencer um duelista, ofereça uma revanche para registrar estratégia, vitórias e melhor rodada, sem repetir Sementes ou XP. Veja [habilidades e treino](docs/FIELD_ABILITIES_AND_TRAINING.md) e `npm run test:activities`.

Em **Configurações**, ative **Sons da floresta** e ajuste **Volume geral**, **Música**, **Ambiente** e **Efeitos**. Os biomas e combates têm motivos sintetizados localmente; passos, ações e recompensas têm sons distintos. O som começa após uma interação e para quando a aba fica oculta ou a expedição deixa de estar ativa. Preferências antigas são preservadas. Veja [áudio e polimento visual](docs/AUDIO_AND_MAP_POLISH.md) e `npm run test:audio`.
