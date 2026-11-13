# Choravia — GDD do MVP

Status: protótipo local, Firebase, login Google obrigatório, aparência gratuita, escolha de Eco inicial e moeda Sementes implementados. Vasos, duelo opcional e santuário elemental já concedem recompensas; loja e contratos de expedição seguem no plano de expansão. Homologação visual, performance e publicação remota pendentes.

## Promessa

Explorar uma clareira, conhecer criaturas com personalidade e transformar uma batalha por turnos em um vínculo que pode viajar até um amigo.

## Loop

Abrir URL → andar → entrar na grama sinalizada → encontro → arena de 25 casas → enfraquecer → Ritual de Vínculo → coleção → criar link de troca → voltar à exploração.

5x5 significa dimensões da arena, não equipes de cinco. MVP: uma criatura ativa do jogador contra uma selvagem, com turnos alternados e intenção inimiga visível. Cada turno permite mover e executar uma ação; parâmetros exatos serão fechados na fase de Game Design.

O jogador começa com Braseco, sem seletor obrigatório. Todas as cinco espécies podem ser encontradas; equipe e coleção podem ser gerenciadas fora do combate. Não há níveis, criação de criaturas, equipamentos, PvP ou economia no MVP.

## Progressão adicionada após o MVP

Cada Eco agora progride individualmente até o nível 30. Vitórias e capturas concedem experiência; PV, ataque e defesa crescem por fórmulas compartilhadas no combate local e online. Capturas herdam o nível do Eco selvagem, e trocas preservam sua progressão. Regras, valores, compatibilidade de saves antigos e limites de balanceamento: [CREATURE_PROGRESSION.md](CREATURE_PROGRESSION.md).

## Escopo jogável

- Quatro áreas conectadas em circuito: Clareira do Primeiro Canto, Clareira Antiga, Trilha das Copas e Gruta das Marés; cada uma tem identidade visual, terreno e encontros próprios.
- Cinco espécies, ataque básico, captura e duas interações de terreno: fogo/grama e eletricidade/água.
- Primeira criatura selvagem capturável em encontro guiado; falhar permite tentar novamente sem compra ou consumível pago.
- Ritual de Vínculo com feedback visual e alternativa acessível sem exigência de reflexo, com resultados equivalentes. Parâmetros pendentes da fase de Game Design.
- Derrota retorna ao ponto de recuperação; preserva coleção. Fugir retorna ao mapa e não concede captura.
- Trocas assíncronas 1:1 por link, com espécie solicitada e confirmação explícita do destinatário.

## Entrada e controles

Meta de aceite: personagem controlável em menos de 5 s em carga inicial, em perfil documentado de celular intermediário e conexão 4G simulada, cache vazio. Medir de navigationStart até aceitar entrada com mapa visível. Registrar build, dispositivo e condições; não tratar como garantia em toda rede.

Conta Google é obrigatória antes do primeiro comando de jogo. O mapa pode carregar atrás do onboarding enquanto Auth inicializa; sem conta autenticada, controles e captura não funcionam. Após o primeiro login, o cache autenticado pode continuar a exploração offline e sincronizar ao reconectar. WASD/setas e controle touch; combate permite clique/toque nas casas e botões com rótulos. Animações reduzidas e som opcional. HUD mostra apenas vida, criatura ativa e ação contextual.

Stack implementada: Angular com componentes standalone e Signals para UI; engine TypeScript estrita independente de Angular, Canvas e Firebase. Canvas renderiza; regras puras resolvem ações; adaptadores cuidam de entrada, persistência e Firebase. O build das funções inclui o mesmo motor de regras. SDK Firebase carrega depois do mapa.

## Persistência e confiança

Salvar progresso local com versão e recuperação de dados inválidos. A sessão anônima interna pode preparar a ligação com Google, mas não concede acesso ao jogo; perfil Google é obrigatório. Exibir estado local/sincronizado após a autenticação. Progresso local é provisório para ações sociais: o servidor só aceita criaturas obtidas por encontros cuja sequência de ações foi validada autoritativamente. Offline nunca autoriza propriedade negociável.

Troca precisa de IDs únicos, bloqueio da criatura, token opaco, expiração no servidor, transação atômica e idempotência. Um link mostra apenas espécie e dados públicos mínimos. Clientes não escrevem diretamente dono ou resultado de troca. Regras, schema e funções serão detalhados pelo agente Backend na fase correspondente.

## Retenção e monetização

Retorno inicial vem de descobrir as cinco espécies e compartilhar uma troca concluída. Desafio diário, ligas privadas, evoluções e cosméticos comerciais ficam fora do MVP. Política e referências: RESEARCH_AND_MONETIZATION.md. Mundo: LORE_BESTIARY.md. Entregas e critérios: BACKLOG_MVP.md.

## Especificações da Fase 2

COMBAT_AND_UX.md define fórmulas, matriz elemental, turnos, terrenos, IA, captura e controles. FRONTEND_ARCHITECTURE.md define fronteiras, persistência, conflitos e perfil de performance. FIRESTORE_SCHEMA.md define encontros online autoritativos e transferências. QA_TEST_PLAN.md define validação e critérios de saída.

Em encontros online, a vida inicial é cheia e o servidor resolve comandos; a vida persistida na exploração local não autoriza inventário online. A primeira implementação será local, seguindo a Sprint 1; integração social pertence à Sprint 2.

Pendências de validação: balanceamento por playtest, medições de performance, latência dos comandos online, regras executáveis e testes. Parâmetros definidos são ponto de partida, não resultados aferidos.

## Expansão de exploração

A Clareira Antiga é acessada pelo Arco Enraizado no caminho leste. Os portais ligam as quatro áreas em circuito unidirecional: Clareira do Primeiro Canto → Clareira Antiga → Trilha das Copas → Gruta das Marés → Clareira do Primeiro Canto, sem tela de seleção ou retorno pelo portal anterior. Cada portal tem moldura e luz próprias do bioma. Seus encontros locais incluem Brotatu, Gotril e Terruco. Perto do marco de pedra, o jogador pode pressionar E ou usar o botão de interação para ouvir uma lembrança curta; o marco acende e persiste no save. Vasos e duelistas têm quantidade e posição determinísticas por save, persistidas no estado do mundo. Em telas pequenas, a câmera aproxima o mapa, a arena amplia as casas tocáveis e os comandos se reorganizam para toque. Ver [expansão de mapas](EXPANSAO_MAPAS.md) e [Sprint 3](SPRINT_3_AREA_EXPANSION.md).

## Atualização de combate

O [combate v2](COMBAT_V2.md) substitui a grade nos novos encontros por escolhas diretas e fases explícitas de jogador/adversário. As regras táticas acima são referência histórica para saves anteriores.
