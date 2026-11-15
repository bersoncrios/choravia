# Manual de continuidade do estúdio Choravia

Este documento preserva os papéis do estúdio, as decisões de produção e o ponto de retomada para sessões futuras. O projeto começou como WildWoods e agora usa **Choravia** como nome do jogo. Firebase ainda usa o identificador de projeto `wildwoods-b3684`.

## Agentes do estúdio

1. **Pesquisador & Game Analyst** — referências de jogos, retenção web, compartilhamento social e monetização cosmética sem pay-to-win.
2. **Criador de História & World-Builder** — mitologia, regiões, Guardiões, personagens, bestiário e diálogos.
3. **Product Owner** — MVP, sprints, critérios de aceite, prioridade e controle de escopo.
4. **Game & UI/UX Designer** — loop, regras, balanceamento, interface responsiva e feedback sensorial.
5. **Arquiteto Frontend (Angular + Canvas)** — componentes standalone, Signals, TypeScript estrito, renderização Canvas, controles e save local.
6. **Engenheiro Backend & Firebase** — Auth, Firestore, Functions, Security Rules, App Check e operações online seguras.
7. **QA & Engenheiro de Telemetria** — casos de teste, validação de exploits e eventos de produto. Executar testes somente quando solicitado.

Nas respostas de trabalho, começar com o papel em uso, por exemplo `### [AGENTE: PRODUCT OWNER]`. Coordenar os papéis em fases; não misturar todas as entregas em um único bloco. Antes de mudanças complexas, registrar as decisões em Markdown dentro de `docs/`. Manter regras puras do jogo separadas da UI, Canvas e Firebase.

## Estado do projeto ao encerrar a sessão

- O MVP de Choravia tem exploração top-down, áreas conectadas, batalhas clássicas por turnos (e legado tático 5×5), captura, cosméticos, conta Google, save local/nuvem e painel Game Master.
- Há uma única expedição da conta Google, com mundo e coleção reconciliados. Os desafios diários usam as ações aceitas dessa expedição e recompensas idempotentes. A trilha semanal recompensa um cosmético após cumprir a meta em quatro dias diferentes. Ver `DAILY_CHALLENGES.md`.
- Os Ecos têm níveis individuais de 1 a 30, XP, atributos escalados e compatibilidade com saves antigos. Nível/XP são persistidos no inventário online; trocas preservam a progressão. Ver `CREATURE_PROGRESSION.md`.
- O cliente usa Angular/TypeScript/Canvas, Firebase Auth e Firestore direto; não utiliza App Check/reCAPTCHA ou Cloud Functions.
- Decisão explícita do usuário: preservar todas as regras de jogabilidade e substituir apenas o acesso às Functions por transações Firestore. O motor compartilhado está em `src/app/domain/online-engine`; não duplicar regras no adaptador.
- Ver `FIRESTORE_DIRECT.md` para arquitetura, limites de confiança, testes e publicação. As batalhas agora são calculadas no cliente; não alegar validação de resultados por servidor.
- O frontend e as Rules precisam ser publicados; não publicar Functions para esta arquitetura.

- Revisão de interface: guarda-roupa com salvar/cancelar, diálogos de coleção/configurações e ajustes mobile/tablet. Build, 90 testes e verificação Chromium em sete dimensões aprovados; ver `UI_RESPONSIVENESS.md`. Login/Firestore reais não foram homologados nesta revisão.

- Melhorias de orientação implementadas: objetivo junto ao mapa, dicas contextuais de alcance/elementos e acesso ao guarda-roupa pela loja com indicação de equipamento. Build, 92 testes e Chromium aprovados. A compra preserva o equipamento imediato já existente.

- Camada de animações implementada para exploração, ambiente, encontros, combate, habilidades, captura, progressão e diálogos. Regras e saves preservados; suporte a movimento reduzido do jogo/sistema. Ver `GAME_ANIMATIONS.md` e `npm run test:animations`.

