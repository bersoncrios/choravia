# Coleta e restauração — primeira entrega

## Jogar

Na Clareira do Primeiro Canto, aproxime-se dos novos objetos marcados por um brilho: ervas, frutos, tronco de seiva e cristal. A ação contextual mostra nome, quantidade e destino; pressione E ou toque no botão para recolher. Abra **Menu → Mochila e missão** para consultar o estoque, filtrar recursos/ferramentas e acompanhar **Uma luz para Iara**.

Recolha 2 ervas e 2 seivas, fabrique uma lanterna e entregue perto do marco de recuperação de Iara. A entrega consome a lanterna e restaura uma luz permanente no marco. A recuperação gratuita dos Ecos continua disponível. O acompanhamento aparece junto ao objetivo do mapa.

O baú de Iara é um tesouro novo, único, que concede 1 cristal e permanece aberto. O esconderijo entre folhas muda de posição a cada ciclo e concede 1 erva e 1 fruto. Os vasos antigos conservam a recompensa e o registro `brokenPots`; agora deixam cacos visíveis.

Cada ponto renovável concede 2 unidades uma vez por ciclo. A renovação ocorre às **00h UTC** (21h em UTC−3), separada das Trilhas do dia existentes. O painel apresenta a próxima renovação no fuso do dispositivo. O horário mostrado usa a última confirmação do Firestore; o relógio local não autoriza coleta. A interface consulta novamente na virada prevista; também é possível atualizar pelo painel. Uma aba suspensa pode precisar atualizar a mochila ao retornar.

Há limite de 99 por material/ferramenta. Um ponto que não cabe por inteiro não consome seu resgate. Nenhuma nova atividade concede Sementes, XP ou vantagem de combate. Fruto e cristal ficam como materiais para receitas futuras; nesta entrega, a receita funcional usa erva e seiva. Depois da missão, ainda é possível recolher materiais e fabricar lanternas até o limite, mas não há uma segunda missão ou uso adicional da lanterna implementado.

## Persistência e limites de confiança

- `users/{uid}/field/state`: inventário, última coleta por ponto/ciclo, baú, restauração e revisão monotônica.
- `users/{uid}/field/clock`: timestamp confirmado pelo Firestore para consultar o ciclo.
- `users/{uid}/field_receipts/{requestId}`: recibo imutável vinculado à alteração do ledger na mesma transação.
- `choravia-field-pending:{uid}` no armazenamento local: ação sem confirmação e seu identificador, usado para repetir a mesma operação após falha ou recarga.

As Security Rules validam o ciclo contra `request.time`, a quantidade exata de recursos, ingredientes, consumo, revisão, recibo e propriedade da conta. Repetir uma coleta no mesmo ciclo ou repetir um requestId não concede novamente. Snapshot antigo do mundo não reverte o ledger de campo. Uma transação concorrente recarrega a revisão vigente antes de repetir.

A posição do personagem e o alcance são verificados no cliente. As Rules **não comprovam deslocamento pelo mapa**. Não usar esses materiais como prêmio competitivo, moeda real ou prova de exploração com autoridade independente. Nada foi alterado na autoridade dos combates existentes.

A mochila exige conexão confirmada. Operações sem resposta em 15 segundos liberam a interface com erro recuperável; o pedido fica guardado para conferência antes de habilitar outra mutação. Trocar de conta limpa a visão e ignora respostas antigas. Erros da mochila não alteram o save nem impedem os fluxos existentes de exploração.

## Compatibilidade e publicação

Não há alteração no formato `Game` ou na versão do save. A coleção, XP, PV, compras, trocas, badges, layouts e batalhas salvas permanecem no fluxo existente. Os novos pontos são derivados do layout atual, com busca de posições alcançáveis e sem sobrepor vasos/NPCs. Só o esconderijo muda por ciclo. O cálculo é reaproveitado enquanto o snapshot do mundo não muda, para evitar busca de caminhos por frame.

A primeira consulta autenticada inicializa um ledger vazio. Não apaga flags antigas nem converte vasos já quebrados em recompensas novas. O reset GM existente afeta o save pessoal; não apaga esta mochila ou a restauração. O editor GM de materiais/missões ainda pertence ao roadmap.

É necessário publicar **Rules e frontend compatíveis juntos**, com autorização posterior. Sem as novas Rules, a mochila mostra falha recuperável e não confirma recompensas. Não publicar Functions. Não houve publicação ou alteração em produção nesta entrega.

## Validação

- `npm test`: 134 testes aprovados, incluindo ciclo de coleta/receita/missão, serialização, limites, preservação do layout, timeout, troca de conta e recuperação de crafting confirmado sem resposta.
- `npm run build`: Angular AOT e Vite aprovados; aviso de chunk principal acima de 500 kB continua exigindo atenção em futuras otimizações.
- Emuladores Auth/Firestore `demo-wildwoods`: 14 integrações aprovadas; os testes de campo também foram repetidos após ajustes de concorrência. Incluem inicialização simultânea, dois clientes da mesma conta, coleta concorrente, ciclo anterior/seguinte, recibos imutáveis, ingredientes e privacidade.
- `node tests/browser-field.mjs`: fluxo completo com identidade/ledger em memória, coleta por E, receita, missão, baú único, renovação/cache, replay após commit incerto, recuperação de erro, filtros, foco e quatro larguras (320, 390, 768 e 1360 px).
- Regressões `browser-ui`, `browser-combat` e `browser-account-expedition` aprovadas. Capturas do mapa antes/depois e da mochila estão em `artifacts/field-*.png`; mapa e mochila de 320 px inspecionados visualmente.

Capturas antes/depois usam a mesma posição e viewport. Testes simulados não homologam login real, latência de produção ou desempenho em aparelho físico. Plano completo e próximas entregas: [EVOLUTION_ROADMAP.md](EVOLUTION_ROADMAP.md).
