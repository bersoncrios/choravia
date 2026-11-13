> Atualização: com a [expedição única](SINGLE_EXPEDITION.md), ações aceitas de encontros e duelos do mundo da conta contam para as trilhas. Não há opção pessoal/online. O motor roda no cliente com Firestore direto; referências abaixo a Functions/servidor independente são históricas. Recibos, valores e meta semanal permanecem idempotentes.

# Contratos diários de Choravia

## Estado da implementação

A primeira entrega já está no jogo: três contratos diários variáveis, painel no diário da expedição, ciclo definido pelo servidor em `America/Sao_Paulo`, até 36 Sementes por dia e uma trilha cosmética semanal após cumprir dois contratos em quatro dias diferentes. Nesta entrega, os contratos só usam ações de encontros online validados (movimento, defesa, ataque básico e encerramento de encontro), porque progresso em mapa e quebra-cabeças ainda não tem validação autoritativa.

As recompensas são emitidas como recibos por Cloud Functions, entregues de forma idempotente ao save pessoal e confirmadas no servidor após persistência local/cloud. O saldo continua no save solo que o cliente sincroniza; portanto, a proteção contra repetição de recibos está implementada, mas o saldo ainda não é uma carteira inteiramente autoritativa no backend. Antes de habilitar moeda competitiva ou compras com valor real, migrar saldo e resgates para um ledger server-side.

## Objetivo

Criar um motivo curto e variado para voltar ao jogo, ampliando exploração, desafios ambientais e combate tático. O painel nunca bloqueia a entrada no mapa. Não há sequência diária perdida, energia, limite de tentativas ou recompensa por simplesmente abrir a tela.

## Estrutura recomendada

- **Três contratos por dia:** um rápido, um de exploração e um desafio principal. O jogador pode concluir cada um independentemente.
- **Recompensa em Sementes ao concluir:** 6, 10 e 12 Sementes, respectivamente; concluir os três concede mais 8. Limite normal: **36 Sementes por ciclo diário**.
- **Condições adaptadas ao save:** não oferecer tarefa ligada a selo já concluído, item indisponível ou Eco que o jogador não tem.
- **Atualização às 00:00 em `America/Sao_Paulo`**, exibindo contagem regressiva. O servidor define o ciclo e a hora de corte; ao vencer, a tela atualiza sem apagar recompensa já recebida.
- **Sem bônus por sequência:** faltar um dia não zera progresso nem reduz as recompensas seguintes.

## Exemplos de contratos

| Categoria | Exemplo de objetivo | Recompensa |
| --- | --- | ---: |
| Exploração | Visite uma área indicada e encontre um marco de trilha | 6–10 Sementes |
| Ambiente | Conclua um pequeno desafio de água, fogo ou eletricidade | 10–12 Sementes |
| Tática | Vença um encontro usando uma habilidade ou terreno indicado | 10–12 Sementes |
| Vínculo | Crie vínculo com um Eco de elemento sorteado entre os disponíveis | 10–12 Sementes |
| Convivência, opcional e semanal | Complete uma troca segura ou ajude em uma liga privada | Progresso cosmético semanal; nunca requisito diário |

Os contratos devem combinar pelo menos duas categorias diferentes no mesmo dia. Capturar não pode ser o único caminho para receber a recompensa: tarefas de exploração e ambiente precisam oferecer alternativas sem captura.

## Recompensa rara semanal

Uma trilha semanal acumula contratos em **quatro dias diferentes**. Ao completar pelo menos dois contratos em cada um desses dias, o jogador recebe uma peça rara cosmética: roupa, acessório do Guardião, aparência de Eco ou visual de Orbe.

- A peça não altera atributos, dano, captura, encontros ou PvP.
- A recompensa é determinística e anunciada antes de começar; sem caixa aleatória.
- A coleção semanal roda em temporadas longas e itens antigos voltam em ciclos futuros, evitando FOMO permanente.
- O primeiro conjunto é gratuito e pode ser obtido jogando. Não vender atalhos de progresso nem itens de desafio por dinheiro real.
- Se equipamentos de exploração voltarem a ser oferecidos, mantê-los fora de batalha competitiva e disponíveis também por jogo normal.

## Espaço de design além da captura

O conteúdo atual tem vasos, selos de uso único e duelos de NPC que não podem ser repetidos; isso não sustenta um calendário diário por si só. Antes de habilitar contratos repetíveis, criar três atividades curtas:

