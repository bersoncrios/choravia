# Choravia — Mundo e bestiário inicial

Status: Fase 1. Cinco criaturas jogáveis propostas; catálogo de quinze fica para expansão. Evoluções abaixo são conceitos futuros, sem implementação no MVP.

## Premissa

A floresta lembra. Quando uma lembrança encontra fogo, folha, água, tempestade ou pedra, nasce um Eco: uma criatura que protege aquele fragmento do mundo.

Os antigos Guardiões construíram Orbes para ouvir os Ecos e viajar ao lado deles. Ao tentar prender todas as memórias numa única Árvore-Coração, silenciaram as raízes. Hoje, ruínas interrompem caminhos e criaturas defendem lembranças que ninguém mais compreende.

O jogador é um Guardião aprendiz que chega à Clareira do Primeiro Canto. Seu primeiro objetivo é reacender um marco da floresta, descobrindo que criar vínculos restaura caminhos. Capturar significa aceitar um pacto; derrotar um Eco nunca o mata.

As ruínas são antigos pontos de escuta. Símbolos elementais, pegadas e marcas nas pedras contam a história antes de qualquer diálogo longo.

## Segunda área: Clareira Antiga

O Arco Enraizado liga o caminho da primeira clareira a uma clareira coberta por raízes e pedras de escuta. O arco se abre nos dois sentidos sem tela de carregamento. Gotril e Terruco aparecem entre os Ecos locais, junto de Brotatu; os Ecos de fogo e elétricos ficam na primeira área. Uma pedra perto das ruínas diz: “A raiz conhece os dois lados do caminho.”

## Cinco iniciais

As habilidades são intenções de design para a fase seguinte. Fórmulas, custos, durações e balanceamento ainda precisam ser especificados pelo agente de Game Design.

| ID / nome | Elemento e aparência | Personalidade e memória | Mecânica de combate | Interação ambiental futura |
| --- | --- | --- | --- | --- |
| WW001 — Braseco | Fogo; filhote de raposa com cauda de brasa | Aquece ninhos abandonados; lembra fogueiras de viajantes | Faísca atinge uma casa ortogonal; pode incendiar grama, criando uma área perigosa visível | Acende lanternas antigas |
| WW002 — Brotatu | Planta; tatu com brotos no casco | Esconde sementes para quem ainda vai chegar | Raiz Curta atinge em linha e prende o alvo por um turno; não acumula imobilização | Revela trilhas sob raízes |
| WW003 — Gotril | Água; pequena lontra com bigodes de gotas | Guarda o som da primeira chuva | Jato empurra o alvo uma casa, se o destino estiver livre; água favorece condução elétrica | Move pequenas rodas d'água |
| WW004 — Zunisco | Elétrico; roedor de orelhas como folhas secas | Corre antes do trovão e se assusta com o próprio espirro | Estalo atinge um alvo; em água, propaga pelo mesmo grupo de casas conectadas, incluindo aliados | Reanima mecanismos de ruínas |
| WW005 — Terruco | Terra; jabuti com pedras arredondadas no casco | Dorme em antigas encruzilhadas; lembra passos esquecidos | Cascalho acerta de perto; Firmar reduz o próximo dano e impede empurrão naquele turno | Pressiona placas e estabiliza pontes |

MVP: todas as espécies usam ataque básico; Faísca e Estalo validam as duas interações de terreno prioritárias. As demais assinaturas entram apenas após fechar o loop e o balanceamento. Interações ambientais no mapa não bloqueiam a progressão do MVP.

## Linhas evolutivas futuras

Uma evolução comum transforma a forma; uma ressonância social oferece uma aparência alternativa da mesma evolução, com poder idêntico. Assim, nenhum jogador precisa trocar para obter habilidades ou atributos.

| Linha | Evolução comum proposta | Ressonância proposta após troca concluída |
| --- | --- | --- |
| Braseco → Brasalume | Completar três encontros e visitar uma lanterna | Visitar a lanterna com um novo Guardião desbloqueia cauda de chama azul |
| Brotatu → Floratu | Completar três encontros e visitar o jardim | Visitar o jardim com um novo Guardião desbloqueia flores de outra estação |
| Gotril → Riozelo | Completar três encontros e visitar a nascente | Visitar a nascente com um novo Guardião desbloqueia marcas de maré |
| Zunisco → Trovisco | Completar três encontros e visitar o marco elétrico | Visitar o marco com um novo Guardião desbloqueia auréola de faíscas |
| Terruco → Rocasco | Completar três encontros e visitar o arco de pedra | Visitar o arco com um novo Guardião desbloqueia veios luminosos |

Troca não evolui automaticamente: o novo dono escolhe ativar a variante no marco. Uma variante é desbloqueada uma vez por criatura; retransmissões não geram atributos, moedas ou recompensas acumuláveis. Evoluções e marcos especializados ficam fora das duas primeiras sprints.

## Texto de abertura e diálogos

- Guardiã Iara: “A mata já te ouviu. Agora, escute.”
- Iara, após o vínculo: “Um Orbe não é uma jaula. É uma promessa.”
- Nilo, ponto de troca: “Seu amigo pode vir depois. Deixe o convite.”
- Placa da clareira: “Cinco caminhos. A mesma raiz.”
- Ruína: “Prendemos as vozes. Perdemos o canto.”
- Primeira captura: “Braseco aceitou caminhar com você.”

Trocar o nome na mensagem conforme a espécie. NPCs têm no máximo duas caixas curtas por interação; tutorial deve permitir agir imediatamente.