- Combate v2: novos encontros/duelos em turnos clássicos, ações diretas sem grade, fases explícitas com PV intermediários, recarga e habilidades elementais para os cinco Ecos. Atributos e poderes rebalanceados; combates salvos sem `mode` mantêm a variante tática. Desafio de estratégia adaptado. Ver `COMBAT_V2.md` e `npm run test:combat`.

- Cabelo longo e tranças agora têm desenhos distintos na prévia e no mapa. Painel diário explica escopo online e atualiza progresso antes da entrega de recompensas, agrega consultas concorrentes e permite tentar novamente. Ver `HAIR_AND_DAILY_FIXES.md`.

- Expedição única implementada: sem seleção pessoal/online nem visitantes automáticos; cache apenas para recuperação. Preserva personagem, mundo, saldo, PV e progressão; importa Ecos por recibos estáveis e impede recriação após transferência. Trilhas usam a mesma expedição. Ver `SINGLE_EXPEDITION.md`.

## Ponto de parada — sessão encerrada a pedido do usuário

- Implementações concluídas e salvas: responsividade, guarda-roupa, orientação, animações, combate clássico/balanceamento, cabelos distintos, recuperação das trilhas e expedição única Google.
- Última validação: build de produção aprovado, **113 testes de regras/aplicação**, **11 testes de integração nos emuladores Auth/Firestore** e verificações Chromium de expedição única, retomada de batalhas antigas, combate, interface, cabelos e trilhas.
- Nenhuma publicação realizada nesta sessão. Login Google e projeto Firebase de produção ainda precisam de homologação após publicar.
- Na retomada, ler este playbook e `docs/SINGLE_EXPEDITION.md`, verificar o estado atual do Git e confirmar o próximo pedido do usuário. Não iniciar publicação automaticamente.
- A expedição única requer **frontend e novas Firestore Rules publicados juntos**; o caminho histórico `users/{uid}/saves/solo` foi mantido para preservar dados. Não publicar Functions.

## Checkpoint — 13/11/2026, correções de produção

- O usuário reportou `failed-precondition` em um commit de `rate_limits/{uid}`. Foi adicionada uma fila por conta em `GameService`, somente para a transação de quota, evitando disputa entre chamadas da mesma instância. Preservados limite de 120 pedidos/minuto e retries do SDK. Outras abas/dispositivos ainda podem produzir conflitos transitórios. Detalhes em `ONLINE_QUOTA_FIX.md`.
- Commit `e90eac6` (`fix: serialize per-account online quota updates`) enviado para `origin/main`. Validação: 115 testes e build de produção aprovados.
- Em seguida, a UI exibiu `Sincronize sua expedição para continuar` e `Limit value in the structured query is over the maximum value of 10000`. Causa: `syncExpedition` consultava `owned` com limite de 100.000. Corrigido para percorrer o inventário inteiro em páginas de 1.000, ordenadas por ID e com cursor, preservando o filtro por proprietário.
- O personagem não andava porque a falha da consulta mantinha `accountSynchronized` falso. O bloqueio de movimento está em `App.send` e é liberado quando a sincronização termina. Não remover essa proteção para contornar falhas de sincronização.
- Commit `5840fd8` (`fix: paginate expedition inventory sync queries`) enviado para `origin/main`. Validação: 116 testes e build de produção aprovados. Nova regressão cobre 1.001 Ecos, preservação de Eco na segunda página e exclusão de Eco de outra conta. Detalhes em `SINGLE_EXPEDITION.md`.
- Após esse push, o Git estava limpo. Não houve publicação manual nem homologação no Firebase de produção nesta sessão. O status de eventual deploy automático da Vercel não foi verificado.
- Próxima ação: verificar se a versão publicada contém `5840fd8`; testar login Google, botão **Tentar sincronizar**, desaparecimento do erro e movimento com WASD/setas. Se ainda houver falha, coletar a mensagem atual e investigar antes de alterar o bloqueio de movimento. Confirmar também save, trilhas e preservação da coleção.
- O usuário pediu para salvar este checkpoint e encerrar para continuar na próxima sessão.

