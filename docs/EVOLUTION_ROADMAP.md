# Choravia — diagnóstico e roteiro de evolução

Data: 14/11/2026. Este documento registra o diagnóstico do repositório antes da implementação da expansão. O código atual prevalece sobre trechos históricos do GDD e dos planos de sprints. As propostas abaixo não são recursos já entregues.

## Diagnóstico

| Sistema | Implementado no repositório | Incompleto ou limite atual | Evolução proposta |
| --- | --- | --- | --- |
| Mundo | Quatro regiões em circuito, portais, terrenos, recuperação e posições persistentes de vasos e duelistas por save | A geometria é fixa; atividades de recompensa única esgotam o interesse em revisitar | Recursos renováveis, esconderijos rotativos, missões, habilidades de campo e novas regiões |
| Coleta | Vasos rendem 8 Sementes uma vez; IDs ficam em `brokenPots` | O renderer filtra vasos quebrados e eles desaparecem definitivamente; não há mochila de materiais nem baús de história | Preservar as flags antigas; distinguir tesouro único visivelmente aberto, recurso em regeneração e descoberta de ciclo |
| Ecos | Cinco espécies, níveis 1–30, XP, captura, coleção, troca e atributos configuráveis pelo GM | Sem diário de pesquisa, espécies novas, evolução ou habilidades de campo gerais | Diário dos Ecos, pesquisa e três espécies graduais; habilidades ambientais para os cinco elementos |
| Combate | Novos encontros clássicos, ataque/habilidade/defesa/vínculo/fuga, recarga, fases visuais; compatibilidade com saves táticos | Sem revanche renovável, objetivos de treino e itens de exploração | Revanche controlada e variação de objetivos, sem alterar combate legado |
| Progressão | Sementes, cosméticos, santuário, trilhas diárias e meta cosmética semanal | Flags de mapa não equivalem a prova independente de atividade; saldo do save não é carteira autoritativa | Novos eventos do domínio, recibos e limites explícitos; manter ganhos de exploração fora de sistemas competitivos |
| Conta e save | Google obrigatório, expedição única, IndexedDB, backup, revisão de nuvem, reconciliação de criaturas e trava entre abas | Offline pausa a expedição; conflito entre dispositivos pede escolha; exportação sem interface de importação | Migração aditiva e recuperação preservada; recompensas renováveis não podem depender de escolher um snapshot antigo |
| Interface | Página pública, mapa prioritário, menu/painéis laterais, loja, guarda-roupa, coleção e configurações; teclado e touch | Sem mochila de materiais, mapa de regiões e diário de missões/pesquisa | Painel de expedição com mochila e missão, ação contextual clara e mapa acessível |
| Arte | Canvas com personagens, terrenos, efeitos de combate, portais, partículas, animações e movimento reduzido | Terrenos e silhuetas podem ganhar variedade; a expansão precisa de leitura clara de objetos esgotados | Camadas/oclusão, marcos distintos, iluminação contida, detalhes por bioma e estados de coleta |
| Áudio | `GameAudio.play(success)` sintetiza um tom curto; som opcional | Sem música, ambiência por região, passos por superfície e volumes separados | Mixer com quatro volumes, limite de vozes, ambientes e temas curtos |
| GM | Consulta por UID/prefixo, Sementes/cosméticos, reset, auditoria; acessórios, atributos de espécies e badges | Sem catálogo de materiais, tabelas de loot, missão, programação de eventos e ciclo editorial de rascunho/publicação/reversão | Conteúdo versionado, formulários e prévias, operações auditadas e investigação de concessões |

Fontes principais: `src/app/domain/game.ts`, `save-validation.ts`, `live-ops.ts`, `src/app/adapters/renderer.ts`, `audio.ts`, `cloud-save.ts`, `firestore.rules`, `README.md`, `SINGLE_EXPEDITION.md`, `GM_LIVE_OPS.md` e `COMBAT_V2.md`.

Há testes unitários, de aplicação, navegador e emuladores no repositório e relatórios históricos de execução. Este diagnóstico não executa essas suítes e não transforma os resultados antigos em validação da nova expansão. Login real, regras efetivamente publicadas, versão hospedada, fluxo com duas contas e desempenho em aparelhos físicos continuam sujeitos à homologação de produção.

## Fronteiras que devem ser preservadas

