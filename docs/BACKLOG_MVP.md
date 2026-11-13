# Choravia — Backlog priorizado

Status: planejamento da Fase 1. Duas sprints orientadas a entregas; duração e estimativas serão definidas após o desenho técnico. P0 é obrigatório para o loop; P1 não bloqueia o MVP.

Atualização de execução: Sprint 1 implementada localmente; integração P0 da Sprint 2 e Google de P1 implementados no código. Testes de domínio/serviço/sessão e builds passam; Rules emuladas, navegador, duas contas reais e publicação ainda não homologados. Vinculação por email permanece adiada. Ver SPRINT_1_REPORT.md e SPRINT_2_REPORT.md; não considerar critérios de saída cumpridos só pela implementação.

## Sprint 1 — Explorar, batalhar e capturar localmente

Objetivo: completar o loop de andar até capturar, com persistência local. Dependência de entrada: especificação de combate e captura pelo Game Designer antes da implementação das regras.

| ID / prioridade | User story | Critérios de aceite |
| --- | --- | --- |
| S1-01 / P0 | Como visitante, quero começar a andar ao abrir a URL. | Um mapa fixo e personagem aceitam WASD/setas e touch; paredes impedem passagem; nenhuma tela de conta é obrigatória; entrada <5 s no perfil documentado do GDD. |
| S1-02 / P0 | Como explorador, quero encontrar criaturas na grama. | Entrar na área sinalizada inicia encontro; cinco espécies estão disponíveis; uma batalha por vez; sair da arena restaura posição segura; primeiro encontro é guiado. |
| S1-03 / P0 | Como jogador, quero entender e resolver uma batalha tática. | Arena 5x5, uma criatura por lado, alcance e destino válidos destacados; mover e agir respeitam o turno; intenção inimiga aparece antes da decisão; vitória, derrota e fuga retornam ao mapa; fogo queima grama e eletricidade percorre água conforme regras aprovadas. |
| S1-04 / P0 | Como jogador, quero criar vínculo com uma criatura enfraquecida. | Ritual informa condição e resultado; captura válida adiciona exatamente uma instância à coleção; falha não duplica recompensa; primeira captura é atingível sem compra; há modo acessível equivalente sem reflexo obrigatório. |
| S1-05 / P0 | Como jogador, quero continuar após fechar a página. | Reload preserva posição segura, coleção e criatura ativa; escrita local tem versão; save inválido oferece recuperação sem travar; captura é marcada provisória para troca até validação online. |
| S1-06 / P0 | Como equipe, queremos detectar erros no loop. | Testes das regras cobrem alcance, ordem de turno, dano elemental, terrenos, captura e encerramento sem duplicação; roteiro manual passa em desktop e mobile; eventos locais de funil não incluem dados pessoais. |

Saída: abrir → andar → encontrar → batalhar → capturar → recarregar sem perder progresso. Sem troca real nesta sprint.

## Sprint 2 — Validar progresso e trocar por link

Objetivo: um jogador oferece e outro aceita depois, com transferência segura. Dependências: Sprint 1; projeto Firebase acessível e configuração de ambiente; schema, regras, protocolo de validação e política de conflito especificados antes das funções. Sem credenciais, concluir testes em emulador e registrar integração hospedada como pendência, nunca como entregue.

| ID / prioridade | User story | Critérios de aceite |
| --- | --- | --- |
| S2-01 / P0 | Como visitante, quero uma identidade sem cadastro inicial. | Autenticação anônima ocorre em segundo plano sem bloquear mapa; erro de rede preserva modo local; propriedade usa UID do servidor; indicador diferencia progresso provisório e validado. |
| S2-02 / P0 | Como jogador, quero negociar criaturas legítimas. | Servidor emite encontro com semente e versão de regras, valida sequência de ações e resultado e concede criatura uma única vez; capturas inventadas ou replays não concedem ativos; cliente não escreve propriedade; resolução de conflitos nunca ressuscita criatura trocada. |
| S2-03 / P0 | Como remetente, quero criar um link para oferecer uma criatura por uma espécie escolhida. | Apenas dono de criatura validada e desbloqueada cria oferta; criatura fica indisponível para outra oferta e combate; URL opaca pode ser copiada/compartilhada; link vence em 24 h pelo relógio do servidor; cancelamento libera criatura; informar que qualquer portador elegível pode aceitar. |
| S2-04 / P0 | Como destinatário, quero aceitar uma troca mesmo com meu amigo offline. | Prévia mostra oferta e espécie pedida; usuário seleciona instância elegível e confirma; servidor revalida propriedade, bloqueio, espécie, expiração e identidades distintas; troca 1:1 é atômica; remetente não precisa estar conectado; repetir pedido retorna o mesmo resultado. |
| S2-05 / P0 | Como jogador, quero confiar no resultado da troca. | Concorrência, replay, autoconsumo, acesso indevido e token inválido têm testes; duas aceitações simultâneas geram um único vencedor; aceitar/cancelar simultaneamente tem um único resultado final; token não permite listar inventário; regras negam alterações diretas em dono e ofertas. |
| S2-06 / P0 | Como equipe, queremos medir o funil social. | first_capture, trade_link_created e trade_completed têm definição e IDs de deduplicação; trade_completed nasce de confirmação autoritativa; logs não contêm token completo; falhas offline não contam como sucesso; testar fluxo entre dois perfis isolados. |
| S2-07 / P1 | Como jogador, quero proteger meu progresso em outro dispositivo. | Vinculação posterior com Google ou email preserva UID e coleção; colisão de contas tem resolução explícita, sem mescla automática de inventário; provedor indisponível não bloqueia jogo. |

Saída: dois perfis independentes completam o loop inteiro com remetente offline, sem perda ou duplicação. Validar no emulador e no ambiente hospedado configurado antes de declarar MVP online concluído.

## Cortes explícitos

PvP e battle_rooms operacionais; guildas/ligas; desafios diários; loja/passes; catálogo de quinze espécies; evoluções por ressonância; chat; mundo procedural; multiplayer no mapa; matchmaking; sincronização negociável de capturas offline; trocas com contrapropostas; implementação de puzzles ambientais de exploração.

FIRESTORE_SCHEMA.md e o protocolo autoritativo foram especificados na Fase 2 e implementados na Sprint 2; homologação remota segue pendente.

## Telemetria mínima

| Evento | Momento | Campos mínimos |
| --- | --- | --- |
| game_ready | Mapa visível e entrada ativa | duração, build, plataforma |
| encounter_started | Encontro efetivamente criado | encounterId, espécie, versão |
| battle_finished | Resultado consolidado | encounterId, resultado, turnos |
| first_capture | Primeira captura persistida; distinguir provisória de validada | eventId, creatureId, origem, status |
| trade_link_created | Oferta confirmada pelo servidor | eventId, tradeId, espécies |
| trade_completed | Transação confirmada pelo servidor | eventId, tradeId, duração da oferta |

pvp_match_finished está reservado para fase futura e não deve ser emitido no MVP. Métricas usam identificadores pseudônimos e não precisam do link compartilhável. Analytics externo, consentimento aplicável e política de retenção devem ser definidos antes de ativar coleta real.

## Revisão de combate v2 — implementada

Novos encontros clássicos com ações diretas, fases explícitas e PV intermediários; habilidades para cinco espécies com recarga, catálogo rebalanceado e desafio diário compatível. Critérios e evidências: [COMBAT_V2.md](COMBAT_V2.md). A especificação tática da Sprint 1 continua aplicada apenas a combates antigos salvos.
