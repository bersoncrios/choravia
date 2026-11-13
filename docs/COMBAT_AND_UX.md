# Choravia — Combate e interface v1

> Referência histórica da variante tática. Para novos encontros e atributos atuais, prevalece [Combate v2](COMBAT_V2.md).

Fase 2 · agente Game & UI/UX Designer. Especificação implementável; números iniciais sujeitos a playtest, sem alegação de balanceamento validado.

## Arena e turnos

Coordenadas inteiras x,y de 0 a 4. Distância Manhattan: |x1-x2|+|y1-y2|. Sem diagonal, paredes ou terreno intransponível na arena inicial. Ocupantes bloqueiam movimento. Jogador nasce em (1,3), selvagem em (3,1); essas casas são chão. Demais terrenos: grama em (1,1),(2,1),(1,2); água em (3,2),(4,2),(4,3); restante chão.

Jogador começa. Cada turno admite um movimento opcional de uma casa e exatamente uma ação: atacar, habilidade, defender, capturar ou fugir. Movimento deve preceder ação. Confirmar ação encerra o turno; movimento inválido não consome recurso. Não existe passar sem ação; Defender atende a esse caso. Captura/fuga pertencem apenas ao jogador. Vida mínima zero; atingiu zero, remover do combate após resolver todos os danos simultâneos do evento. Derrota simultânea conta como derrota do jogador, sem captura.

Ordem: movimento → ação e danos simultâneos → checar término → dano de queimadura no ator que encerra o turno → checar término → reduzir duração do fogo → alternar ator. Após turno selvagem concluído, incrementar rodada. Máximo 40 rodadas; fim da rodada 40 sem resultado provoca fuga selvagem. Ações rejeitadas não avançam relógio, RNG ou rodada.

## Atributos e dano

| Espécie | Vida | Ataque | Defesa |
| --- | ---: | ---: | ---: |
| Braseco | 30 | 10 | 6 |
| Brotatu | 34 | 8 | 8 |
| Gotril | 32 | 9 | 7 |
| Zunisco | 28 | 11 | 5 |
| Terruco | 36 | 8 | 10 |

Sem nível, crítico, precisão ou variação aleatória de dano. Ataque básico: neutro, poder 8, alvo inimigo adjacente. Dano = max(1, floor((poder + ataque/2 - defesa/3) × multiplicador × guarda)). Guarda vale 0,5 quando o defensor está defendendo, senão 1. Defender aplica guarda até o início do próximo turno do próprio defensor; não acumula. Dano de terreno ignora defesa e guarda.

Matriz: linhas = atacante; colunas = defensor. Neutro sempre 1.

| Elemento | Fogo | Planta | Água | Elétrico | Terra |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fogo | 1 | 1,5 | 0,75 | 1 | 1 |
| Planta | 0,75 | 1 | 1 | 1 | 1,5 |
| Água | 1,5 | 1 | 1 | 0,75 | 1 |
| Elétrico | 1 | 1 | 1,5 | 1 | 0,75 |
| Terra | 1 | 0,75 | 1 | 1,5 | 1 |

Cada elemento tem uma vantagem e uma resistência no ciclo Fogo → Planta → Terra → Elétrico → Água → Fogo. Exemplo: Braseco usa Faísca (poder 6) em Brotatu: floor((6+5-8/3)×1,5)=12; se defendendo, 6.

Faísca: só Braseco, poder 6, elemento Fogo, alvo uma casa adjacente, ocupada ou não. Acertar grama transforma a casa em fogo com contador 4. Não propaga. Fogo causa 3 de dano ao ator que encerra seu turno nessa casa; cada encerramento de turno decrementa todos os contadores em 1, incluindo fogo recém-criado. Em zero vira chão; reacender fogo não renova duração. Nenhum terreno muda fora da arena.

Estalo: só Zunisco, poder 6, elemento Elétrico, alvo uma casa adjacente, ocupada ou não. Em chão/grama/fogo atinge apenas o ocupante. Em água, atinge todos os ocupantes do componente de água conectado ortogonalmente à casa alvo, inclusive o atacante. Calcula cada dano a partir do estado antes do evento, uma vez por criatura; não soma acerto direto e condução. Água não desaparece, não recebe status persistente. Demais assinaturas do bestiário permanecem futuras.

## IA e previsão

