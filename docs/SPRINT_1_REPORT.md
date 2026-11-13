# Choravia — Relatório da Sprint 1

Data: 2026-11-12. Status: protótipo local implementado; homologação de navegador pendente. Não equivale a aprovação de release.

## Entregue

- Angular standalone e Signals, TypeScript estrito e templates verificados por compilação AOT.
- Clareira Canvas com colisão, encontro na grama, NPC Iara e ruína narrativa; cinco espécies disponíveis.
- Teclado WASD/setas e direcional touch; arena por clique/toque e navegação por teclado numa grade DOM equivalente.
- Batalha 5x5 com movimento, ataque neutro, Faísca/Estalo, guarda, fuga e intenção inimiga fixa por turno.
- Fogo/grama e condução elétrica/água, dano determinístico, captura com primeira tentativa elegível guiada e modo ritual opcional sem alterar chance.
- Coleção, seleção de ativa, recuperação gratuita, retorno após derrota e save de batalha.
- IndexedDB com validação runtime, revisão, snapshot/backup transacionais e escritor único por Web Locks. Leitura tem limite de 500 ms, sem sobrescrever resultado tardio; exportação inclui memória e dados persistidos quando disponíveis.
- Preferências locais de áudio e movimento; nenhum asset/font externo ou analytics remoto.

## Verificação

Testes automatizados cobrem matriz elemental completa, dano e guarda, PRNG, comandos rejeitados, movimento, intenção, terrenos, captura única, fuga/derrota/limite de turnos, validação de save, paridade de continuação após serialização, escrita antes de anunciar captura, cliques repetidos, erro e timeout de armazenamento, fila limitada e percurso real do spawn à captura/retorno.

O teste de integração do domínio executa o percurso sem modificar vida, probabilidades ou posições durante o combate. Testes de persistência exercitam validação e contratos de orquestração; não substituem execução real da API IndexedDB num navegador.

Verificação final com Node 22.12.0: `npm test` passou com 27 testes, zero falhas; `npm run build` passou com checagem estrita dos templates. JavaScript de produção: 440,96 kB bruto / 144,44 kB gzip; CSS: 12,89 kB bruto / 3,79 kB gzip. Isso satisfaz a meta inicial de tamanho comprimido; não comprova carregamento em cinco segundos nem 60 fps.

## Limitação observada do ambiente

O servidor Vite foi impedido de abrir 127.0.0.1:5173 com `listen EPERM`. A tentativa de iniciar Google Chrome via Playwright também foi encerrada pelo ambiente antes de abrir a página. Nenhuma captura de tela, medição de FPS, aferição de contraste ou validação visual desktop/mobile foi obtida. Não foram solicitadas permissões adicionais.

`tests/browser-smoke.mjs` está preparado para verificar renderização, captura por controles reais, reload, layout mobile, touch, bloqueio entre abas e recuperação de snapshot corrompido em perfil isolado. Esse teste ainda não passou neste ambiente. Execute com `npm run dev` e, em outro terminal, `npm run test:browser`.

## Escopo ainda pendente

Homologar navegação por leitor de tela, touch físico, legibilidade/contraste, orientação e ciclo completo com IndexedDB. Medir cinco cargas frias no perfil documentado e FPS em caminhada/efeitos. Ajustar diversão e balanceamento após playtest.

Firebase, autenticação, propriedade validada e links de troca pertencem à Sprint 2. Todas as criaturas atuais são locais e não negociáveis. Não há botão que simule troca concluída ou link online fictício.

## Ajustes de implementação registrados

Exploração usa comandos de casas com interpolação, dispensando física contínua. Grava cada movimento; fila de eventos integra snapshot, sem diário separado. Navegadores sem Web Locks usam sessão temporária em vez de lease alternativo; segunda aba precisa recarregar quando a primeira fechar. Sem partículas ou screen shake nesta versão. Mudanças de detalhe estão registradas em FRONTEND_ARCHITECTURE.md.
