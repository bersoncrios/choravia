# Choravia — histórico do protocolo autoritativo v1

> Este documento registra a arquitetura original com Functions. A arquitetura vigente usa o mesmo motor de jogo no cliente e transações Firestore; consulte [Firestore direto](FIRESTORE_DIRECT.md) para autorização, caminhos atuais e limites de confiança. Não aplicar as instruções de deploy de Functions abaixo à versão atual.

Fase 2 · agente Engenheiro Backend & Firebase. Serviço, adaptador Firestore, índices, regras e funções implementados; não implantados nesta execução. Resultados e limites em SPRINT_2_REPORT.md.

## Identidade e fronteira de confiança

Firebase Authentication anônimo em segundo plano; posterior vinculação com provedor mantém identidade quando concluída com sucesso. Colisão com conta existente exige fluxo explícito, sem mesclar criaturas. Criatura inicial online é concedida uma única vez por UID em transação; ID derivado de UID e marcador de concessão impede repetir via reload. Recriar contas ainda permite abuso de multiaccount: quotas e rate limiting reduzem abuso, não provam identidade humana.

Tudo que afeta propriedade é escrito exclusivamente por Cloud Functions com Admin SDK. Security Rules protegem clientes, mas não substituem autorização dentro das funções. Validar autenticação, shape de entrada, tamanhos e limites antes do trabalho caro. Nunca confiar em uid, ownerId, atributos, resultado ou relógio enviados no corpo.

## Coleções

Na implementação, saves autoritativos usam números em milissegundos UTC gerados pelo servidor e logs/auditoria usam Timestamp; IDs são strings opacas. Catálogo de espécies e regras é versionado no deploy, não editável pelo jogador. Estado online inclui schemaVersion=1; o pai users/{uid} é perfil e role.

| Caminho | Campos principais | Leitura cliente / escrita |
| --- | --- | --- |
| users/{uid} | displayName, displayNameSearch, email, photoURL, updatedAt; role? (`admin`, definido manualmente) | Só próprio usuário / perfil do Auth; role somente Console/Admin SDK |
| users/{uid}/online/state | schemaVersion, createdAt, inventoryRevision, starterGranted, firstCaptureEncounterId?, activeEncounterId?, activeTradeId? | Somente servidor |
| users/{uid}/saves/solo | schemaVersion, revision, writeId, snapshot (JSON do Game), createdAt, updatedAt | Próprio usuário / próprio usuário, revisão crescente |
| users/{uid}/preferences/main | soundEnabled, reducedMotion, captureMode, schemaVersion | Próprio usuário / próprio usuário, apenas campos e tipos permitidos |
| creatures/{id} | ownerId, speciesId, level, experience, createdAt, originEncounterId, revision, lock:null ou {kind:trade ou encounter,id} | Somente dono / somente servidor |
| encounters/{id} | uid, rulesVersion, initialState, rngSeed, status:open ou resolved ou expired, expiresAt, nextSeq, state, result?, captureCreatureId? | Somente servidor |
| trade_links/{id} | creatorUid, offeredCreatureId, requestedSpeciesId, status:open ou completed ou cancelled ou expired, expiresAt, tokenHash, acceptedBy?, receivedCreatureId?, completedAt? | Somente servidor |
| users/{uid}/online/operations/{requestId} | kind, payloadHash, result, createdAt | Somente servidor |
| game_master_audit/{requestId} | actorUid, targetUid, action, reason, valores alterados, createdAt | Somente servidor; acesso pelo callable Game Master |
| domain_events/{eventId} | type, actorUid, entityId, createdAt, payload mínimo | Somente servidor |
| guilds/{id}, leagues/{id}, battle_rooms/{id} | Reservados; sem documentos no MVP | Negar tudo |

Vida de batalha mora no encontro; nível e XP pertencem ao registro da criatura, e atributos efetivos são calculados pelo catálogo compartilhado. Registros antigos sem nível são tratados como nível 1 e são atualizados após a primeira batalha concluída. Snapshot de criatura não contém poderes editáveis. Resultados de operação não armazenam tokens completos. Endpoint de leitura de inventário usa paginação por ID (até 50); cliente que consultar creatures diretamente deve filtrar ownerId==auth.uid. Regras não atuam como filtro.

## APIs de encontros

beginEncounter(requestId, activeCreatureId): servidor libera locks de ofertas vencidas do solicitante, valida criatura e bloqueio, não permite outro encontro aberto do mesmo UID e aplica cooldown mínimo de 10 s entre inícios. Sorteia espécie/semente no servidor, fixa rulesVersion, cria estado inicial com vida cheia e validade de 15 min, bloqueia a ativa e grava activeEncounterId em transação. Retorna projeção de batalha sem amostras RNG futuras. Primeira captura ainda não concluída recebe encontro guiado, inclusive após abandonar tentativa anterior.

