# Habilidades de campo e revanche de treino

## Decisões de entrega

A próxima etapa P1.3 dá utilidade ambiental aos cinco elementos nos quatro mapas existentes. Cada mecanismo oferece uma solução pelo Eco ativo e uma solução manual gratuita com o mesmo efeito. Nenhuma passagem obrigatória depende de possuir um elemento. As mudanças ficam no save da expedição, sem interferir no ledger de coleta ou nas regras de combate.

| Elemento | Região | Atividade | Resultado |
| --- | --- | --- | --- |
| Fogo | Clareira do Primeiro Canto | Reacender uma lanterna antiga | Marco luminoso e memória de viajantes |
| Planta | Clareira Antiga | Recuperar um jardim sob raízes | Trilha florida orientando a exploração |
| Água | Gruta das Marés | Destravar uma roda d’água | Mecanismo e corrente restaurados |
| Elétrico | Trilha das Copas | Reativar um farol | Sinal luminoso de orientação |
| Terra | Gruta das Marés | Reconstruir uma pequena ponte | Travessia opcional sobre o canal |

Cada conclusão permanece visualmente restaurada, aparece nas atividades do diário e pode ser consultada novamente. A ação verifica exploração, região, alcance e estado. A opção elemental exige Eco saudável do elemento indicado; a manual permite concluir sem esse Eco. Nenhuma das soluções consome itens ou concede Sementes/XP.

Revanches são treinos opcionais disponíveis após vencer o duelo inicial do NPC. A primeira vitória mantém sua recompensa atual. Nos treinos, o jogador experimenta estratégias e registra vitórias, melhor rodada e objetivos de habilidade/defesa. Não há Sementes, XP, captura nem progresso de Trilhas do dia em revanches. Assim, a repetição não cria uma fonte ilimitada de recompensas. Derrota e fuga não avançam recordes; os pontos de recuperação existentes continuam gratuitos.

## Persistência e compatibilidade

Campos opcionais de restauração e recordes ficam no `Game` e são validados com IDs/limites explícitos. O save continua versão 1; ausência dos campos significa nenhuma dessas novas atividades concluída. Batalhas de treino persistem seus objetivos e ações já realizadas para permitir retomada.

A ponte é uma sobreposição do mapa de exploração, não uma alteração da geometria base nem dos layouts antigos. Movimento, desenho e validação de posição devem consultar a mesma função para permitir salvar/recarregar sobre a travessia restaurada. A geração não desloca vasos ou NPCs nem avança o RNG.

A execução continua no cliente, sob a arquitetura atual de Firestore direto. Estes marcos e recordes são progresso pessoal, não prova independente de exploração/vitória. Não autorizar recompensas competitivas ou operações administrativas a partir deles. Sem nova coleção, publicação ou alteração de dados de produção nesta etapa.

## Critérios de aceite

- Cinco elementos têm atividade, solução manual equivalente e estados antes/depois visíveis.
- Comandos fora de alcance, na região errada, durante batalha ou já concluídos não alteram o save.
- Trocar/recarregar preserva mecanismos e treino; saves anteriores continuam válidos.
- Ponte permanece caminhável e o save passa pelo validador enquanto o personagem está sobre ela.
- Revanche exige vitória anterior, preserva Sementes/XP e não permite captura ou avanço das trilhas.
- Objetivos variam por progresso de treino; recordes só avançam com vitória, sem duplicação ao retornar/recarregar o resultado.
- A interface explica a alternativa manual, os objetivos e a ausência de recompensas econômicas no treino.
- Navegador 320/390/768/1360 px, teclado/E, touch e movimento reduzido permanecem utilizáveis.

Resultados reais de testes e capturas serão registrados após a validação.
