# Ambientes, música, efeitos e leitura dos mapas

## Escopo P1.4

A primeira camada sonora substitui o tom único por sons sintetizados localmente: passos por superfície, ataques, habilidades elementais, defesa, coleta, restauração, portal, captura/resistência e progressão. Os quatro biomas recebem ambientes distintos e motivos musicais curtos de exploração; o combate usa um tema próprio. Não há arquivos ou serviços de áudio externos.

O som continua desligado por padrão. Configurações oferece volume geral, música, ambiente e efeitos independentes, além de uma prévia. Os valores ficam nas preferências locais, sem alterar o save ou o Firestore. Preferências antigas conservam som/movimento/pulso e recebem os volumes padrão; dados inválidos são normalizados.

O AudioContext só é criado/retomado a partir de um gesto do jogador. Trocar de região/cena não cria outro contexto ou scheduler. Ocultar a aba, voltar à apresentação, sair da conta ou desligar som interrompe o ambiente e cancela sons agendados; um gesto ao voltar permite retomar. Não deixar loops órfãos entre contas, páginas ou sessões.

A síntese tem envelopes suaves, um scheduler limitado e teto de vozes, sem tocar um efeito a cada frame. Passos têm intervalo mínimo e são acionados somente por movimentos aceitos. Efeitos de rodada acompanham as fases visuais já existentes; a aceleração não repete os sons. Toda informação continua disponível visualmente.

## Polimento Canvas

Conservar geometria e regras dos quatro mapas. Usar texturas determinísticas por bioma, bordas legíveis de caminhos, sombras e profundidade. Sinalizar visualmente duelistas que oferecem revanche e preservar os estados dos mecanismos/restaurações. Comparar as mesmas regiões, sementes e posições antes/depois. O desenho não pode avançar o RNG, alterar colisão ou criar partículas sem limite.

## Validação local concluída

- Testes puros de normalização de volume e seleção de sons somente após comandos aceitos.
- Testes do adaptador com relógio/contexto controlados: ausência de autoplay, mixer, limite de vozes, suspensão, timers, falha de reprodução e cleanup.
- Navegador com AudioContext real instrumentado: gesto inicial, canais independentes, persistência, reconexão de cena, movimentos rejeitados e quatro larguras.
- `npm test`: 163 testes unitários/aplicação aprovados; build AOT/Vite aprovado. Continua aviso do chunk principal acima de 500 kB.
- Chromium com AudioContext real: gesto inicial, volumes independentes, canais mudos, cues só para comandos aceitos, suspensão/retomada, persistência/migração e 320/390/768/1360 px aprovados. Capturas `artifacts/audio-settings-{320,390,768,1360}.png`.
- Chromium de combate, diário, atividades e Game Master aprovados contra o estado atual; Game Master também passou nas 14 integrações Auth/Firestore do emulador.
- Quatro mapas foram capturados antes/depois com mesma seed, posição e estados determinísticos. Capturas `artifacts/map-polish-{before,after}-{clearing,old-grove,canopy-trail,tide-cavern}.png` inspecionadas; mudanças visuais não alteram geometria. As capturas também mostram que as áreas de mapa e texto atual continuam pixeladas pelo Canvas, portanto o polimento melhora leitura e bioma sem trocar o estilo.
- Medidas automatizadas de sinal/estado não equivalem a uma avaliação auditiva humana ou teste em aparelho físico.

Nenhuma publicação ou alteração em produção faz parte desta etapa.
