# Painel Game Master

## Identidade e autorização

- A role é o campo opcional `role: "admin"` no documento de perfil `users/{uid}`. O estado da expedição na conta fica em `users/{uid}/online/state`; o save pessoal do jogo fica em `users/{uid}/saves/solo`.
- Ausência do campo significa jogador comum. O cliente nunca cria ou altera a role.
- Para habilitar manualmente: no Firebase Console, encontre o UID em Authentication → Users; em Firestore, crie/edite `users/{uid}` e defina `role` como string `admin`. A interface acompanha a role confirmada pelo servidor durante a sessão. Se o documento tiver somente esse campo, o próximo bootstrap cria o estado online em `users/{uid}/online/state` sem retirar a role.
- Regras do Firestore permitem ao usuário atualizar somente o perfil que coincide com o token Auth e bloqueiam alterações na role. A edição manual pelo proprietário do projeto usa Firebase Console/Admin SDK.
- Cada operação administrativa usa Firestore direto e exige autenticação Firebase e a role `users/{uid}.role` nas Security Rules. O jogo não usa App Check nem Functions. Visibilidade do painel no cliente é apenas conveniência, nunca autorização.
- Buscar pelo UID ou por prefixo de nome normalizado; não há busca global por email nem listagem de todos os usuários.
- A busca usa o perfil sincronizado no Firestore e limita a resposta a 10 contas; não consulta o Admin Auth.
- Saves antigos que guardavam o estado online no pai são copiados para `online/state` pelo bootstrap, preservando o perfil legado. Um documento contendo somente `role` pode ser inicializado sem conceder uma segunda criatura.

## Escopo do primeiro painel

1. Consultar uma conta por UID ou nome: dados mínimos do perfil, saldo/progresso do save pessoal e coleção da conta.
2. Conceder Sementes ou um cosmético existente por UID, sempre com motivo obrigatório e limites de quantidade.
3. Redefinir o save pessoal para o estado inicial após confirmação explícita.
4. Consultar histórico recente de alterações administrativas.

## Auditoria e concorrência

- Cada mutação registra ID, ação, UID do administrador, UID alvo, motivo, valores alterados e horário no servidor.
- Mutação de save e registro de auditoria ocorrem na mesma transação; repetição de request não concede a recompensa duas vezes.
- A mutação incrementa a revisão do save e troca o `writeId`; clientes abertos podem receber conflito de nuvem e devem escolher o save atualizado da conta.
- Lookup e lista de histórico limitam quantidade e tamanho de entrada/saída. Sem operações em massa.
- Recompensas administrativas não podem gerar Sementes negativas ou sobrescrever valores fornecidos pelo cliente sem validação.

## Fora do primeiro corte

Banimento, edição de coleção da conta, batalhas/moderação em tempo real, envio de anúncios, ajuste de drop rates, cobrança, operações em massa e ferramentas de economia do jogo. Essas ações exigem regras, auditoria e recuperação próprias.

## Critérios de aceite

- Usuário sem `role: "admin"` recebe `permission-denied` mesmo acessando o Firestore diretamente.
- Usuário pode sincronizar apenas os campos do próprio perfil autenticado; não pode criar ou alterar a role.
- A busca só retorna dados do UID fornecido e não divulga email por padrão.
- Conceder Sementes/cosmético persiste em `users/{uid}/saves/solo`, atualiza revisão e cria auditoria atômica.
- Reset exige motivo e confirmação no painel; o save resultante passa pela validação do jogo.
- Histórico mostra ator, alvo, ação, motivo e data sem revelar conteúdo privado do save.

## Publicação

O painel usa `FirestoreGameMaster` no cliente. Publique o frontend e as Security Rules; não é necessário publicar Functions. Consulte [Firestore direto](FIRESTORE_DIRECT.md) para o modelo de confiança e a publicação.

## Correção de visibilidade

A consulta única de role podia ocultar o GM após uma falha transitória e não acompanhava alterações de permissão com a sessão aberta. A interface deve acompanhar `users/{uid}.role` por assinatura, aplicar somente respostas da conta atual confirmadas pelo servidor, encerrar a assinatura ao sair/trocar de conta e mostrar erro recuperável em Conta e trocas. O menu lateral também deve oferecer o acesso GM para administradores confirmados. Security Rules e validação das operações permanecem obrigatórias.

Validação desta correção: build de produção e Chromium de interface em sete dimensões aprovados. A regressão simula falha de leitura, recuperação pelo botão de verificação, concessão e remoção de role, abertura pelo menu lateral, cancelamento da assinatura ao sair/trocar de conta e rejeição de callbacks antigos. O teste não altera roles nem acessa contas de produção.

## Conteúdo e eventos

O painel agora inclui criação/edição de acessórios visuais para a loja, publicação de PV/ataque/defesa por espécie e criação/concessão manual de badges. Definições, limites, uso, Rules e validação em [GM_LIVE_OPS.md](GM_LIVE_OPS.md). Badges e auditoria de conteúdo ficam fora do save pessoal; a alteração exige publicar Rules e frontend compatíveis juntos.
