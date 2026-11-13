# Animações de Choravia

## Decisões de implementação

- A apresentação observa estados e comandos concluídos; não altera RNG, regras, persistência, tempo dos turnos ou resultados. Nenhuma espera por animação será adicionada aos comandos.
- Exploração: interpolação existente será complementada com passada, balanço de acessórios, partículas ambientais e feedback de vasos, cura e selos.
- Encontros: entrada curta na arena e aparição dos Ecos. Batalhas: interpolação de posições, preparação/avanço do atacante, impactos associados à perda real de PV, defesa e efeitos de Faísca/Estalo. Não recalcular dano nem simular outro combate na camada visual.
- Captura: pulso no ritual opcional e resposta visual ao resultado real, inclusive captura recusada. Progressão: barras suaves, destaque temporário de XP/nível e descoberta. Interface: entrada dos diálogos e feedback de compra/equipamento/recompensas.
- Personagens: movimentos ociosos distintos por espécie, com amplitude baixa e sem deslocar as casas de interação.
- Efeitos transitórios têm duração limitada e limite de partículas. Em comandos rápidos, o feedback mais recente substitui o anterior. Nada acumula filas de turnos.
- Reduzir movimento: posições instantâneas, ambiente estático, sem tremor, deslocamentos, pulsos ou partículas; preservar indicadores e textos dos resultados. Tanto a preferência do jogo quanto a do sistema devem ser respeitadas.
- Pausar o desenho com a aba oculta e reiniciar efeitos transitórios ao retomar, evitando saltos e trabalho desnecessário.

## Validação

Build e testes de apresentação independentes do domínio; verificar no Chromium exploração, encontros, batalha, habilidade, captura, progressão, diálogos e modo de movimento reduzido em mobile/desktop. Nenhuma operação Firebase real será necessária.

## Entrega

- Canvas: passos e acessórios (incluindo capa), ambiente com 12 partículas fixas, transição de portais/encontros, entrada e movimentos específicos dos cinco Ecos, interpolação de casas da arena, avanço de atacantes, recuo ao perder PV, defesa e barras de vida interpoladas.
- Faísca usa brasas no alvo; Estalo desenha arcos na área conectada calculada por `affectedCells`. A apresentação reutiliza as regras existentes, sem nova simulação de dano. Os números mostram a perda líquida real de PV por comando; não são um detalhamento de cada fonte de dano.
- Captura: partículas convergentes, pulso de vínculo, dispersão no sucesso e indicação distinta de resistência. O ritual continua opcional e não concede bônus.
- Interface: entrada de diálogos, identidade ociosa do companheiro, preenchimento suave de PV/XP e avisos temporários de compra, visual salvo, recompensas, captura e nível. As ações permanecem disponíveis durante os efeitos.
- A preferência de movimento reduzido do sistema também é consultada pelo Canvas durante o jogo. A opção interna remove animações CSS e a interpolação; informações permanecem em texto/PV.
- `visual-feedback.ts` contém apenas dados transitórios de apresentação; nada é acrescentado ao schema do save. Comandos rejeitados, inclusive respostas com snapshots clonados sem alteração, não produzem efeitos de combate.

## Verificação

- `npm test`: 96 testes, incluindo regressões de imutabilidade, PV reais, comandos rejeitados, duração de deslocamento, captura e progressão com rollover de XP.
- `npm run test:ui`: fluxos locais em sete dimensões aprovados, incluindo compra/personalização, foco de diálogos, dicas e batalha/resultados.
- `npm run test:animations` (servidor `npm run dev` ativo): compara imagens do Canvas em tempos distintos, verifica imagem estática no modo reduzido, interpolação/posição instantânea, entrada no encontro, expiração dos efeitos e preservação dos snapshots. Exercita também as preferências CSS do jogo/sistema, ataque real, ritual, captura e subida ao nível 2, sem erros JavaScript.
- Na medição local de 90 desenhos da exploração, a mediana ficou em aproximadamente 0,5 ms por desenho; não é garantia de desempenho em dispositivos físicos.
- Capturas de referência em `artifacts/animation-*.png` (não versionadas). Testes de navegador usam apenas identidade fictícia em memória e requisições Google bloqueadas. Login/Firestore e desempenho em aparelhos físicos não fazem parte desta homologação.
