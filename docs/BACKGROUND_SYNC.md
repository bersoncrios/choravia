# Sincronização em segundo plano

## Decisão

A sincronização normal não exige botões nem interrompe controles após a preparação inicial da conta. A primeira leitura do save e reconciliação de inventário continuam protegidas para evitar jogar com dados de outra sessão ou IDs antigos. Falhas recebem novas tentativas automáticas com espera progressiva. Conflitos reais entre dispositivos exigem escolha explícita; sem conexão a expedição continua pausada.

Atualizações de inventário em andamento não bloqueiam o jogo após a primeira reconciliação. Antes de aplicar a resposta, conferir a coleção atual e a cena: se a coleção mudou ou uma batalha começou durante a consulta, adiar a aplicação e consultar novamente. A reconciliação usa o estado local atual e preserva mundo, PV e progressão. Erros posteriores não revogam a preparação já concluída. Troca de conta e destruição cancelam novas tentativas; respostas antigas não são aplicadas à nova conta.

A UI normal mostra somente um indicador de salvamento automático. Erros de transporte ficam nos detalhes; conflitos e falta de conexão permanecem visíveis. Não há publicação automática nem alteração nas Rules ou no motor de batalha.

## Validação desta revisão

- `npm test`: 119 testes aprovados; inclui retry automático do save, backoff, preservação de alterações locais, cancelamento e exclusão de erros permanentes/conflitos.
- `npm run build`: compilação Angular e bundle de produção aprovados.
- `node tests/browser-account-expedition.mjs`: aprovado com adaptador em memória. Inclui caminhada durante consulta lenta, preservação de criatura adicionada durante a consulta, reagendamento da consulta, falha transitória sem bloquear controles e recuperação, além do fluxo existente de captura, trilhas, batalha antiga, pausa sem conexão e quatro dimensões de tela.
- `git diff --check`: aprovado. Nenhuma publicação ou homologação no Firebase real realizada nesta revisão.