## Próxima retomada

1. Verificar se a versão publicada contém `5840fd8`, que inclui a correção de quota `e90eac6`. Os dois commits já foram enviados para `origin/main`; o deploy automático ainda não foi verificado.
2. Homologar login Google, preparação inicial automática, movimento durante atualizações, save, trilhas e preservação da coleção. A atualização normal agora ocorre em segundo plano; detalhes e tentativa manual ficam em Configurações.
3. Conferir as Rules e índices efetivamente publicados antes de propor nova publicação. Frontend e Rules da expedição única precisam ser compatíveis; preservar outras coleções e não publicar Functions. Publicação não deve ser iniciada automaticamente.

## Continuação — sincronização transparente

- A pedido do usuário, atualizações normais de coleção não bloqueiam o jogo após a preparação inicial; falhas posteriores preservam a disponibilidade e recebem novas tentativas automáticas.
- Save pendente recebe retry progressivo; conflitos entre dispositivos continuam explícitos. Respostas de inventário são adiadas se a coleção mudou ou uma batalha começou durante a consulta.
- Removidos banner e botão obrigatório de sincronização da experiência normal; indicador discreto no perfil e detalhes em Configurações. Sem conexão, a expedição continua pausada.
- Validação: 119 testes, build de produção e Chromium de expedição única aprovados, incluindo consulta lenta e falha transitória. Decisões e detalhes: `BACKGROUND_SYNC.md`. Alterações locais, sem publicação.

## Referências de continuidade

- `README.md` — como executar o projeto.
- `docs/README.md` — índice da documentação viva.
- `docs/GDD.md`, `docs/EXPANSION_PLAN.md` — visão, escopo e expansão.
- `docs/CREATURE_PROGRESSION.md`, `docs/DAILY_CHALLENGES.md` — sistemas recentes e regras de balanceamento.
- `docs/FIREBASE_SETUP.md`, `docs/FIRESTORE_SCHEMA.md`, `docs/CLOUD_SAVE.md` — serviços, schema e sincronização.
- `docs/GAME_MASTER.md`, `docs/QA_TEST_PLAN.md` — administração e plano de qualidade.

## Continuação — design system e página de apresentação

- Página pública na raiz `/`, com ilustração SVG própria, apresentação das mecânicas e cinco Ecos. CTA abre `/entrar` sem sessão e `/jogar` com sessão; retorno pela marca e histórico preservam o progresso. Links de troca mantidos.
- Interface usa tokens de floresta/marfim/musgo/ouro, tipografia mais legível e ações touch de pelo menos 44px. Cabeçalho do jogo compacto; mapa recebe prioridade. Corrigida a largura das Trilhas do dia em mobile/tablet.
- Canvas e conta permanecem montados e ocultos/inertes durante a apresentação; comandos e renderização do mapa ficam suspensos nessa página. Nenhuma mudança de regras de jogo, Firebase ou persistência.
- Validação: 119 testes, build e Chromium de apresentação (seis dimensões), interface e combate (sete dimensões), e expedição única aprovados. Ver `UI_DESIGN_SYSTEM.md` e `npm run test:welcome`.
- Alterações locais, sem commit, push ou publicação nesta revisão. Homologação de login real permanece pendente.

## Continuação — entrada na expedição e proteção entre abas

- Commit anterior de design/apresentação: `e2f52da`, enviado para `origin/main` a pedido do usuário.
- Corrigida a apresentação que reservava `wildwoods-writer` antes de entrar no jogo. A primeira visita à página pública agora restaura somente a identidade; cache/save e ativação da conta aguardam o acesso ao login, jogo ou troca com a trava de gravação obtida.
- Uma expedição já aberta mantém a proteção ao voltar à apresentação. Outra aba de jogo continua impedida de abrir o save sem a trava; voltar à apresentação e entrar novamente permite tentar após fechar a outra aba.
- Build e Chromium de apresentação (seis dimensões, conta restaurada e duas abas) e expedição única aprovados. Mudanças locais, sem commit/push nesta continuação. Versão publicada e login Google real ainda não homologados.

