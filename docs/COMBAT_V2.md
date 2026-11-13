# Combate v2 — turnos clássicos e equilíbrio dos Ecos

## Decisões

- Novos encontros e duelos usam `mode: classic`: jogador escolhe uma ação, ela resolve, o adversário responde, e uma nova rodada começa. Não há movimento/alvo manual na grade. Jogador inicia sempre; velocidade, precisão e críticos não entram nesta revisão.
- O motor compartilhado continua resolvendo uma rodada atomicamente, inclusive online/idempotência. Um registro limitado a duas etapas reais da rodada permite à interface mostrar os estados intermediários e quem está agindo, sem simular dano novamente. A entrada fica bloqueada durante a apresentação; botão Acelerar conclui a apresentação. Recarregar restaura o estado final já confirmado.
- Combates anteriores sem `mode` conservam regras táticas, para não invalidar saves ou encontros online em andamento.
- Ataque básico neutro, poder 6 no modo clássico. Habilidade elemental para as cinco espécies, poder 7, disponível inicialmente e com uma rodada de recarga após o uso. Defender reduz o próximo dano de ataque pela metade; captura falha cede a vez. Fuga garantida e sem recompensa. Captura exige PV ≤50%, sem distância no modo clássico.
- No clássico, habilidades atingem somente o adversário: sem fogo persistente ou autoacerto elétrico. A arena permanece como cenário. No tático antigo, preservar fogo/condução de água e habilidades antigas.
- Atributos base atualizados: Braseco 36/10/7; Brotatu 40/8/9; Gotril 38/9/8; Zunisco 34/11/6; Terruco 42/8/10 (PV/ATQ/DEF). O catálogo atualizado vale para coleção e combate; os PV atuais dos saves anteriores são preservados (não há cura automática). Combates táticos mantêm alcance, movimento, poderes antigos e efeitos de terreno, usando os atributos base atualizados. Novos personagens começam com PV máximos.
- Dano clássico usa o mesmo cálculo e escala de nível, com poderes menores e PV maiores para dar tempo de reagir e capturar. Vantagem ×1,5 e resistência ×0,75 permanecem no ciclo de cinco elementos. Meta de referência: cerca de 4–7 ataques neutros para derrotar um Eco equivalente; verificar todas as combinações nos níveis 1, 15 e 30.
- Para manter o ritmo nos níveis altos, o poder clássico recebe `⌊(nível − 1)/6⌋` adicional. A escala de PV, ataque, defesa e XP continua a mesma.
- IA clássica mira o oponente atual; usa habilidade disponível quando ela supera o ataque neutro, senão usa básico. Não perde turnos perseguindo casas vazias.
- Interface: indicador persistente de rodada/fase, nome do ator, descrição da ação, PV intermediários e histórico da rodada. Botões dizem o que fazem, habilidade mostra elemento/recarga, captura explica o requisito. As animações respeitam movimento reduzido, mantendo fases/textos explícitos.

## Validação prevista

Testes do motor clássico e legado, equilíbrio por matriz de confrontos, recarga, guarda, captura, vitória sem resposta de Eco derrotado, idempotência online e validação de saves/respostas. Chromium: fases legíveis, bloqueio de comandos repetidos, acelerador, mobile, acessibilidade e retomada após recarregar.

## Resultado da revisão

| Eco | PV base | Ataque | Defesa | Habilidade |
| --- | ---: | ---: | ---: | --- |
| Braseco | 36 | 10 | 7 | Faísca · Fogo |
| Brotatu | 40 | 8 | 9 | Chicote de folha · Planta |
| Gotril | 38 | 9 | 8 | Jato d’água · Água |
| Zunisco | 34 | 11 | 6 | Estalo · Elétrico |
| Terruco | 42 | 8 | 10 | Impacto de pedra · Terra |

Na matriz dos 25 pares de espécies, o ataque neutro exige de **4 a 7 acertos** para derrotar um Eco de PV cheios no mesmo nível, nos níveis 1, 15 e 30. Essa medida verifica ritmo de dano, não comprova igualdade de taxas de vitória: elemento, recarga, defesa, vida inicial e vantagem de começar continuam relevantes. É uma base de balanceamento para playtests, sem proposta de PvP nesta entrega.

O desafio diário com identificador histórico `move-in-battle` agora é apresentado como **Use sua estratégia**: conta uma habilidade em combate clássico ou um movimento em combate tático antigo. O identificador e os recibos foram preservados para impedir recompensas duplicadas. Valores de recompensa e trilha semanal não mudaram.

A apresentação usa 850 ms por ator (máximo de duas etapas); Acelerar remove a espera. Movimento reduzido conserva essas etapas com textos e posições estáticas. Mudar de conta/modo, ocultar a aba ou destruir o componente encerra a apresentação e restaura o estado final confirmado. Não há um segundo comando remoto para fazer a IA agir.

## Limites e compatibilidade

- `mode` ausente é a variante tática legada; novos encontros locais, online e duelos de NPC recebem `classic` explicitamente.
- `allyCooldown`, `enemyCooldown` e `turnFrames` são opcionais para saves antigos; dados novos são validados no save e nas respostas online. `turnFrames` tem no máximo dois registros com espécies, PV, posições, ação e mensagem, sem histórico crescente.
- Transações e idempotência continuam compartilhadas no motor Firestore direto. Resultados online não são calculados por um servidor confiável independente; esta revisão não modifica esse limite.
- Não foram adicionados velocidade, críticos, imprecisão, troca de Eco em combate, itens consumíveis ou efeitos de status persistentes. Esses sistemas precisam de decisões próprias para não recolocar complexidade na escolha do turno.

## Evidências de validação

- `npm run build`: Angular estrito e bundle de produção aprovados.
- `npm test`: **104 testes aprovados**. Inclui 75 combinações de ritmo de dano (25 pares × três níveis), cinco habilidades, recarga, defesa, fases reais, vitória sem retaliação, falha/sucesso de captura, fuga/limite de rodadas, derrota, validação de dados, saves e idempotência online. O desafio diário de estratégia foi exercitado no motor transacional em memória.
- `npm run test:combat`: Chromium aprovado em 320×568, 360×640, 390×844, 768×1024, 1024×768, 1360×900 e 667×375. Verificados fases/PV intermediários, bloqueio de comandos repetidos, acelerador, todas as habilidades/recargas, captura e recarga com resultado persistido.
- `npm run test:ui` e `npm run test:animations`: aprovados, incluindo variante tática salva, diálogos, personalização, redução de movimento, captura/progressão e ausência de erros JavaScript.
- `npm run test:browser`: percurso real guiado aprovado (movimento, novo encontro clássico, três ataques básicos, captura, persistência, mobile, toque, trava entre abas e recuperação de snapshot corrompido).
- Capturas não versionadas: `artifacts/combat-classic-*.png` e `artifacts/combat-enemy-phase.png`.
- Todos os testes de navegador usam dados locais isolados, sem autenticação Google nem gravação Firebase real. Nenhuma publicação foi realizada.
