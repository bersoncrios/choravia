# Choravia — Plano técnico da Sprint 2

Status atual: código implementado e configuração pública recebida para wildwoods-b3684. Builds passaram e 63 testes foram aprovados; emuladores, navegador e acesso real continuam bloqueados neste ambiente. Nenhum recurso foi implantado. Resultados em SPRINT_2_REPORT.md.

## Entregas

1. Compartilhar o motor TypeScript existente com as funções, sem duplicar regras. O build do backend inclui o módulo de domínio dentro de functions/lib.
2. Implementar operações autoritativas de concessão inicial, encontro, ação, expiração e troca num serviço com porta transacional. Validar inputs no servidor e manter registros idempotentes por usuário.
3. Adaptar a porta ao Admin SDK/Firestore; uma callable autenticada despacha somente métodos permitidos, exige App Check em produção e aplica quota. Security Rules negam mutações de propriedade e resultados pelo cliente.
4. Carregar SDK Firebase dinamicamente após a cena local. Usar persistência da identidade no SDK Auth, inventário separado e projeção da arena sem RNG do servidor. Nenhuma captura local é promovida a validada.
5. Acrescentar oferta com espécie desejada, link opaco, prévia, confirmação, cancelamento e rotação. Segredo só em memória/fragmento inicial, nunca no cache de progresso ou logs.
6. Testar concorrência e replays com implementação transacional em memória; preparar testes reais de emulador para Auth, Functions e Rules. Não confundir os dois níveis de validação.

## Decisões operacionais

- Instantes do servidor serão números em milissegundos UTC, derivados exclusivamente do relógio do backend. Essa representação substitui Timestamp do schema conceitual e simplifica contratos JSON e testes; autorização continua no servidor.
- Região proposta: southamerica-east1. Emuladores usam somente projeto demo-wildwoods; frontend configura conexão por .env.local, sem segredo de conta de serviço.
- Progresso local e online não são mesclados. Sem conexão, o modo local continua disponível; encontro online fica recuperável pelo servidor e expira após 15 minutos.
- Comando online tem sequência e requestId. Falha de rede bloqueia nova ação até retry ou ressincronização; repetição usa o mesmo requestId. RNG nunca integra resposta pública.
- Uma oferta aberta por conta, válida por 24 horas; manutenção paginada libera locks vencidos. Expiração também é verificada em cada operação e não depende de TTL.
- Vinculação Google/email permanece P1 e só será incluída se as entregas P0 estiverem verificadas. Sem cobrança ou criação de projeto automaticamente.

Fontes de implementação: [Auth anônimo](https://firebase.google.com/docs/auth/web/anonymous-auth), [callable](https://firebase.google.com/docs/functions/callable), [transações](https://firebase.google.com/docs/firestore/manage-data/transactions) e [testes de Rules](https://firebase.google.com/docs/rules/unit-tests), consultadas em 2026-11-12.
