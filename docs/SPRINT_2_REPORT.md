# Choravia — Relatório da Sprint 2

Data: 2026-11-12. Status: implementação preparada; validação remota, Rules emuladas e homologação de navegador pendentes. Não declarar MVP online lançado.

## Entregas no código

- Configuração pública do cliente no `.env.local` para o projeto existente wildwoods-b3684. Google Authentication e Firestore existentes foram considerados; nenhum recurso foi recriado.
- SDK Firebase carregado dinamicamente após o mapa, restauração de sessão, login anônimo com alternativa Google, vinculação posterior e troca explícita para conta Google já existente.
- Inventário online separado do save local, com substituição autoritativa de snapshots, paginação e revisão. Nenhum merge de propriedade por timestamps.
- Motor TypeScript compartilhado por frontend e servidor. Encontros online usam comandos com sequência, requestId e RNG privado. Captura concede ID determinístico uma vez por encontro.
- Serviço transacional de bootstrap, encontro, ação, cancelamento, manutenção e oferta/aceite de troca. Um remetente não precisa confirmar novamente nem estar presente no aceite.
- Token aleatório de 32 bytes, hash SHA-256 no banco, link em fragmento, prévia sanitizada, seleção de espécie e confirmação de transferência. Tokens ficam em memória, não no cache de progresso ou registros de operação.
- Ofertas com bloqueio, expiração de 24 h, cancelamento e rotação com revisão. Encontros expiram em 15 min; limites e relógio vêm do servidor. Limpeza em acesso e tarefa horária paginada, sem depender de TTL.
- Uma callable autenticada com allowlist, validação de input, tamanho limitado, quota por UID e App Check exigido em produção. Escritas de propriedade e resultados negadas por Security Rules.
- Eventos de domínio transacionais e determinísticos para primeira captura, início/fim de encontro e criação/conclusão de troca. Não há exportação de analytics externo ativada.
- Configurações de Emulator Suite, índices, build do backend, lockfiles e Hosting com fallback para links de troca.

## Verificação realizada

Verificação final com Node 22.12.0: **63 testes passaram, zero falhas ou skips**. São 27 testes do jogo local, 23 do serviço transacional e 13 da sessão online. Cobrem replays, concorrência em memória, recuperação após perda de resposta, troca de conta, contratos públicos e preservação de perfis existentes de outro schema. Neste ambiente, o runner foi executado sem isolamento em subprocessos por limitação de criação de processos; isso não substitui testes reais de múltiplos clientes emulados.

A compilação estrita do backend e a importação das exportações reais wildwoods/expireReservations passaram com Admin SDK/Firestore carregados. A compilação estrita dos testes, os templates Angular e a build de produção também passaram. Build final: entrada JavaScript **467,32 kB bruto / 152,18 kB gzip**, SDK Firebase separado **201,06 kB / 43,10 kB gzip**, CSS **14,88 kB / 4,14 kB gzip**. O SDK não integra o carregamento inicial do mapa.

## O que ainda não foi verificado

Os testes em memória não comprovam Security Rules nem comportamento real de concorrência do Firestore. `tests/emulator/firebase.test.mjs` prepara quatro testes reais para esses casos. A tentativa com CLI e configuração temporária isolada chegou ao início da suíte, mas falhou ao abrir portas de Auth, Firestore, Functions e hub/UI com EPERM. Os testes emulados não chegaram a executar.

A consulta ao banco real por credencial do CLI falhou por DNS ENOTFOUND. Nenhuma leitura ou escrita remota foi confirmada; nada foi publicado. O plugin Firebase foi localizado, mas a conexão não foi confirmada. O projeto real ainda precisa ser inspecionado para regras existentes, região e compatibilidade do schema antes de qualquer publicação.

Browser QA, login Google real, App Check, compartilhamento nativo e dois dispositivos permanecem sem homologação neste ambiente. O teste de navegador da Sprint 1 continua preparado, mas o Chrome já havia sido bloqueado pela execução restrita. A meta de entrada em cinco segundos e 60 fps não foi aferida.

## Limites e próximos passos

Vinculação por email não foi implementada; Google está preparado. Novos perfis seguem schemaVersion=1; documentos antigos incompatíveis são preservados e recusados até migração explícita. Validação do caminhar no mapa não é autoritativa; o backend valida encontros, limites, batalhas e propriedade. Multiaccount/bots ainda são risco conhecido, sem promessa de eliminação por App Check.

Após liberar acesso: executar Rules/emuladores, inspecionar o projeto existente, configurar a chave pública do App Check, homologar as funções e só então publicar/validar duas contas reais. Instruções em FIREBASE_SETUP.md.