- Manter Angular/Signals/Canvas, regras puras em `domain`, orquestração em `application` e adaptadores de persistência/renderização/áudio separados.
- Continuar com Auth e Firestore direto. Não introduzir Functions, App Check ou outro servidor sem apresentar a necessidade e obter autorização.
- As Rules verificam permissões, formato, revisões, horários e relações entre documentos. Elas não executam o reducer TypeScript nem comprovam movimento, dano ou vitória calculados no navegador.
- O JSON do save é uma string nas Rules. Um marcador de recompensa apenas dentro desse JSON não protege sozinho contra restauração de snapshot antigo ou edição do cliente.
- A coleta renovável precisa de recibo estável em transação e referência de tempo conferida pelo Firestore. A hora local serve para apresentação; não autoriza o novo ciclo. Detalhar e testar o contrato nas Rules antes de habilitar resgates reais.
- Não apagar `brokenPots`, `npcDuelWins`, compras, coleção, XP, badges ou histórico para simular renovação. Campos novos devem ter interpretação retrocompatível e limites de tamanho.
- Sem publicação, concessões ou alterações em produção nesta etapa. Rules e frontend compatíveis devem ser preparados juntos.

## Backlog priorizado

Esforço relativo: P = pequeno, M = médio, G = grande. Risco considera persistência, economia e compatibilidade, além do trabalho visual.

| Ordem | Entrega | Valor ao jogador | Dependências | Esforço / risco |
| --- | --- | --- | --- | --- |
| P0.1 | Catálogo pequeno, estados de coleta, mochila e migração aditiva | Entender o que encontrou e para que serve; mundo deixa de parecer vazio | Contratos do domínio e validação de save | M / médio |
| P0.2 | Ciclo renovável com recibo, transação e tempo verificado | Retornar a um local e encontrar recursos sem duplicar ganhos | P0.1, Rules, adaptador Firestore e teste de concorrência | G / alto |
| P0.3 | Uma receita útil, missão curta e recompensa única em mapa existente | Completar uma atividade com começo, propósito e mudança visível | P0.1–2, UI contextual e feedback | M / médio |
| P0.4 | Navegador 320/390 px, teclado, duas sessões e recuperação | Progresso confiável e experiência utilizável | P0.1–3 | M / alto |
| P1.1 | Tesouros únicos abertos e esconderijos rotativos | Diferenciar descoberta permanente de atividade renovável | Contratos de coleta/recibo e posições elegíveis | M / médio |
| P1.2 | Diário dos Ecos e mapa de regiões | Orientação, objetivos pessoais e registro das descobertas | Eventos de descoberta e painel acessível | M / baixo |
| P1.3 | Habilidades de campo e revancha de duelistas | Dar utilidade à coleção e mais escolhas nas visitas | Pré-condições, rotas alternativas e limites de recompensa | G / médio |
| P1.4 | Arte da exploração e primeira camada sonora | Reforçar identidade e legibilidade | Estados do domínio consolidados e orçamento de renderização/vozes | M / médio |
| P1.5 | GM para catálogo, pontos renováveis e histórico de concessões | Operação sustentável e correção de conteúdo | Contratos P0 estáveis, auditoria e permissões | G / alto |
| P2.1 | Brejo dos Pirilampos completo com uma nova espécie | Novo destino com atividade própria e motivo de retorno | P1, extensão de regiões/espécies/Rules/trocas | G / alto |
| P2.2 | Missões/puzzles rotativos e trilhas de exploração | Variedade sem exigir captura ou login diário | Eventos implementados e verificáveis; revisão da economia | G / alto |
| P2.3 | GM editorial com rascunho, versão, prévia e reversão | Atualizar conteúdo com revisão e recuperação | Esquemas estáveis e referências validadas | G / alto |
| P3.1 | Serra dos Ecos e Ruínas do Primeiro Coro, uma por vez | Expandir com qualidade comprovada no Brejo | Critérios de saída da primeira região | G / alto |
| P3.2 | Atalhos e viagem por marcos restaurados | Reduzir repetição de deslocamento | Migração da topologia e mapa de regiões | M / médio |

## Primeira entrega: ciclo de restauração em uma região existente

Entregar primeiro uma fatia completa na Clareira do Primeiro Canto. Não adicionar três regiões antes de comprovar esse ciclo.

1. **Descobrir e coletar:** pontos de erva e seiva em casas elegíveis, afastadas de spawn, vasos, NPCs, portais e puzzles. IDs estáveis; o recurso muda para estado esgotado e informa a renovação.
2. **Guardar:** mochila separada dos cosméticos, com quantidade, categoria, origem e finalidade. Limites explícitos e feedback como “+1 Erva da clareira · Mochila”.
3. **Preparar:** receita curta de um composto de restauração. O produto é usado no ambiente; não substitui a cura gratuita e não concede vantagem em batalha.
4. **Restaurar:** Iara orienta a recuperação de um pequeno canteiro/marco. Texto curto, progresso acompanhado junto ao mapa e alternativa que não exige possuir um elemento específico.
5. **Receber:** recompensa pequena e única de Sementes, com recibo estável, e mudança visual persistente. Definir o valor após comparar ganhos de vasos, NPCs, trilhas e preços da loja; não introduzir venda livre de materiais nesta entrega.
6. **Revisitar:** o recurso renova pelo contrato de ciclo verificado. A missão concluída permanece concluída; renovar recurso não renova sua recompensa de história.