Essa arena online é uma expedição validada iniciada pela grama, mas não prova que o usuário percorreu o mapa: cliente modificado pode solicitar encontros dentro do cooldown. A fronteira antifraude do MVP protege regras de batalha e propriedade; validação autoritativa de caminhada fica fora do escopo. Nenhuma promessa de eliminar bots.

submitAction(encounterId, seq, command, requestId): transação lê usuário, encontro, criatura bloqueada e registro de operação. Verifica dono, validade, sequência, versão e command. Aplica reducer compartilhado, incluindo resposta inimiga quando termina turno do jogador. Persiste estado e nextSeq. Ações inválidas não consomem sequência ou RNG. Durante ritual cliente envia só comando capturar, sem chance, qualidade ou seed.

Se capturar: criar criatura com ID determinístico do encontro, atualizar firstCaptureEncounterId se vazio, resolver encontro, liberar ativa e atualizar revisão do inventário na mesma transação. Duas tentativas concorrentes nunca concedem duas instâncias. Derrota, fuga ou limite de turnos resolvem sem concessão. Expiração é verificada no endpoint antes de ação; liberar ativa por cancelEncounter ou limpeza idempotente. Novo encontro recupera lock vencido da própria criatura em transação. Não usar TTL como mecanismo de desbloqueio.

Online é autoritativo por comando. UI pode prever seleção/movimento, mas mostra captura confirmada apenas após resposta. Perder rede permite retomar encontro online depois; escolher jogar offline abandona a previsão online e inicia outro encontro explicitamente provisório. Nunca converter capturas offline em criaturas validadas. Reload consulta encontro ativo ao reconectar.

## APIs de troca

createTrade(requestId, creatureId, requestedSpeciesId): autenticar e validar espécie. Máximo uma oferta aberta por UID no MVP. Transação lê operação, usuário e criatura; exige dono, ausência de lock e origem validada. Se há oferta anterior vencida, encerrá-la e liberar lock antes de autorizar nova oferta. Grava oferta open com expiração em 24 h, lock na criatura, activeTradeId e evento único. Ofertar a última criatura é permitido: informar que ela ficará indisponível e disponibilizar cancelar para continuar batalhando.

Token de link: gerar 32 bytes CSPRNG, codificados em base64url. Guardar somente SHA-256 na oferta. Token só no fragmento da URL /troca/{tradeId}#t=..., enviado ao endpoint por corpo, nunca query string. Página remove fragmento via history.replaceState após ler e mantém token apenas na memória. Sem scripts de analytics nessa página. Endpoint exige correspondência de hash, status e prazo. Rate limiting por UID e recurso antes de leituras repetidas.

Idempotência da criação: repetir requestId com mesmo payload retorna tradeId, sem recriar token. Se primeira resposta se perdeu, remetente chama rotateTradeToken(tradeId), autenticado como dono; novo token invalida anterior e é devolvido uma vez. Repetição da rotação pode invalidar resposta anterior: usar revisão da oferta e informar que copiar novo link substitui o antigo. Não tentar recuperar segredo que não foi persistido.

previewTrade(tradeId, token): resposta sanitizada com espécie ofertada, solicitada, status e expiração. Não incluir UID, inventário, origem ou hash. Não permite aceite se expirado; preview não reserva oferta. Exige identidade anônima, criada sem cadastro.

acceptTrade(requestId, tradeId, token, offeredByRecipientId): antes de qualquer escrita, ler operação, oferta, ambas criaturas e ambos usuários. Exigir token válido; oferta open e now<expiresAt; identidades distintas; ofertada original ainda pertence ao criador com lock correspondente; criatura do destinatário pertence a ele, tem espécie solicitada e lock null. Trocar ownerId de ambas, remover lock, aumentar revision das duas e inventoryRevision dos dois usuários, limpar activeTradeId do criador, marcar completed e gravar operação/evento na mesma transação. Confirmar requestId anterior antes de testar status completed: retry legítimo retorna o resultado original. requestId reutilizado com outro payload falha.

cancelTrade(requestId,tradeId): só criador; transação encerra oferta open e remove apenas lock correspondente. Sem sucesso parcial. Cancelar versus aceitar é serializado pelas mesmas leituras; somente uma operação vence.

expireTrade: liberação idempotente quando now>=expiresAt, em acesso à oferta e por tarefa de manutenção paginada. Aceite sempre verifica prazo mesmo que limpeza não tenha rodado. Nunca liberar lock cujo ID já mudou. TTL pode remover documentos de histórico após retenção, não define semântica de validade e não deve apagar oferta aberta ainda bloqueada.

