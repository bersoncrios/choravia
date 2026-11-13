# Choravia — Pesquisa e monetização

Status: proposta da Fase 1. Pesquisa qualitativa; nenhuma métrica de retenção ou viralidade foi comprovada para Choravia.

## Referências e aplicação

| Referência | Observação apoiada na fonte | Hipótese para Choravia |
| --- | --- | --- |
| PokéRogue | A Daily Run oferece um desafio diário e possui espaços comunitários de discussão. | Uma mesma semente diária pode gerar dicas e resultados compartilháveis. Adiar para depois do MVP. |
| Zelda: Oracle of Ages | A Nintendo destaca exploração, conceitos próprios e quebra-cabeças. | Um mapa pequeno com atalhos e um segredo por área pode tornar a exploração memorável. |
| Into the Breach | O material dos criadores apresenta combate tático com ordem de ataques e ferramentas de previsão. | Mostrar a próxima ação inimiga permite decisões compreensíveis numa arena pequena. |

Fontes consultadas em 2026-11-12:

- [PokéRogue — Daily Run](https://wiki.pokerogue.net/gameplay:modes:daily)
- [Nintendo — Oracle of Ages](https://www.nintendo.com/en-gb/Games/Game-Boy-Color/The-Legend-of-Zelda-Oracle-of-Ages-266252.html)
- [Subset Games — Into the Breach Design Postmortem, GDC 2019](https://media.gdcvault.com/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf)

Não há neste levantamento dados comparáveis de DAU, D1 ou receita. As referências orientam o design; não validam resultados comerciais.

## Viralização sem fricção

1. MVP: após capturar, oferecer “Trocar com um amigo”. Criar URL opaca para uma oferta de espécie desejada, com prévia clara e ação de copiar ou compartilhar pelo sistema. Nunca enviar mensagens automaticamente.
2. O remetente bloqueia uma criatura na oferta. O destinatário abre o link quando quiser e oferece uma criatura da espécie solicitada; a confirmação dele conclui a troca já autorizada pelo remetente. Não exige presença simultânea.
3. Links expiram em 24 horas e podem ser cancelados antes da conclusão. São transferíveis: qualquer pessoa com o link e uma criatura elegível pode aceitar. Informar isso na criação.
4. Depois do MVP: desafio diário com semente comum e cartão de resultado sem dados pessoais. Sem punição por perder um dia.
5. Depois do MVP: ligas privadas por convite, inicialmente com desafios de pontuação; PvP fica para uma etapa posterior.

Links são canais de descoberta, não uma rede P2P direta: propriedade e transferência dependem de validação autoritativa. Jogar offline continua possível; criar ou concluir troca exige conexão e criatura validada no servidor. Capturas locais não podem virar ativos negociáveis por simples envio do cliente.

## Monetização: zero Pay-to-Win

| Produto futuro | Conteúdo permitido | Limite obrigatório |
| --- | --- | --- |
| Skins de Orbes | Aparência, trilha e som | Mesmo timing e chance de captura |
| Variantes Chromatic | Paleta alternativa de espécie acessível gratuitamente | Mesmos atributos, habilidades e legibilidade |
| Passe de expedição | Cosméticos de progressão previsível | Sem energia, bônus de XP, criaturas exclusivas ou poder; sem exigir sequência diária |

Sem loja no MVP. Sem venda de moeda competitiva, tentativas de captura, atalhos de evolução ou vantagens em trocas. Cosméticos pagos ficam vinculados à conta, fora do mercado de criaturas. Sem caixas pagas aleatórias; preço e conteúdo explícitos. Variantes compradas não contam como descoberta rara ou mérito competitivo.

## Validação proposta

Medir funil de entrada → encontro → batalha → captura → link → troca. D1 e D7 serão calculados por coortes com denominadores explícitos, após haver amostra real. Não fixar promessa de viralidade.

Experimento inicial: observar sessões mobile/desktop e identificar abandono antes da primeira captura. Só depois testar convite contextual versus botão na coleção. Links devem excluir identificadores de analytics, e tokens completos nunca entram em logs.
