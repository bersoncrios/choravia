# Choravia — Arquitetura frontend

Fase 2 · agente Arquiteto Frontend. Implementação da Sprint 1 disponível; versões fixadas no package-lock.json. Angular 20.3.34, TypeScript 5.9.3 e Vite 6.4.1. Fontes primárias da arquitetura constam ao final.

## Fronteiras

Estrutura proposta:

```text
src/app/domain/       modelos, catálogo, regras, reducer e PRNG puro
src/app/application/  comandos, casos de uso, portas e snapshots
src/app/adapters/     Canvas, teclado/touch, IndexedDB e Firebase
src/app/ui/           componentes standalone, HUD, coleção e Signals
src/app/content/      mapa e diálogos versionados
functions/src/        endpoints e adaptadores de banco
packages/game-core/   extração compartilhada das regras antes da Sprint 2
```

Domain não importa Angular, DOM, Canvas, armazenamento ou Firebase. Application depende das interfaces SaveRepository, EncounterGateway, TradeGateway e EventSink. Adaptadores implementam interfaces. Engine recebe comandos tipados e retorna novo estado + eventos; nenhuma função de regra acessa Date.now ou Math.random. Estado e comandos usam unions discriminadas; TypeScript strict, noUncheckedIndexedAccess e exhaustive checks. Nunca usar any para contornar dados externos: validar unknown.

Contratos: Position {x,y}; SpeciesId união dos cinco IDs; CreatureInstance {id,speciesId,hp,provenance}; GameState discriminado em exploration/battle/result; BattleCommand em move/basic/skill/defend/capture/flee; GameEvent com ID e payload específicos; SaveEnvelope {schemaVersion,revision,updatedAt,payload}. Coordenadas e referências precisam de validação runtime, não apenas interfaces.

PRNG compartilhado xorshift32 com semente uint32 não zero; operação bitwise unsigned em cada passo. Sample = nextUint32/4294967296. RNG pertence ao estado serializável; apenas sorteio de espécie e tentativa elegível de captura consomem amostra. Encontro guiado não consome sorteio de captura. Golden vectors obrigatórios antes de usar a mesma regra no servidor.

## Renderização e estado

Um requestAnimationFrame fora do ciclo Angular; exploração simula passos fixos de 1/60 s com acumulador limitado a 5 passos por frame. Ao retomar aba, reiniciar acumulador, sem recuperar minutos de movimento. Batalha avança por comandos, não por frames. Interpolação e partículas ficam fora do snapshot de regras.

Decisão de implementação da Sprint 1: a exploração também avança por comandos discretos de uma casa, emitidos no máximo quatro vezes por segundo. Não foi necessário acumulador de física de 1/60 s; requestAnimationFrame apenas interpola a posição. Retomar aba solta os controles, sem recuperar movimento acumulado. Não há partículas nesta versão.

Signals expõem somente snapshots de HUD e seleção; não publicar signal de tempo a cada frame. OnPush e componentes standalone; um componente hospeda Canvas, outros expõem ações e grade acessível. Uma única fonte autoritativa de estado em memória. Canvas e DOM são projeções do mesmo estado, sem regras duplicadas.

## Inicialização e persistência

Carregar catálogo e mapa embutidos, recuperar save e montar cena. Timeout de leitura local de 500 ms: oferecer cena inicial provisória, mas bloquear mutações persistentes até resolver leitura, para não sobrescrever save atrasado. Em falha permanente, informar modo temporário e permitir recuperar/exportar backup antes de iniciar outro save.

IndexedDB com transações para snapshot e diário de eventos, versão explícita e último snapshot íntegro de backup. Autosave em término de movimento com debounce de 300 ms; capturas e transições salvam imediatamente antes de mostrar sucesso. Erro de quota mantém estado em memória e aviso persistente. Não depender só de beforeunload. Reload durante batalha retoma snapshot com RNG e plano inimigo; ritual incompleto volta à seleção antes de qualquer sorteio. Registro da resolução e captura deve ser único.

Multiaba: Web Locks quando disponível e fallback de lease em IndexedDB; segunda aba em modo leitura. Nenhuma aba grava snapshot sem verificar revision esperada em transação. BroadcastChannel informa novo snapshot. Troca online sempre invalida cache da instância transferida; inventário do servidor prevalece para ativos validados, nunca unir arrays de inventário por timestamp.

Decisão de implementação da Sprint 1: Web Locks garante escritor único; navegador sem suporte oferece sessão temporária, sem gravação. Segunda aba exibe orientação para fechar a primeira e recarregar; não há atualização ao vivo por BroadcastChannel ou lease alternativo. Snapshot e fila dos últimos 100 eventos são salvos juntos em transação com backup; diário separado fica adiado. Cada movimento aceito é salvo imediatamente, sem debounce nesta versão pequena. Falha de gravação mantém estado exportável em memória e bloqueia novos comandos até recuperação. Build de produção usa AOT e o linker Babel oficial do Angular para compilar pacotes parciais; desenvolvimento usa JIT via src/dev.ts. Uma checagem na geração de bundle impede publicar declarações Angular parciais.

Vercel: `vercel.json` define `npm run build` e `dist` como saída. O HTML de produção deve apontar para `/assets/index-*.js`; `/src/dev.ts` é exclusivo do Vite em desenvolvimento.

Firebase carrega dinamicamente após cena pronta; ausência de configuração mantém modo local com ações sociais indisponíveis e explicação curta. Autenticação e rede não participam do caminho crítico. Save local não autoriza propriedade online.

Sprint 2: adaptador SDK e sessão online estão implementados. O módulo canônico src/app/domain é incluído no build do backend em functions/lib/src/app/domain; não houve necessidade de extrair outro pacote ou duplicar regras. Contratos e validação de respostas também são puros. Backend e cliente compilam separadamente. Google pode vincular o visitante ou abrir explicitamente uma conta já existente; não há merge de inventários. A configuração recebida está em .env.local; nenhuma alteração remota foi confirmada.

## Performance a medir

Meta inicial: caminho crítico ≤250 KiB comprimidos, sem fontes remotas, sprites procedurais/atlas pequeno e sem Firebase no bundle inicial. Meta de 60 fps no perfil de teste; degradação de partículas antes de reduzir responsividade. Essas são metas, não medições existentes.

Perfil reprodutível: viewport 390×844, Chromium, CPU slowdown 4×, rede 4 Mbit/s down, 1 Mbit/s up, RTT 150 ms, cache vazio. Cinco execuções por build, registrar todas e p95; com cinco amostras, p95 pelo método nearest-rank equivale à maior medição. Aprovar entrada se todas <5 s. Complementar com dispositivo físico e anotar modelo/OS/browser, sem confundir simulação com hardware real.

## Referência

[Angular Signals](https://angular.dev/guide/signals), consultado em 2026-11-12: Signals notificam consumidores quando seu valor muda. A decisão de reservar Signals para HUD e manter o loop Canvas independente é arquitetura deste projeto.
