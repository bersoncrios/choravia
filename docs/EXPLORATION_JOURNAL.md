# Diário dos Ecos e mapa de regiões

## Experiência

**Menu → Mapa e diário** abre duas seções no painel lateral:

- **Mapa de regiões:** circuito das quatro regiões, região atual, locais visitados, próximo destino, atividades existentes e habitats. As travessias continuam pelos portais do mapa.
- **Diário dos Ecos:** cinco espaços de descoberta, filtros Todos/Observados/Na coleção, elemento, habilidade de combate, descrição e habitats das espécies conhecidas. Os detalhes das espécies ainda não observadas permanecem ocultos.

O diário distingue observação de propriedade. Encontrar um Eco em batalha ou duelo registra a espécie sem exigir captura. Uma troca pode remover o último Eco daquela espécie da coleção, mas não apaga sua descoberta. Receber uma espécie por troca permite conhecê-la. Os contadores são de espécies distintas, não de criaturas individuais.

Os marcos mostram os três selos do santuário e a restauração de Iara. Esta última depende do ledger de campo: enquanto não houver consulta confirmada da mochila, o diário informa que é necessário consultá-la, sem presumir missão incompleta.

As descrições do mapa são um guia dos destinos, inclusive antes da visita. Não há regiões novas, viagem rápida, Sementes, XP ou recompensas por abrir/consultar o diário. O primeiro encontro guiado apresenta Brotatu; os habitats listados descrevem os encontros normais de cada região.

## Persistência e migração

`Game.journal` é opcional e contém listas sem duplicatas de `regions` e `species`. A versão do save permanece 1. Saves antigos são aceitos sem alteração obrigatória: a leitura infere somente a região atual, espécies da coleção e Ecos da batalha em andamento. O starter provisório anterior à escolha inicial não conta como descoberta.

Cada comando aceito reúne o histórico anterior e o estado resultante, gravando a descoberta com o save existente. Comandos rejeitados não alteram o diário nem a revisão. Travessias registram origem e destino; saída de batalha preserva a observação do adversário. A reconciliação da coleção registra espécies removidas/recebidas antes de substituir o inventário. A retomada de arena legada preserva espécies observadas sem adicionar a região provisória da antiga sessão online.

O validador rejeita IDs desconhecidos, duplicatas, entradas excessivas e formato inválido. O catálogo `REGION_ENCOUNTERS` é compartilhado pelo gerador de encontros e pelo guia de habitats, sem alterar as listas nem o sorteio existente. A projeção do diário é reaproveitada por snapshot imutável do jogo para evitar cálculos repetidos na interface.

Não há nova coleção Firestore ou alteração nas Rules nesta etapa. O diário acompanha o save e o fluxo atual de sincronização/conflitos entre dispositivos. Escolher explicitamente um snapshot antigo pode restaurar um histórico mais antigo; o diário não autoriza recompensas e não é prova independente de exploração. O reset de progresso existente também reinicia esse histórico junto do save, enquanto a restauração de Iara continua no ledger separado.

## Validação

Testes novos cobrem escolha inicial, comando rejeitado, circuito inteiro, observação sem captura, save antigo, serialização de nuvem, retirada/recebimento de espécie por troca, arena legada, catálogo de habitats e dados inválidos.

Na verificação foi encontrado um teste antigo de captura que usava sorteio aleatório e um valor de probabilidade fixo anterior ao rebalanceamento dos PV. O teste agora usa sementes fixas de sucesso/falha e a probabilidade do alvo atual. As regras de captura não foram alteradas.

- `npm test`: 142 testes aprovados, incluindo os oito novos casos do diário.
- `node tests/browser-journal.mjs`: aprovado em 320, 390, 768 e 1360 px; capturas `artifacts/journal-{map,ecos}-*.png` inspecionadas.
- Regressões `browser-account-expedition.mjs`, `browser-field.mjs` e `browser-ui.mjs` aprovadas. As verificações de DOM da receita passaram a aguardar o botão desabilitado após a atualização Angular, evitando depender do instante de renderização.
- Build AOT/Vite verificado; continua o aviso de chunk principal acima de 500 kB. Homologação real de login/Firebase, dispositivo físico e publicação permanecem pendentes.