Sem aleatoriedade na IA. No início do turno do jogador, calcular e mostrar o plano selvagem: movimento de aproximação e ação. O plano é fixo durante esse turno, com origem, destino e casas afetadas destacados. A IA escolhe movimento que minimiza distância ao jogador atual, entre ficar e vizinhos livres; desempate por y e depois x, preferindo ficar se já adjacente. Depois escolhe habilidade se disponível e pode atingir o jogador, senão básico se adjacente, senão Defender. Estalo só é escolhido se não atingir o próprio selvagem. Alvo é casa fixa.

Ao executar, se destino ficou ocupado, permanece na origem; se ação ficou fora de alcance, defende; ataque em casa desocupada erra e consome ação. Não recalcular para perseguir jogador que desviou. Prévia informa que mover-se pode evitar o golpe. IA nunca usa captura ou fuga.

## Ritual de Vínculo

Habilitado se selvagem vivo, vida atual ≤50% da máxima e distância ≤2. Sem custo consumível. Capturar encerra turno; falha permite resposta selvagem. Sucesso termina combate imediatamente, adicionando uma instância idempotente por encounterId. Selvagem derrotado não pode ser capturado.

w = 1 - vidaAtual/vidaMáxima. Chance p = min(0,95, 0,35 + 0,60×w + 0,10×min(falhasAnteriores,2)). Sortear u em [0,1); sucesso quando u < p. Exemplo com metade da vida e zero falhas: 65%. Primeira captura guiada: sucesso garantido quando elegível; essa condição integra o estado do encontro, não um booleano arbitrário enviado pelo cliente.

Modo timing mostra um pulso de 1.200 ms e faixa central de 400 ms; pressionar na faixa confirma imediatamente; fora dela ou ao terminar o pulso, confirmar ao fim do ciclo. Modo acessível confirma diretamente. Ambos fazem exatamente um sorteio pela mesma fórmula; timing fornece sensação ritual, sem bônus de poder ou chance. Interface explica “o pulso não altera a chance”. Pausar/ocultar aba suspende animação, sem sorteios adicionais. Ritual em andamento bloqueia outros comandos.

## Exploração e recuperação

Mapa fixo 20×15 casas de 24 px; movimento cardinal a 4 casas/s, sem aceleração. Processar colisão por casa, renderizar interpolação. Em cada oitavo passo completo sobre grama, iniciar encontro; contador não aumenta em chão ou ao andar contra parede. Fora do primeiro encontro guiado (Brotatu), sortear uniformemente entre as cinco espécies. Spawn distante da grama e NPC Iara no caminho. Após encontro, exigir sair da grama antes de rearmar gatilho.

Ao retornar, preservar vida da criatura ativa; Iara recupera gratuitamente toda coleção. Se ativa estiver em zero, selecionar outra saudável ou retornar a Iara e recuperar todas automaticamente. Ao capturar, nova criatura entra com vida máxima na coleção; ativar só fora da arena. Fugir é garantido, sem recompensa. MVP não limita coleção artificialmente.

## Direção visual e acessibilidade

Paleta: fundo #101D22, painel #203638, texto #F4F1DE, vegetação #427A52, destaque #EACD76; fogo #F28C64, água #69B9D0, elétrico #E8D66B, terra #C39C75. Validar contraste real em cada par; elemento também usa nome e símbolo. Texto em fonte de sistema; tratamento pixel apenas em títulos e sprites. Não carregar fonte remota para iniciar.

Canvas lógico 480×360, sem suavização; escala com letterbox e DPR limitado a 2. Mobile a partir de 320 px em retrato: Canvas acima, HUD e ações abaixo, botões ≥44×44 CSS px. Desktop: mapa central, HUD compacto. Vida em barra e números; ataque inimigo com contorno e ícone, sem depender de cor.

WASD/setas e direcional touch mantido para andar; clique/toque para casas de combate. Setas navegam uma grade DOM equivalente; Enter confirma casa/ação e Escape cancela seleção. Tab navega ações e coleção. Labels acessíveis, foco visível e região de status; não atualizar leitor de tela a cada frame. Soltar entrada em blur, pointercancel e mudança de cena.

Impacto: deslocamento visual máximo de 2 px por 100 ms; partículas limitadas a 32; efeitos não mudam simulação. Respeitar prefers-reduced-motion, opção de desativar tremor. Áudio via Web Audio somente após gesto; volume inicial baixo e mute persistido. Jogo funciona sem áudio. Animações não bloqueiam turno por mais de 300 ms, salvo pulso ritual opcional.