1. **Rota de campo:** encontrar pontos indicados em mapas diferentes, com pistas visuais e opção de completar sem batalha.
2. **Desafio ambiental do dia:** resolver um micro-puzzle reutilizável com terreno e elementos no grid 5×5.
3. **Treino tático:** encontro de treino repetível com objetivo variável (proteger um marco, sobreviver rodadas ou vencer com habilidade/terreno).

Os contratos devem escolher apenas objetivos que o jogo e o servidor conseguem comprovar. Não contabilizar passos, vasos, duelo local ou selo por um número informado pelo cliente. O save solo atual pode ser alterado pelo próprio cliente; suas flags não são prova segura para liberar uma recompensa rara.

## Segurança e dados

- O servidor escolhe e persiste a lista de contratos por usuário/ciclo. O cliente recebe descrição, progresso, recompensa, `cycleId` e `nextResetAt`.
- Progresso só avança por resultados de ações validadas. A concessão de Sementes e o marcador de conclusão são gravados atomicamente e são idempotentes por `uid + cycleId + contractId`.
- Cliente não envia saldo novo, progresso final, `cycleId` arbitrário nem resultado. Repetir uma chamada retorna a concessão original.
- Criar dados privados em `users/{uid}/daily_challenges/{cycleId}` ou estrutura equivalente; leitura/escrita somente pelo servidor. Não registrar evento por frame ou passo de movimento.
- O backend atual valida encontros e trocas, mas não movimento, tarefas do mapa ou duelo de NPC. A primeira versão não deve prometer validar esses objetivos até existir uma fronteira autoritativa para tais ações.
- Limitar concessão normal a 36 Sementes por ciclo e uma recompensa semanal por semana. Game Master pode conceder compensações com auditoria, fora do fluxo do desafio.

## Backlog proposto

### Fase A — Base repetível e segura

- Definir catálogo versionado de contratos com pré-condições, evento de conclusão, limite de progresso e recompensa.
- Adicionar APIs de consultar painel e resgatar recompensa, com ciclo do servidor e idempotência.
- Implementar uma atividade tática diária comprovável em encontros online validados.
- Exibir três contratos no diário/HUD sem modal, com estados bloqueado, em progresso, pronto e recebido.
- Contabilizar Sementes pelo backend; manter o cache local somente como prévia.

### Fase B — Exploração e quebra-cabeças

- Implementar a Rota de Campo e o micro-puzzle ambiental repetível.
- Tornar checkpoints desses desafios validáveis pelo servidor sem enviar cada frame ou partícula.
- Adicionar objetivos de mapa ao catálogo só após os eventos terem validação autoritativa.

### Fase C — Coleção semanal

- Adicionar progresso em quatro dias diferentes e conceder uma aparência rara sem atributos.
- Anunciar item e requisitos no começo da semana; permitir consulta do histórico de itens ganhos.
- Equilibrar sementes após observar custos reais de loja e ganhos de vaso/NPC.

## Histórias de usuário e aceite

- **Como jogador, quero ver três contratos ao entrar** para escolher uma atividade sem atravessar menus. Aceite: o painel aparece após carregar o jogo, não bloqueia movimento e mostra progresso e hora de renovação.
- **Como jogador, quero ganhar Sementes ao concluir um contrato** para comprar cosméticos. Aceite: recompensa aparece uma vez; reenvio da chamada não duplica saldo nem conclusão.
- **Como jogador, quero perder um dia sem perder minha sequência** para voltar sem punição. Aceite: não existe streak que zera; progresso semanal depende de dias cumpridos e não é reduzido por um dia ausente.
- **Como jogador, quero obter um item raro jogando** para personalizar meu Guardião sem pagar. Aceite: completar a meta semanal concede exatamente o item exibido, sem sorteio e sem efeito competitivo.
- **Como operador, quero auditar concessões** para investigar falhas e abuso. Aceite: cada crédito guarda UID, ciclo, contrato, recompensa e timestamp do servidor, sem dados pessoais desnecessários.

## Métricas

Registrar `daily_board_opened`, `daily_contract_progressed`, `daily_contract_claimed` e `weekly_cosmetic_claimed`, sem UID, email ou nome no payload analítico. Acompanhar ativação, conclusão, abandono por categoria, retorno semanal e sementes geradas por contrato. Usar métricas para ajustar dificuldade e economia, não para pressionar notificações ou streaks.

## Fora do escopo inicial

Notificações push, tarefas sociais obrigatórias, PvP ranqueado, streaks, reroll pago, energia, compra de Sementes, caixas aleatórias e contratos baseados apenas em login.
