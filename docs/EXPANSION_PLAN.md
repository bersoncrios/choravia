# Choravia — Expansão após MVP

Status: conta Google obrigatória, aparência gratuita, escolha de Eco inicial e carteira de 120 Sementes implementadas. Vasos dão 8 Sementes uma vez. Davi oferece um duelo único por 24 Sementes; o santuário pede Fogo, Eletricidade e Terra e dá 40 Sementes. Loja, cosméticos de Ecos e pagamentos seguem planejados.

## Direção

Manter os Ecos e as batalhas táticas, mas fazer a fantasia principal ser restaurar as memórias da floresta. Encontrar e criar vínculo com criaturas abre caminhos e oferece novas maneiras de resolver desafios ambientais. Captura deixa de ser a única atividade de progresso.

## Princípios

- Conta Google obrigatória antes de controlar o personagem. O primeiro acesso exige conexão; depois do login, a sessão autenticada pode abrir o cache local quando estiver sem rede e sincronizar ao reconectar.
- Criador de personagem aparece logo após o primeiro login, antes do mapa. As 432 combinações iniciais são gratuitas e a aparência é salva na conta.
- Depois da aparência, escolher um Eco inicial entre os cinco elementos antes de liberar movimento.
- Carteira começa com 120 Sementes, uma moeda jogável que só pode ser obtida dentro do jogo.
- Todo jogador recebe peças cosméticas gratuitas no início; desafios também liberam itens sem pagamento.
- Sementes vêm de explorar (vasos quebráveis), contratos, marcos e duelos opcionais contra NPCs; compras não vendem Sementes.
- Cosméticos e melhorias de exploração podem custar Sementes. Melhorias de atributos de batalha não são vendidas; se entrarem depois, serão liberadas só pelo jogo e não por dinheiro real.
- Roupas, acessórios, aparências de Ecos e skins de Orbe são cosméticos: não alteram atributos, captura, chances de encontro ou resultados de batalha.
- Itens pagos têm preço e conteúdo explícitos. Sem caixas aleatórias, energia, tentativas pagas ou vantagem competitiva.
- Compras reais só são creditadas após confirmação segura do provedor pelo backend; o cliente nunca confirma uma compra por conta própria.
- Contratos diários devem conceder Sementes com um teto claro; cosméticos raros vêm de uma meta semanal sem sequência punitiva. Plano e requisitos de autoridade: [DAILY_CHALLENGES.md](DAILY_CHALLENGES.md).

## Personalização inicial

O avatar combina visualmente:

- tom de pele;
- cabelo e cor;
- roupa;
- acessório, como lenço, mochila ou capa curta.

Começar com 3 tons de pele, 4 cabelos e cores, 3 roupas e 2 acessórios gratuitos. Permitir prévia no mapa, troca posterior e opções de movimento reduzido. Um conjunto pequeno de combinações já cria variedade sem exigir assets numerosos.

Cosméticos dos Ecos devem respeitar a silhueta e o elemento de cada criatura. A personalização de um Eco altera paleta e detalhes de superfície, nunca modelo de dano ou leitura da intenção inimiga.

## Desafios que dão identidade ao jogo

1. **Restaurar marcos de memória:** no primeiro santuário, ativar selos de fogo, eletricidade e terra com Ecos correspondentes. A solução transforma a pedra e rende 40 Sementes, sem batalha ou custo por erro.
2. **Santuários elementais:** pequenos quebra-cabeças no grid usam fogo para limpar raízes secas, água para conduzir energia e terra para estabilizar placas. Resolver puzzles não exige combate.
3. **Rastreamento de Ecos:** seguir pegadas, vento, gotas e ecos sonoros para localizar uma criatura. Erros dão pistas; não gastam item ou vida.
4. **Guardiões de área:** encontros táticos com padrões de terreno e objetivos especiais, como proteger um marco por quatro turnos, em vez de apenas reduzir PV a zero.
5. **Contratos de expedição opcionais:** escolher tarefas variadas para ganhar sementes e cosméticos gratuitos. Sem sequência diária obrigatória, energia ou perda de progresso por faltar um dia.

## Loja e economia

- Começar por catálogo e inventário cosmético com itens obtidos gratuitamente nos desafios.
- Depois, habilitar compra direta de peças e conjuntos para personagem, Ecos e Orbes.
- Sementes obtidas jogando podem desbloquear uma seleção rotativa gratuita; moeda paga não substitui recompensas de desafio.
- A propriedade de um item pago é registrada pelo servidor com transações idempotentes; comprovantes e reembolsos dependem do provedor escolhido.
- Não vender evolução, poder, captura, slot de criatura, aceleração de desafio ou troca.

## Plano de implementação

### Sprint 4 — Conta, avatar e primeiro Eco

- Exigir Google Auth antes de liberar movimento, captura ou sincronização.
- Criar onboarding do Guardião e personalizador com peças iniciais gratuitas.
- Escolher um dos cinco Ecos iniciais e registrar a escolha antes de habilitar o mapa.
- Mostrar saldo inicial de 120 Sementes no HUD.
- Salvar aparência no perfil autenticado e carregar a mesma aparência entre dispositivos.
- Preservar retorno explícito de login, erro de rede e saída da conta.

### Sprint 5 — Desafios de restauração

- Santuário tutorial na Clareira Antiga: três selos exigem Fogo, Eletricidade e Terra; falhas não consomem recursos.
- Duelo opcional único com Davi na Clareira do Primeiro Canto; vitória concede 24 Sementes e não permite captura.
- Vasos do mapa concedem 8 Sementes uma vez por save.
- Próximo: contratos selecionáveis com recompensas e objetivos alternativos nos encontros de Guardião.
- Medir início/conclusão/abandono sem incluir email, UID ou conteúdo sensível.

### Sprint 6 — Catálogo e loja

- [x] Loja no jogo com saldo de Sementes, preços claros, propriedade e compra direta.
- [x] Cosméticos para Guardião e Eco, além de uma melhoria de exploração sem efeito em batalha.
- [x] Itens adquiridos persistem no save e opções de aparência respeitam a propriedade.
- Escolher o provedor de pagamentos antes de integrar cobranças reais.
- Fazer homologação de compra, repetição de callback, falha, reembolso e fraude antes de publicar.

### Entregue neste corte

- Capa de samambaia (65), Lenço do poente (45), Broche lunar (40), Marca de musgo para o Eco ativo (55) e Botas de trilha (80) são comprados com Sementes.
- Botas reduzem o intervalo de caminhada de 250 ms para 190 ms; não afetam batalha, captura ou PvP.
- Loja não permite compras durante expedição online validada. Não há cobrança com dinheiro real nesta versão.

## Decisões já assumidas para o primeiro corte

- Provedor inicial de login: Google, pois já está configurado no Firebase do projeto.
- Conta obrigatória para nova sessão; sem botão para entrar como visitante.
- Primeira personalização gratuita e cosmética, seguida pela escolha de um Eco inicial; não inclui compra durante onboarding.
- Moeda jogável: **Sementes**. Saldo inicial proposto: **120**; vasos rendem 3–8, desafios 10–20 e duelos de NPC 20–30 Sementes. Custos cosméticos iniciais devem ficar em 40–100.
- Primeiro desafio adicional: santuário curto com solução elemental, não um calendário de missões diárias.
- Pagamento real fica para depois de definir o provedor e concluir a validação segura do backend.
