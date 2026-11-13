# Choravia — Plano de QA e telemetria

Fase 2 · agente QA & Engenheiro de Telemetria. Plano de referência. Após Sprint 2: 63 testes de domínio/serviço/sessão passaram; frontend AOT e backend compilam. Os quatro testes reais de emulador estão preparados, mas não executaram por bloqueio de portas; navegador e acesso remoto também não foram homologados. Resultados em SPRINT_1_REPORT.md e SPRINT_2_REPORT.md; cenários abaixo não devem ser considerados todos executados.

## Sprint 1: testes unitários de regras

| Área | Cenários e resultado esperado |
| --- | --- |
| Dano | 25 pares elementais; exemplo Faísca=12 e com guarda=6; dano mínimo 1; zero crítico/aleatoriedade; nenhuma vida negativa |
| Turno | Não mover duas vezes; não agir fora do turno; input inválido não altera RNG; ação encerra turno; guarda termina no começo do turno do defensor |
| Movimento | Limites 0..4, distância cardinal, casa ocupada, sem diagonal; plano inimigo permanece fixo após desvio |
| Fogo | Grama vira fogo; duração 4 encerramentos incluindo aplicação; 3 de dano só ao ator que encerra na casa; não propaga; não renova; vira chão |
| Água | Flood fill ortogonal não atravessa diagonal; Estalo causa um acerto por ocupante; pode ferir atacante; derrota simultânea não captura |
| Captura | Desabilitada acima de 50%, distância >2 ou alvo morto; p=0,65 em meia vida; igualdade u=p falha; limite 0,95; pity até duas falhas; guiada garante sucesso sem RNG |
| Paridade acessível | Mesmo estado e amostra produzem resultado igual nos dois modos; múltiplos toques, timeout e aba oculta não duplicam comando |
| Encerramento | Captura única por encontro; fuga e morte não recompensam; limite de 40 rodadas; encerrado rejeita ações |
| Persistência | Snapshot completo retoma RNG/plano/turno; save inválido usa backup; quota avisa sem anunciar persistência; revisão impede sobrescrita por segunda aba |

Teste de PRNG com vetores fixos executado no navegador e Node antes de compartilhar core. Testes de domínio sem Canvas ou Firebase; testes do adaptador de save com falhas injetadas. Evitar snapshots visuais usados como substituto de regras.

## Sprint 1: fluxo manual e integração

Desktop: teclado, mouse, foco e leitor de tela; mobile: 320 px e 390 px, retrato/paisagem, touch contínuo, pointercancel e retomada de aba. Percorrer os cinco encontros; vencer, perder, fugir e capturar. Recarregar durante exploração, batalha e ritual. Recuperar coleção com Iara; testar troca de ativa fora de combate e seleção de criatura morta. Ativar movimento reduzido e mute.

Medir entrada usando perfil e cinco amostras do FRONTEND_ARCHITECTURE.md; registrar bundle e latência. Verificar FPS em caminhada por 60 s e em efeitos, sem declarar meta cumprida por inspeção de código. Conferir contraste das combinações usadas e acesso a todas as ações pelo DOM.

## Sprint 2: emuladores e adversários

1. Anônimo sem autenticação não lê inventário; autenticado não lê terceiros, não lista ofertas, não escreve dono, lock, encontros ou resultados. preferences rejeita campos extras/tipos inválidos.
2. Dois aceites concorrentes: uma troca, dois donos corretos, um evento. Aceite versus cancelamento tem um vencedor. Falha forçada na transação não deixa transferência parcial.
3. Repetir requestId devolve resultado; mudar payload falha. Token inválido/rotacionado, relógio adulterado, oferta vencida e autoconsumo falham sem transferir.
4. Criatura bloqueada não entra em encontro nem segunda oferta. Expirar libera só lock correspondente; tarefa repetida não altera criatura transferida. Última criatura ofertada pode ser recuperada por cancelamento.
5. Captura forjada, sequência fora de ordem, comando incompatível e RNG do cliente são rejeitados. Mesmo encontro repetido não concede outra criatura. Transação repetida não emite analytics externo duplicado.
6. Perfil A envia link; fecha aba. B autentica, visualiza e aceita. A retorna e recebe inventário do servidor, sem restaurar criatura antiga pelo cache. Rede cai antes/depois do commit: retry reconcilia resultado.
7. Concessão inicial idempotente; conta já existente em vinculação não recebe merge automático; dados de configuração ausentes mantêm modo local funcional.

Regras em Emulator Suite com credenciais simuladas e funções com Admin SDK: ambos precisam de testes, pois Admin não passa por Security Rules. Integração hospedada exige projeto configurado; resultado em emulador não equivale a homologação online.

## Progressão dos Ecos

Validar nível 1 com atributos base, ganho de XP em vitória/captura/NPC, ausência de XP em derrota/fuga, múltiplas subidas de nível, limite 30 e XP zero no limite. Confirmar que PV máximos e dano usam nível, cura respeita os novos máximos, capturas herdam o nível selvagem, saves antigos abrem no nível 1 e trocas preservam nível/XP. Repetir a sequência online com duas sessões e verificar que o cliente não consegue alterar nível/XP Firestore. Esta checagem foi adicionada ao plano; não foi executada nesta implementação.

## Telemetria operacional

Eventos de produto definidos em BACKLOG_MVP.md; adicionar schemaVersion, eventId e sessionId aleatório local. first_capture local e validada têm origens separadas; não somar como duas pessoas convertidas. trade_completed só é produzido pelo evento transacional; consumidor aceita entrega repetida com deduplicação. pvp_match_finished não é emitido.

Eventos técnicos mínimos: save_failed(código enumerado), encounter_sync_failed(código), trade_failed(código), game_ready(duração). Sem texto arbitrário de exceção, tokens, e-mail, URL completa ou UID de terceiro. Logs não registram corpos de endpoints de troca.

Funil: sessões com game_ready → encounter_started → battle_finished → first_capture; funil social usa ofertas criadas → concluídas dentro da validade. D1/D7 usam coorte de primeira sessão com identificador pseudônimo autorizado e retorno no dia de calendário UTC +1/+7, nunca só contagem bruta de eventos. Sem coleta externa ativada nesta fase.

## Critério de saída e revisão documental

Sprint 1: testes de domínio/save passam, fluxo local completo validado nos dois tipos de controle, relatório de performance real. Sprint 2: Rules e transações passam em concorrência, fluxo entre dois perfis passa no emulador e homologação configurada; nenhuma fraude conhecida capaz de duplicar propriedade.

Revisão documental identificou e resolveu: timing não altera probabilidade (equivalência acessível); tokens não são recuperáveis após hash (rotação explícita); expiração não depende de TTL; cliente não valida propriedade; online usa comandos autoritativos, offline é provisório. Riscos ainda a testar: diversão/ritmo da batalha, latência por comando e custos em uso real. Não confundir plano de QA com aprovação de release.