## Continuação — menu e painéis laterais

- A pedido do usuário, removidos os painéis permanentes de companheiro/trilhas e conta/trocas da área principal. O mapa agora ocupa uma coluna central; botão Menu abre um painel à direita com Companheiro, Trilhas do dia e Conta e trocas.
- Painel responsivo com rolagem interna, foco contido, Escape/fundo/botão para fechar e devolução de foco ao menu. Coleção e configurações continuam acessíveis; atalhos e movimento mantido do mapa não atuam com o painel aberto.
- Componente de conta permanece montado, preservando login, sincronização e convites. Links de troca abrem a seção de conta após ativar a sessão.
- Build e Chromium de interface (sete dimensões), expedição/painéis (quatro dimensões) e cabelo/trilhas aprovados. Ver `SIDE_PANELS.md`. Alterações locais, sem commit/push/publicação nesta revisão.

## Correção — visibilidade Game Master

- A leitura única de `users/{uid}.role` foi substituída, na interface, por assinatura que acompanha alterações confirmadas pelo servidor. Falhas não são mais ocultadas: Conta e trocas mostra o erro e oferece verificar novamente; foco/reconexão restabelecem assinaturas encerradas.
- Administradores confirmados têm acesso GM no cabeçalho e no rodapé do menu lateral. Remoção da role fecha o painel; troca de conta/logout cancela a assinatura e ignora respostas antigas. Operações e Rules mantêm autorização independente.
- Build e Chromium de interface em sete dimensões aprovados, com regressões de falha/recuperação da role e isolamento entre contas. Sem homologação da conta real ou publicação. Alterações locais, sem commit/push nesta revisão. Ver `GAME_MASTER.md`.

## Feature GM — catálogo, atributos e badges

- GM → Conteúdo e eventos: criação/edição de acessórios (broche, lenço, coroa), cor, preço e disponibilidade; publicação de PV/ataque/defesa por espécie; definição e concessão manual de badges por UID com motivo. Histórico separado em content_audit.
- Catálogo e concessões via transações Firestore, role admin verificada, auditoria imutável, replay por requestId e revisão esperada. Limite de 100 definições de acessórios/badges. Badges são privadas da conta/admin, fora do save e preservadas após reset.
- Regras puras recebem balanceamento explícito no save e na batalha; configuração nova só é aplicada na exploração, preservando XP, níveis e derrotados. Loja/guarda-roupa/Canvas usam os acessórios publicados; compras retiradas são preservadas.
- Validação: 125 testes, build, 12 integrações nos emuladores demo, Chromium da feature (quatro dimensões), UI/role e combate (sete dimensões cada) aprovados. Ver `GM_LIVE_OPS.md`.
- Mudanças locais, sem commit/push/publicação. **Publicar Rules e frontend compatíveis juntos**; não publicar Functions. Não houve criação de catálogo/badges nem concessões em produção.

## Evolução — coleta e restauração (14/11/2026)

- Diagnóstico inicial e backlog em `EVOLUTION_ROADMAP.md`. Implementada a primeira entrega: ervas/frutos/seiva/cristais renováveis na clareira, baú único que permanece aberto, esconderijo rotativo, mochila filtrável, receita de lanterna e missão Uma luz para Iara. A entrega restaura visualmente o marco; não concede Sementes ou XP. Vasos antigos deixam cacos sem renovar a recompensa.
- Materiais/claims/missão usam ledger separado do save em `users/{uid}/field/state`, ciclo 00h UTC conferido pelo Firestore e recibos imutáveis. Rules validam transições exatas; localização continua calculada no cliente. Pedido sem confirmação permanece por conta no armazenamento local e é repetido com o mesmo ID.
- Sem mudança no formato `Game`, nas batalhas ou na arquitetura Auth/Firestore direto. Reset GM antigo não apaga a mochila. Novos mapas, espécies, habilidades ambientais gerais, áudio expandido e editores GM continuam no roadmap.
- Validação: 134 testes unitários/aplicação; 14 integrações Auth/Firestore demo; navegador de campo em quatro larguras e regressões de UI, combate e expedição aprovadas; build AOT/Vite aprovado. Corrigido CSS externo que não carregava no JIT, com estilos inline e verificação computada. Capturas em `artifacts/field-*.png`.
- Detalhes e limites em `FIELD_EXPLORATION.md`. Alterações locais, sem commit/push/publicação; frontend e Rules compatíveis devem ser publicados juntos mediante autorização. Sem homologação real de produção ou desempenho em aparelho físico. Vite mantém aviso de chunk principal acima de 500 kB.