Materiais exatos, quantidades e nomes finais devem coincidir com a implementação e seu documento técnico. O primeiro catálogo deve caber em uma tela e evitar materiais sem uso. A receita deve revelar os ingredientes e o resultado antes da confirmação.

Critérios de saída: o jogador conclui o ciclo sem batalha obrigatória, vê o mundo restaurado e consegue retornar após uma renovação válida. Repetir pedido, recarregar, trocar de mapa ou dispositivo não gera segunda concessão no mesmo ciclo. Falha de rede não anuncia ganho confirmado nem perde materiais; conflito preserva recuperação e impede reaplicar recibo. Migração mantém um save anterior válido, inclusive batalha tática em curso. Validar 320/390 px, teclado, foco, movimento reduzido e textos sem depender de cor. Imagens antes/depois devem usar a mesma cena e dimensão.

## Três destinos propostos

| Região | Atividade, recursos e personagem | Missão/puzzle e retorno | Conceito de espécie |
| --- | --- | --- | --- |
| Brejo dos Pirilampos | Canais rasos, caminhos iluminados, juncos e seiva; uma guardiã dos viveiros | Restaurar uma sequência de lanternas/refletores com pistas legíveis também sem animação; pesquisa e coleta renovável | **Lumisco**, Elétrico: pequeno besouro de abdômen luminoso; silhueta baixa e antenas curvas; habilidade de pulso elétrico sem criar um novo elemento |
| Serra dos Ecos | Vento, pontes e pedras de ressonância; um cuidador de caminhos | Estabilizar uma travessia e ordenar pedras por símbolos; rotas de pesquisa e revancha | **Pedrino**, Terra: pequeno cabrito com placas minerais e chifres curtos; ataque de impacto coerente com o combate clássico |
| Ruínas do Primeiro Coro | Engrenagens, canais antigos e fragmentos de memória; uma pesquisadora dos Guardiões | Restaurar um mecanismo de escuta com solução alternativa aos elementos faltantes; memória rotativa e tesouros únicos | **Orvalim**, Água: anfíbio com membranas que lembram uma lira; habilidade de onda curta e personalidade ligada à primeira chuva |

Nomes e características são conceitos internos, sem pesquisa externa de disponibilidade de marca. Cada espécie precisa de ID definitivo, catálogo, arte, habilidade, habitat, estatísticas, testes de captura, XP, serialização, inventário, trocas e suporte no balanceamento GM. O catálogo atual e validadores assumem cinco IDs: acrescentar somente no renderer é insuficiente.

O Brejo é a primeira região a implementar. Seu aceite inclui chegada/saída válidas, recuperação gratuita, uma missão, um puzzle, segredo, recurso útil, som próprio e espécie plenamente integrada. As outras regiões só seguem depois de validar esse padrão. O circuito atual permanece até existir uma migração explícita da topologia.

## Direção de arte, UX e áudio

- Arte: aumentar distinção entre caminho caminhável, água, obstáculo e ponto interativo; desenhar coletável cheio/esgotado, baú fechado/aberto e marco antes/depois; ordenar camadas por posição para oclusão. Partículas devem indicar algo útil e ter limite fixo.
- UX: uma ação contextual mostra alvo, alcance e resultado; mochila com filtros simples; missão acompanhada sem modal; diário e mapa acessíveis pelo menu. Preservar foco, Escape, retorno ao acionador e alvos touch adequados.
- Áudio: criar mixer com volume geral, música, ambiente e efeitos; desbloquear contexto apenas após interação; suspender/desvanecer ao ocultar aba. Começar por coleta, confirmação, transição e ambiente da clareira, depois passos por superfície, habilidades e dois temas curtos. Limitar vozes simultâneas e impedir loops duplicados em navegação/login. Informação crítica tem equivalente visual.
- Desempenho: comparar tempo de desenho e memória nas mesmas cenas, controlar DPR, não consultar Firestore por frame/passo, não acumular partículas nem sons. Medição local não substitui aparelho físico.

## Evolução do GM

Primeiro ampliar os formulários existentes para definições de itens, receitas, pontos renováveis e tabelas de loot. Prévia mostra item, quantidade, elegibilidade, ciclo e teto de recompensa. Referências inválidas e IDs duplicados impedem publicação.

Depois adicionar missões e eventos agendados. O fluxo editorial é rascunho → validar/prévia → publicar versão → retirar ou reverter por nova versão, preservando versões que já emitiram recibos. Retirar uma definição não remove inventário adquirido. Agendamento usa referência de tempo verificada, sem executar scripts de administradores.

