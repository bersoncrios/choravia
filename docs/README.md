# Choravia — Documentação viva

Continuidade do estúdio e estado de retomada: [STUDIO_PLAYBOOK.md](STUDIO_PLAYBOOK.md).

## Fase 1 — Concluída em documentação

- [Pesquisa, hipóteses sociais e monetização](RESEARCH_AND_MONETIZATION.md)
- [Premissa e cinco criaturas iniciais](LORE_BESTIARY.md)
- [Visão do jogo e escopo](GDD.md)
- [Backlog das Sprints 1 e 2](BACKLOG_MVP.md)

## Fase 2 — Concluída em documentação

- [Regras de combate e UI/UX](COMBAT_AND_UX.md)
- [Arquitetura Angular/Canvas e save](FRONTEND_ARCHITECTURE.md)
- [Schema Firestore, identidade e trocas](FIRESTORE_SCHEMA.md)
- [Plano de testes e telemetria](QA_TEST_PLAN.md)
- [Plano de expansão: conta, cosméticos, desafios e loja](EXPANSION_PLAN.md)
- [Painel Game Master e autorização por role Firestore](GAME_MASTER.md)
- [Plano de contratos diários e recompensa cosmética semanal](DAILY_CHALLENGES.md)
- [Níveis, experiência e balanceamento dos Ecos](CREATURE_PROGRESSION.md)

## Sprint 1 — Implementada, com homologação no navegador pendente

Motor puro, testes automatizados, mapa Canvas, controles, batalha, captura e persistência local estão implementados. Veja [instruções de execução](../README.md) e [relatório de verificação](SPRINT_1_REPORT.md). Infraestrutura hospedada e trocas continuam fora desta entrega.

## Sprint 2 — Integração implementada; homologação e publicação pendentes

- [Plano de implementação](SPRINT_2_IMPLEMENTATION.md)
- [Configuração do projeto Firebase existente e emuladores](FIREBASE_SETUP.md)
- [Relatório de verificação](SPRINT_2_REPORT.md)
- [Perfil Google e salvamento pessoal na conta](CLOUD_SAVE.md)

Registro histórico da Sprint 2. A arquitetura atual usa Firestore direto, sem Functions ou App Check/reCAPTCHA. Os emuladores e controles em navegador já foram validados nas revisões posteriores; a homologação de produção permanece pendente. Consulte o [checkpoint atual](STUDIO_PLAYBOOK.md) antes de publicar frontend ou Rules.

Em divergência, especificações da Fase 2 prevalecem nos detalhes técnicos; backlog continua sendo referência de prioridade e escopo. Mudanças devem atualizar ambos antes de alterar implementação.
## Sprint 3 — Expansão do mapa

O mundo agora tem quatro áreas conectadas por portais e cada save recebe posicionamento persistente de vasos e duelistas. Escopo e regras: [expansão de mapas](EXPANSAO_MAPAS.md). A Clareira Antiga mantém seu santuário de ressonância ([Sprint 3](SPRINT_3_AREA_EXPANSION.md)).


## Revisão de interface

- [Responsividade, guarda-roupa e validação da interface](UI_RESPONSIVENESS.md)

- [Animações, acessibilidade e validação visual](GAME_ANIMATIONS.md)

- [Combate v2: turnos clássicos, equilíbrio e compatibilidade](COMBAT_V2.md)

- [Correções de cabelo e atualização das Trilhas do dia](HAIR_AND_DAILY_FIXES.md)

- [Expedição única da conta Google e migração de progresso](SINGLE_EXPEDITION.md)

- [Correção de concorrência no contador de chamadas online](ONLINE_QUOTA_FIX.md)

- [Sincronização transparente em segundo plano](BACKGROUND_SYNC.md)

- [Sistema visual, responsividade e página de apresentação](UI_DESIGN_SYSTEM.md)

- [Menu e painéis laterais da expedição](SIDE_PANELS.md)

- [GM: acessórios da loja, balanceamento e badges](GM_LIVE_OPS.md)


## Evolução do mundo — primeira entrega

- [Diagnóstico e backlog priorizado da evolução](EVOLUTION_ROADMAP.md)
- [Coleta renovável, mochila, receita e missão de Iara](FIELD_EXPLORATION.md)

- [Diário dos Ecos, habitats e mapa de regiões](EXPLORATION_JOURNAL.md)

- [Habilidades ambientais e revanche de treino](FIELD_ABILITIES_AND_TRAINING.md)
- [Áudio, volumes e polimento dos mapas](AUDIO_AND_MAP_POLISH.md)