## Continuação — Diário dos Ecos e mapa de regiões

- Próxima etapa do roadmap P1.2 entregue: **Menu → Mapa e diário** mostra circuito das quatro regiões, próximo destino, região atual/visitadas, habitats e atividades existentes. Diário mostra observados/na coleção, filtros, habilidades e descrições; espécies desconhecidas permanecem ocultas.
- Histórico opcional `Game.journal` registra regiões e espécies em comandos aceitos e reconciliação da coleção; trocas não apagam observações. Saves antigos inferem somente fatos presentes, sem reconstruir visitas ausentes. Batalha legada conserva observação sem adicionar a região provisória da arena. Nenhuma nova recompensa, viagem rápida, espécie ou mapa foi introduzido nesta etapa.
- `REGION_ENCOUNTERS` é compartilhado entre gerador e habitats, preservando os sorteios existentes. Regras de captura inalteradas; corrigido um teste antigo com probabilidade fixa desatualizada e sorteio aleatório para usar sementes determinísticas.
- Validação: **142 testes** aprovados; build AOT/Vite aprovado; Chromium do diário em quatro larguras (320/390/768/1360), expedição, coleta e UI em sete larguras aprovados. Capturas `artifacts/journal-{map,ecos}-*.png` inspecionadas. Continua aviso do bundle principal acima de 500 kB.
- Detalhes: `EXPLORATION_JOURNAL.md`. Nenhuma alteração adicional nas Rules nesta etapa, nenhum acesso de produção, commit/push ou publicação. Mudanças anteriores de coleta continuam locais e exigem frontend/Rules compatíveis juntos quando houver autorização para publicar.
- Próxima etapa: P1.3 — habilidades ambientais e revanche de duelistas, definindo alternativas por elemento e limites/idempotência das recompensas. Arte/áudio e ferramentas GM seguem no roadmap.

## Pausa solicitada — habilidades de campo e revanches

- Usuário pediu pausa; não avançar até novo pedido de continuação.
- P1.3 implementado localmente: cinco mecanismos (Fogo/Planta/Água/Elétrico/Terra), alternativa manual gratuita equivalente, estados visuais persistentes, ponte opcional nas casas x4..6/y8 da Gruta das Marés. Movimento, renderer e validação de save compartilham explorationTile.
- Revanches liberadas após vitória inicial do NPC, com objetivos alternados habilidade/defesa e recordes de vitórias/melhor rodada. Sem Sementes, XP, captura ou progresso de Trilhas do dia nas revanches. Primeira vitória original preservada. Comandos novos respeitam bloqueios de criatura reservada e não são enviados à sessão online legada.
- Diário ganhou aba Atividades de campo com cinco restaurações e recordes por duelista. Documentação de decisões: FIELD_ABILITIES_AND_TRAINING.md; projeção em exploration-activities.ts.
- Validação concluída: **151 testes unitários/aplicação aprovados**, **build AOT/Vite aprovado**, browser-activities aprovado em 320/390/768/1360. Capturas antes/depois da ponte na mesma câmera e journal320 inspecionadas pelo QA em artifacts/activities-*.png. Continua aviso de chunk principal acima de 500 kB.
- Regressões browser-combat e browser-journal foram iniciadas (sessões 10740 e 35266) antes do pedido de pausa; conferir saída ao retomar, sem alegar resultado ainda. Não iniciar mais testes nesta pausa.
- Pendências de fechamento: registrar resultados finais em FIELD_ABILITIES_AND_TRAINING.md e atualizar README/roadmap/scripts com P1.3; conferir regressões pendentes e git diff --check. O QA alterou somente tests/browser-activities.mjs. Próximo bloco após fechar P1.3: arte/primeira camada sonora P1.4.
- Alterações continuam locais e sem commit/push/publicação. Nenhum dado de produção alterado. As Rules da entrega anterior de coleta continuam pendentes de publicação conjunta com frontend autorizado.

