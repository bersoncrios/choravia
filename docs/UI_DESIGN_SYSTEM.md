# Choravia — sistema visual e jornada de entrada

## Direção

O jogo combina a atmosfera de uma floresta com a clareza de um caderno de exploração. Verde profundo sustenta a interface; marfim é a cor principal de leitura; musgo identifica progresso e natureza; ouro destaca a ação principal e recompensas. A apresentação narrativa pertence à página pública. A expedição usa cabeçalho compacto para dar prioridade ao mapa e à próxima ação.

## Tokens compartilhados

Definidos em `src/styles.css` e disponíveis aos componentes de apresentação:

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#0b1918` | Fundo da aplicação |
| `--color-surface` | `#142b27` | Painéis |
| `--color-surface-raised` | `#1d3830` | Barras e controles |
| `--color-border` | `#3b5749` | Separação de superfícies |
| `--color-text` | `#f5f0df` | Texto principal |
| `--color-muted` | `#b8c9b8` | Texto auxiliar |
| `--color-accent` | `#bcd693` | Progresso e identidade |
| `--color-gold` | `#f0cf78` | Ação principal e recompensas |
| `--color-danger` | `#efaa95` | Falhas e ações destrutivas |

Tipografia sem dependências externas: sistema sans para corpo e controles (`--font-body`); Georgia para títulos narrativos e nomes (`--font-display`). Corpo principal de 14–15px, texto auxiliar de 13px, dados compactos de 11–12px. Números e rótulos de apoio não devem disputar atenção com ações.

Espaçamentos de 4, 8, 12, 16, 24, 32 e 48px. Cantos de 12px para controles e 20px para painéis. Alvos interativos têm pelo menos 44px de altura; ações touch contextuais usam 48px. Foco de teclado explícito em ouro, com afastamento de 4px. Estados incluem texto e forma além de cor. As preferências de movimento reduzido existentes permanecem válidas.

## Responsividade

- Desktop a partir de 1100px: mapa e painel de jornada em duas colunas; jornada com 300px e mapa flexível.
- Tablet até 1099px: mapa em largura total, seguido pelo painel de jornada; resumo do Eco em duas colunas internas. Evita reduzir o mapa a uma área estreita.
- Mobile até 760px: margens de 16px, ações contextuais em grade, textos e controles legíveis; até 480px margens de 12px e cabeçalho em duas linhas.
- Trilhas do dia ocupam toda a largura da grade interna em tablet/mobile. Isso corrige o painel que anteriormente caía na coluna de 80px, gerando textos verticais e rolagem excessiva.
- Diálogos respeitam altura útil da tela e rolagem interna; os desenhos de personagem e a geometria das animações não são alterados pelo sistema visual.

## Entrada

A página de apresentação explica explorar, formar vínculos e desenvolver a coleção. Uma ação principal encaminha para login Google quando não há sessão ou para a expedição quando a conta já está conectada. O retorno à apresentação deve ser possível pela marca, sem limpar ou substituir o save. O carregamento da autenticação não deve exibir criação de personagem para uma conta antiga.

## Validação prevista

Verificar apresentação, login, sessão restaurada, onboarding, mapa, coleção, configurações e combate em 320, 390, 768, 1024 e 1360px; testar teclado e ausência de rolagem horizontal. O CSS usa tokens globais sem introduzir fontes remotas e preserva os componentes de desenho e movimento existentes.

## Implementação da navegação

- `/` exibe `WelcomePageComponent`; CTA encaminha a `/entrar` ou `/jogar` conforme a sessão disponível. A autenticação restaurada em `/entrar` atualiza a URL para `/jogar`.
- A aplicação mantém Canvas e painel de conta montados, ocultos e inertes na apresentação. Isso preserva a referência estática do Canvas e permite restaurar a autenticação e o save sem reinicializar a expedição.
- Comandos de teclado e despacho do jogo são ignorados na apresentação; renderização do mapa fica suspensa. Voltar/avançar do navegador atualiza a página; a marca volta à apresentação preservando o progresso.
- Links `/troca/{id}` conservam o fluxo e o token em memória existentes. Nenhuma alteração de Rules ou publicação necessária para a implementação local.
- O componente usa `@Input`/`@Output` compatíveis com o pipeline JIT do Vite e AOT de produção. Fontes permanecem locais e a arte da apresentação é SVG próprio.

## Validação concluída

- `npm test`: 119 testes aprovados.
- `npm run build`: Angular AOT e bundle de produção aprovados.
- `node tests/browser-welcome.mjs`: apresentação em 320, 390, 768, 1024, 1440 e 1920px; encaminhamento sem/com sessão, histórico do navegador, teclado e preservação da expedição aprovados.
- `node tests/browser-ui.mjs`: sete dimensões, guarda-roupa, persistência, loja, diálogos e foco aprovados.
- `node tests/browser-account-expedition.mjs`: expedição única, captura, trilhas e sincronização em background aprovadas; painel diário ocupa a largura útil no mobile/tablet.
- `node tests/browser-combat.mjs`: combate clássico e ações acessíveis em sete dimensões aprovados.
- Capturas locais em `artifacts/welcome-*.png`, `artifacts/ui-*.png` e `artifacts/account-expedition-*.png`. Inspeção visual da apresentação desktop/mobile e do jogo mobile realizada.
- Identidades e serviços simulados nas verificações de navegador; login Google real e deploy não realizados nesta revisão.

## Continuação — apresentação sem reservar a expedição

A primeira visita à apresentação não deve abrir o save nem reservar o Web Lock de gravação. A autenticação pode ser restaurada para atualizar o CTA, mas a ativação da conta e do cache aguardam a entrada em `/entrar`, `/jogar` ou no fluxo de troca. Uma sessão já aberta mantém sua proteção ao voltar à apresentação, pois pode haver gravações em andamento. Validar que uma aba de apresentação não bloqueia outra aba de jogo e que duas expedições continuam protegidas contra escrita simultânea.

Validação desta continuação: build aprovado; apresentação em seis dimensões, autenticação restaurada sem acesso ao save, duas abas com bloqueio/recuperação e regressão completa da expedição única aprovados em Chromium com identidades simuladas.
