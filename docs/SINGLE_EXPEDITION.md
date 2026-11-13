# Expedição única da conta Google

## Decisões

- A conta Google tem um único mundo, personagem, saldo, coleção e fluxo de batalha. O save da conta existente continua no caminho `users/{uid}/saves/solo` por compatibilidade; o nome interno não representa um segundo modo de jogo.
- A sessão persistida do mundo é a fonte de mapa, PV, aparência, progressão, loja, selos e duelos. O inventário de ativos é reconciliado com essa coleção para manter trocas e preservar Ecos já existentes na conta.
- Converter IDs antigos de captura pessoal em IDs globais determinísticos por conta/origem, com recibos de importação imutáveis. Não recriar um Eco já transferido. Preservar nível/XP, PV, cosmético, personagem e progresso. O inicial escolhido substitui o inicial provisório da conta somente quando ele não teve progressão, reserva ou escolha anterior.
- Novas ações usam o mesmo motor puro existente, com save da conta e cache de recuperação. Sem opção de explorar sem conexão ou voltar a uma expedição separada. Conta, conexão e sincronização precisam estar disponíveis.
- Trilhas contam ações aceitas da única expedição. Enviar apenas tipos de objetivos suportados; progresso e recibos diários/semanais são monotônicos e idempotentes nas transações existentes. Fila pequena por conta/dia permite recuperar envios interrompidos. Ações pessoais anteriores não concedem recompensas retroativas.
- Preservar as transações e os dados de trocas e encontros anteriores. Um encontro da antiga coleção online deve ser concluído/encerrado antes da reconciliação completa.
- A arquitetura continua sendo cliente + Firestore direto; não afirmar validação independente de resultados pelo servidor. Importação e progresso reportado pelo cliente têm o mesmo limite de confiança dessa arquitetura e não se destinam a moeda comprada ou PvP competitivo.
- Remover seleção de modo, botões de entrar/sair de expedição e textos de coleções separadas. As Rules precisam contemplar os recibos de importação; preparar as alterações locais sem publicar.

## Validação prevista

Preservação de dados, migração/repetição sem duplicação, inicial escolhido, não ressurreição após troca, progressão sem downgrade, trilhas idempotentes e fila por conta/dia. Build e regressões do motor; Chromium com adaptadores simulados para fluxo único, conexão, loja, duelos, captura, trilhas e retomada.

## Implementação e persistência

- `account-expedition.ts` reconcilia a coleção completa sem inferir exclusões a partir de uma página; conserva PV, XP, cosméticos, ativo e flags do mundo. `mergePreviousEncounter` preserva inclusive uma batalha pendente do mundo ao finalizar um encontro do modo antigo.
- `syncExpedition` usa lotes de até 100 entradas, mapeia fontes antigas para recibos imutáveis e consulta primeiro o inventário filtrado pelo proprietário. Isso evita ler um documento privado depois que o Eco foi transferido. O inicial provisório só pode mudar uma vez e apenas se ainda não foi usado/reservado.
- Correção de sincronização: o inventário completo é consultado em páginas de 1.000 documentos por ID, com cursor, em vez de solicitar `limit(100000)` (rejeitado pelo Firestore em produção). A paginação preserva Ecos das páginas seguintes e a filtragem por proprietário.
- Esse erro de consulta mantinha `accountSynchronized` falso e, por consequência, bloqueava o movimento do personagem. Regressão de paginação com 1.001 Ecos, preservação de IDs da segunda página e exclusão de Eco de outra conta aprovada; suíte completa com 116 testes e build de produção aprovados.
- `Session.reconcile` serializa a mesclagem com gravações de recompensa em andamento. A leitura inicial do cache tolera até três segundos para dispositivos ocupados; erros continuam preservando o backup.
- O save da conta registra, na mesma transação, `users/{uid}/expedition/status` com `activeCreatureId`, `saveRevision` e `updatedAt`. Serviço e Rules impedem reservar/transferir esse Eco enquanto sua batalha está salva como ativa. O marcador é liberado ao salvar o término.
- `recordExpeditionDaily` aceita somente os quatro objetivos conhecidos e o ciclo atual. A fila em armazenamento local tem chave por UID e dia; novas ações durante um envio são reenviadas ao terminar. Recibos existentes continuam impedindo duplicação de Sementes e cosméticos.
- A interface solicita Google sem criar sessão anônima automaticamente. Os dados de sessões antigas continuam disponíveis para vinculação/recuperação, sem oferecer um modo de visitante.
- Reservas de troca continuam impedindo o uso do Eco em outra batalha; o jogador pode selecionar outro Eco. Loja, aparência e ações do mundo usam o mesmo saldo/progresso, e trocas usam a mesma coleção.

## Validação

- `npm test`: **113 testes aprovados**, incluindo migração repetida, preservação de inicial com progressão, isolamento de contas, não recriação após transferência, salvamento de coleção reconciliada, fila por conta/dia, recibos idempotentes, recompensa concorrente e retomada de encontro antigo sem substituir o mundo.
- Emuladores reais de Auth e Firestore: **11 testes aprovados**, com as Rules locais. Incluem importação, repetição sem duplicação, troca seguida de sincronização das fontes antigas/validadas, consultas privadas, trilhas idempotentes e proteção do Eco ativo contra troca em outro dispositivo.
- Chromium: expedição única, inicial escolhido, preservação de aparência/mundo, loja, captura, conclusão das três trilhas, repetição sem nova recompensa, pausa sem conexão e responsividade. Adaptador transacional em memória, com cache IndexedDB real do perfil de teste, sem acessar o projeto Firebase real.
- Regressões de combate clássico em sete dimensões, interface/personalização em sete dimensões e cabelo/trilhas com falhas simuladas também aprovadas. Capturas em `artifacts/account-expedition-*.png` (não versionadas).

## Publicação

Publicar **frontend e Firestore Rules juntos**, preservando as demais coleções e permissões do projeto. Não publicar Functions. As novas Rules autorizam importação com recibos próprios e o marcador da batalha do mundo; o frontend novo não deve ser usado com Rules antigas. O caminho do save permanece `saves/solo` para não deslocar nem recriar o progresso existente.

Nenhuma publicação foi realizada nesta execução. Login Google e conectividade com o projeto de produção ainda precisam de homologação após publicar; os testes desta revisão usaram dados isolados/emuladores.