## Continuação — Game Master, áudio e polimento dos mapas

- A pedido do usuário, correção do GM priorizada: motivo administrativo único e compartilhado entre concessões de conta e operações de conteúdo; campo visível antes de selecionar jogador, requisito mínimo de cinco caracteres explícito e indicação quando Sementes/cosméticos/reset não estão disponíveis por falta de save. Nenhuma autorização foi ampliada.
- Game Master Chromium aprovado: sincronização do motivo entre campos, acessório, balanceamento, badge, concessão, compra/equipamento e quatro dimensões. Emulador Auth/Firestore: 14/14 integrações aprovadas, incluindo Rules locais, auditoria atômica, revisões concorrentes, retries e badges.
- P1.4 concluído localmente: áudio por região/combate e ações, mixer de volumes, gesto obrigatório, suspensão em aba oculta, limites de vozes e migração de preferências. Teste Chromium com AudioContext real aprovado em quatro larguras; testes de áudio incluídos na suíte.
- Capturas Canvas antes/depois dos quatro mapas foram geradas e inspecionadas em `artifacts/map-polish-{before,after}-*.png`; mapa de cavernas agora usa rochas/cristais. Chromium de atividades, diário, combate e GM aprovados. `npm test`: 163/163; `npm run build`: aprovado com aviso existente de bundle >500 kB; `git diff --check` aprovado após atualização documental.
- Browser audio test foi ajustado para evitar dependência do fluxo de onboarding e do ganho instantâneo de `AudioParam`; agora verifica comandos aceitos/rejeitados usando o reducer e caminho de apresentação real.
- Alterações desta continuação não foram publicadas. Emuladores usaram somente `demo-wildwoods`; nenhuma conta de produção foi consultada ou alterada. Não houve commit/push nesta continuação.
- Próximos passos: avaliar em aparelhos e ouvido humano; seguir para P1.5 editorial do GM e primeira região nova, uma entrega por vez. Corrigir o GM em produção exige publicar frontend e Rules compatíveis com autorização explícita.

## Continuação — enquadramento e controles touch

- Canvas agora segue o personagem com zoom 1,5, interpola a câmera com o movimento e limita o enquadramento às bordas do mapa. Batalhas continuam sem pan de exploração.
- Na sessão de jogo, o título introdutório e o rodapé cedem espaço; o header fica sticky; a largura do mapa responde à altura disponível, preserva 4:3 e reduz a descrição secundária do objetivo em telas baixas. O direcional touch fica sobre a área visível do mapa em celulares e tablets, sem depender de rolar até a barra de controles.
- Build AOT/Vite e `git diff --check` aprovados. Aviso existente do chunk principal acima de 500 kB permanece. Não foram executados testes automatizados de navegador nesta alteração visual. Sem publicação.

## Continuação — níveis dos encontros selvagens

- Encontros selvagens locais e online agora sorteiam nível uniforme inclusivo de 1 até o nível do Eco ativo; o HP do adversário é criado com os atributos daquele nível, e a mensagem de chegada informa o nível. A geração online usa seed do encontro criado pelo backend; a local usa o PRNG persistido do save. Em nível 1 o resultado permanece 1 sem consumir sorteio extra.
- NPCs, revanches, batalhas já salvas e compatibilidade tática não mudam. A validação/build aceita a alteração; build AOT/Vite e `git diff --check` passaram. Não foram executados testes automatizados nesta alteração. Sem publicação.
