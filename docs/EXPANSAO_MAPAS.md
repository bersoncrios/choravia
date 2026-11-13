# Expansão dos mapas e encontros do mundo

## Objetivo

Expandir Choravia de duas para quatro áreas, variando por save a quantidade e a posição de vasos e duelistas. A geração é determinística a partir da semente do save: o mapa continua igual após recarregar ou sincronizar, e cada recompensa só pode ser obtida uma vez.

## Áreas

| Área | Identidade | Desafio/atividade |
| --- | --- | --- |
| Clareira do Primeiro Canto | trilhas abertas, ruínas e riacho | introdução, vasos, duelistas e portal para a Clareira Antiga |
| Clareira Antiga | bosque fechado e pedras de ressonância | selos elementais, exploração e portal para a clareira inicial |
| Trilha das Copas | caminhos elevados, folhagem densa e poças de seiva | exploração por corredores, encontros de Planta/Elétrico e duelistas |
| Gruta das Marés | cavernas frias, canais e cristais | exploração de Água/Terra, travessia de canais e duelistas |

As quatro áreas formam um circuito unidirecional: Clareira do Primeiro Canto → Clareira Antiga → Trilha das Copas → Gruta das Marés → Clareira do Primeiro Canto. Cada área tem exatamente uma porta de saída e uma porta só leva à área seguinte; não há retorno pelo portal anterior. Cada portal usa moldura, luz e partículas próprias para o bioma de origem. Cada mapa conserva uma área de recuperação e espaço para explorar.

## Jogabilidade em telas pequenas

- O controle direcional touch permanece acessível durante a exploração; pressionar e segurar repete passos com intervalo estável.
- A arena 5×5 usa quase toda a largura do canvas para manter casas tocáveis em celulares estreitos.
- Ações de batalha ficam em uma grade de três colunas; ações contextuais e direcional de exploração refluem sem rolagem horizontal.
- Alvos touch têm pelo menos 48 px sempre que não comprometerem o alinhamento visual da arena.
- Canvas mantém proporção e arte pixelada em DPR limitado; a área visível e os controles permanecem dentro da largura do dispositivo.

## Critérios de aceite

- Cada uma das quatro áreas exibe uma única saída e a sequência forma o circuito definido acima.
- Cada portal tem aparência visual distinta, e a chegada ocorre no lado de dentro da próxima área.
- Em viewport de 320 px, a tela não ganha rolagem horizontal; controles de mapa e seis ações de batalha continuam acessíveis.

## Variação persistente

- Cada save cria de 2 a 5 vasos e de 1 a 3 duelistas por área.
- Candidatos devem ser caminháveis, afastados de portais, curandeiros, ruínas, puzzles e spawn; vasos e NPCs não se sobrepõem.
- A geração usa PRNG com a semente do save e seus resultados são persistidos em `worldLayouts`.
- IDs dos objetos são estáveis por área/save. Vasos quebrados e duelos vencidos ficam registrados no save.
- Saves antigos recebem um layout novo e persistente na primeira ação após a atualização; o identificador do duelo original de Davi continua válido.

## Regras do MVP

- Vasos rendem 8 Sementes uma única vez.
- Cada duelista oferece uma batalha opcional e recompensa única de Sementes.
- Derrotas não consomem o desafio. Vitórias não permitem captura do Eco do duelista.
- Não adicionar missões, crafting, mapa procedural de geometria ou viagem rápida nesta expansão.
