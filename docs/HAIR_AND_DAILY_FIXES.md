# Correções de cabelo e Trilhas do dia

## Decisões

- Separar os desenhos de cabelo longo e tranças na prévia CSS e no Canvas. Longo será uma massa contínua; tranças terão mechas segmentadas e pontas presas, nas quatro direções.
- Preservar o escopo das regras diárias: somente ações aceitas em encontros da expedição online. Expedição pessoal e duelos locais não concedem progresso diário.
- Explicitar esse escopo em cada objetivo e no painel, com acesso à expedição online.
- Publicar o progresso retornado antes de tentar entregar/confirmar as recompensas. Falha no cloud save não deve ocultar trilhas concluídas.
- Agregar pedidos de atualização concorrentes em uma nova consulta ao terminar a consulta em andamento; não descartar a atualização de uma ação recente.
- Exibir falhas e botão de nova tentativa no próprio painel. Reconsultar ao reconectar ou voltar à aba e impedir respostas de uma conta anterior de atualizar a nova conta.

## Validação prevista

Build, suíte de regras e Chromium com dados isolados: distinguir os estilos no mapa e na prévia, persistir o estilo escolhido, atualizar progresso durante falha de recompensa, reconsultar após pedidos concorrentes, indicar expedição pessoal/online e preservar recibos idempotentes.

## Resultado

- `npm test`: 104 testes aprovados; regras de progresso e recibos preservadas.
- `npm run test:hair-daily`: Chromium aprovado. Prévia CSS e Canvas distinguem os estilos; verificado Canvas nas quatro direções e salvamento da escolha. Capturas em `artifacts/hair-long.png`, `artifacts/hair-braids.png` e `artifacts/daily-personal-scope.png` (não versionadas).
- Cenários de integração da UI com respostas simuladas: progresso visível quando a entrega de recompensa falha; nova tentativa não duplica Sementes; consulta concorrente é repetida ao terminar; falha de rede preserva o painel anterior; resposta de outra época de conta é ignorada; limite diário calculado pelas trilhas selecionadas (34 ou 36).
- O teste usa IndexedDB real do perfil temporário para o recibo e substitui apenas as respostas de rede/cloud, sem autenticar ou gravar no Firebase real. A contagem de ações continua exclusiva dos encontros online; não foram adicionadas recompensas à expedição pessoal.