Callbacks de transação não enviam eventos externos: podem executar mais de uma vez. Gravar evento determinístico no banco dentro da transação; exportação posterior deduplica por eventId.

## Regras e índices

Política: deny por padrão; usuários leem próprio perfil; creatures permite get/list somente quando ownerId==request.auth.uid; todas as escritas de inventário/encontros/trocas são negadas ao cliente. preferences aceita apenas soundEnabled:boolean, reducedMotion:boolean, captureMode em timing/accessível e schemaVersion=1, sem campos extras; delete permitido ao próprio dono. Tokens nunca autorizam Firestore direto. Schema executável e testes de Rules são entrega da Sprint 2.

Índices propostos: creatures(ownerId ASC, __name__ ASC) para paginação; trade_links(status ASC, expiresAt ASC) para limpeza. Confirmar necessidade com consultas implementadas; isentar de indexação snapshots, payloads e hashes não consultados. Histórico de operações não é apagado enquanto a entidade puder receber retry que exija retorno idempotente; após purga, unicidade permanente da entidade ainda impede nova concessão.

## Custo e operação

Sprint 1 é local. Testar funções e regras no Emulator Suite antes de qualquer ambiente real. Implantar Cloud Functions requer plano Blaze segundo a documentação consultada; não prometer backend social completo no Spark. Não ativar cobrança ou implantar sem ambiente definido. Usar mesma região para funções/banco, limites de instâncias e quotas por UID; alertas de orçamento informam custo, não são um teto rígido de gasto.

Não escrever frames, passos do mapa ou partículas no Firestore. Online escreve comandos de batalha limitados a 40 rodadas e logs de domínio; nenhum listener global. Preferir leituras pontuais e inventário paginado. Retenção de histórico e analytics será configurada antes da produção, com política de exclusão de conta que preserve integridade de trocas concluídas sem expor identidade.

## Correspondência com o código

Separação: `users/{uid}` contém apenas identidade do perfil autenticada pelo token Firebase (`displayName`, `email`, `photoURL`) e a role administrativa opcional. Perfil pode ser atualizado pelo dono apenas se os campos corresponderem às claims do token; a role nunca pode ser escrita pelo cliente. O progresso pessoal fica em `saves/solo`, separado do estado online autoritativo em `online/state`. A migração do formato legado `users/{uid}` (que armazenava UserDoc online no pai) ocorre atomicamente no próximo bootstrap, preservando perfil e role. O snapshot JSON contém somente estado do jogo, sem email ou dados Auth. Firestore Rules limitam revisão, timestamps e tamanho; funções de combate/troca não confiam no snapshot.

`functions/src/service.ts` implementa o protocolo; `firestore-store.ts` usa transações reais; `memory-store.ts` é somente adaptador de teste. `index.ts` expõe a callable wildwoods, com envelope {method,input}, e manutenção horária. Todos os métodos passam pela mesma validação de autenticação e quota de 120 chamadas/minuto por UID. O frontend carrega o SDK após a cena local e oferece Google quando anônimo estiver desabilitado.

getState/listInventory fazem leituras paginadas com verificação de inventoryRevision. RNG fica somente no estado privado do encontro. Durante batalha, ações não terminais atualizam a projeção pela resposta autoritativa sem consultar novamente todo o inventário; erros incertos e respostas após término exigem reconciliação.

A coleção rate_limits é privada. Nenhuma regra ou função foi aplicada ao projeto real. Ver FIREBASE_SETUP.md para modo demo, remoção da exigência remota de App Check e inspeção das regras já existentes antes de publicar.

## Fontes oficiais da especificação

Consultadas em 2026-11-12:

- [Autenticação anônima e vinculação](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Transações: atomicidade e repetição de callbacks](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Security Rules e acesso do servidor](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Cloud Functions: configuração e plano de implantação](https://firebase.google.com/docs/functions/get-started)
- [TTL e exclusão assíncrona](https://firebase.google.com/docs/firestore/ttl)

## Expedição única

O mundo, personagem, saldo e coleção são salvos juntos em `users/{uid}/saves/solo`, preservando o caminho histórico. A coleção aceita os IDs reconciliados do inventário. `users/{uid}/operations/expedition-{hash}` guarda recibos de importação e `starter-choice` a escolha inicial já aplicada. `users/{uid}/expedition/status` espelha o Eco de uma batalha ativa na mesma transação do save, bloqueando sua reserva/transferência em outra sessão. Contratos e limites estão em [SINGLE_EXPEDITION.md](SINGLE_EXPEDITION.md).
