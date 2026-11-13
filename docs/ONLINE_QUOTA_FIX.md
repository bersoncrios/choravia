# Concorrência no contador de chamadas online

## Diagnóstico

O commit reportado em 13/11/2026 escrevia somente `rate_limits/{uid}`, com uma precondição `updateTime`. Chamadas simultâneas da mesma conta passam por `GameService.quota` e podem ler a mesma versão do contador. Uma gravação invalida a versão da outra, causando `failed-precondition`. O SDK Firestore 11.10.0 repete esse conflito automaticamente, mas a tentativa rejeitada ainda pode aparecer no console. O log isolado não demonstra falha definitiva do save.

## Correção

- Enfileirar somente a transação de quota por UID na instância de `GameService`, usada pelo gateway Firebase. As operações de jogo continuam com suas transações existentes.
- Calcular a janela de minuto ao executar a transação, depois da espera na fila.
- Preservar contagem individual, limite de 120 pedidos por minuto, Rules e retries do SDK.
- Liberar a fila após sucesso ou falha; uma falha não impede pedidos posteriores. Remover entradas sem pedidos pendentes.
- A fila evita a disputa originada por chamadas paralelas da mesma instância. Outras abas ou dispositivos continuam sujeitos à concorrência normal do Firestore e aos retries do SDK; não há garantia de ausência de logs transitórios nesses casos.

## Validação

Regressão com adaptador que permite transações concorrentes e rejeita acesso sobreposto ao contador: 120 chamadas simultâneas, limite preservado, renovação da janela, recuperação após falha e contadores separados por conta.

- `npm test`: 115 testes aprovados, incluindo as duas novas regressões.
- `npm run build`: compilação Angular/TypeScript e bundle de produção aprovados.

Não requer alteração de Rules ou migração de dados. A correção precisa ser publicada no frontend para chegar ao jogo em produção.