Cada operação mantém role admin conferida pelas Rules, motivo, auditoria imutável, revisão esperada e requestId idempotente. Uma tela de investigação por UID relaciona recibos, concessões e versão do conteúdo; estimativas de Sementes devem distinguir projeção configurada de valores observados. Não fazer varreduras ilimitadas de jogadores nem apresentar estimativas como telemetria de produção. Editor visual completo de mapas fica para depois dos contratos e formulários estáveis.

## Migração e validação por etapa

| Etapa | Compatibilidade e recuperação | Verificação necessária |
| --- | --- | --- |
| Coleta/mochila | Campos opcionais com defaults; IDs persistentes; não recriar vasos antigos nem sobrescrever saldo | Validação de save inválido/antigo, serialização, limite de estoque e comando rejeitado |
| Renovação/recibos | Recibo independente do snapshot recuperável, replay com mesmo payload e proteção de ciclo/conta | Emuladores: permissão, tempo, duas sessões concorrentes, retry, snapshot antigo e troca de conta |
| Receita/missão | Consumo e resultado atômicos; conclusão não depende só de texto/posição da UI | Ingredientes insuficientes, repetição, interrupção, recompensa única e ausência de bloqueio por elemento |
| UI/arte/áudio | Preferências existentes preservadas; efeitos transitórios fora do save | Navegador mobile/desktop, teclado/foco, movimento reduzido, aba oculta, capturas e perfis de desenho |
| Espécie/região | Extensão conjunta dos unions, validadores, inventário, trocas e catálogo GM | Ida/volta, posição recuperada, captura, níveis 1/15/30, save antigo e criatura transferida |
| GM editorial | Histórico e compras anteriores preservados; reversão cria versão nova | Não-admin negado, auditoria atômica, referências inválidas, revisão concorrente e replay |

Executar verificações pertinentes às mudanças entregues, registrar comandos e resultados reais, e separar testes em memória, emulador, Chromium e homologação de produção. Não alegar segurança econômica completa enquanto o saldo e os resultados de jogo puderem ser alterados no cliente.

## Responsáveis

Product Owner coordena escopo e critérios; Game Design define coleta/economia; World Building define missões e regiões; Arte/UI/UX define apresentação e acesso; Angular/Canvas implementa experiência e renderização; Firebase/GM define persistência e operações; Sound Design compõe o áudio; QA verifica regressões, concorrência, migrações e dispositivos. Os papéis trabalham sobre contratos compartilhados, sem duplicar regras entre UI e adaptadores.


## Atualização após a primeira entrega

O ciclo de coleta, mochila, receita e restauração foi implementado localmente. Há quatro materiais renováveis na clareira, baú único aberto, esconderijo rotativo e a missão Uma luz para Iara. O ledger separado e as Rules validam transições, recibos e ciclos UTC. A recompensa da missão é a luz permanente no marco; fruto e cristal aguardam receitas futuras. O restante deste roteiro continua proposto. Detalhes, testes e limites: [FIELD_EXPLORATION.md](FIELD_EXPLORATION.md). Nenhuma publicação realizada.


## Continuação — Diário dos Ecos e mapa de regiões

P1.2 implementado localmente: circuito dos portais, regiões visitadas, observação de espécies, habitats, habilidades e marcos em Menu → Mapa e diário. Descobertas persistem no save e sobrevivem à retirada de criaturas por troca. Migração não inventa histórico ausente. Detalhes e validação em [EXPLORATION_JOURNAL.md](EXPLORATION_JOURNAL.md). Próximo bloco do roteiro: habilidades de campo e revanche de duelistas (P1.3), com pré-condições e limites de recompensa definidos antes da implementação.

## Atualização — P1.3 e P1.4 locais

P1.3 (habilidades de campo e treino) e P1.4 (primeira camada de áudio e polimento dos quatro mapas) estão implementados no repositório e validados localmente. Registro dos testes, capturas e limites: [FIELD_ABILITIES_AND_TRAINING.md](FIELD_ABILITIES_AND_TRAINING.md) e [AUDIO_AND_MAP_POLISH.md](AUDIO_AND_MAP_POLISH.md). O P1.5 continua pendente como evolução editorial do GM: catálogo de materiais/loot, pontos renováveis, missões, eventos agendados, rascunho/publicação versionada e reversão.

Correção emergencial de UX no GM: o motivo exigido por operações de conta e pelo editor de conteúdo agora é um único campo sincronizado, visível antes da seleção de jogador; o painel explica as precondições de save. Chromium do GM e 14 integrações do emulador aprovados. Regras e frontend ainda precisam de publicação compatível autorizada para refletir qualquer alteração fora do repositório. Nada foi publicado e nenhuma conta de produção foi alterada.
