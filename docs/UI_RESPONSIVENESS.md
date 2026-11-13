# Revisão de interface e personalização

## Decisões

- Diferenciar a primeira criação do guarda-roupa: abrir com o visual equipado, salvar explicitamente ou cancelar sem alterar o personagem.
- Preservar coleção, Eco inicial, posição, moedas e progressão ao personalizar.
- Exibir configurações e coleção em diálogos acessíveis, evitando painéis abertos fora da área visível. Bloquear movimento sob diálogos e manter navegação por teclado dentro deles.
- Permitir rolagem dos resultados sobre o Canvas; manter o Canvas e a arena proporcionais.
- Reorganizar cabeçalho, indicadores do Eco e cartões em telas estreitas; manter controles de toque disponíveis em dispositivos com ponteiro impreciso.

## Validação planejada

Build Angular/TypeScript, testes de regras e verificação em Chromium de larguras mobile/desktop, telas baixas, diálogos, personalização/cancelamento e persistência local. A verificação local não homologa login Google nem operações Firestore reais.

## Resultado da validação

- `npm run build`: compilação Angular e bundle de produção aprovados.
- `npm test`: 90 testes aprovados, incluindo a regressão de personalização durante batalha.
- `npm run test:ui` (com `npm run dev` ativo): Chromium, sem erros JavaScript, nas dimensões 320×568, 360×640, 390×844, 768×1024, 1024×768, 1360×900 e 667×375.
- Verificados: ausência de transbordamento horizontal, configurações/coleção visíveis, foco no guarda-roupa, bloqueio de movimento sob diálogos, cancelar sem alteração, salvar/reabrir/recarregar com o visual equipado, preservação do progresso, ação de defesa e retorno dos resultados em telas pequenas.
- Capturas locais ficam em `artifacts/ui-*.png` (não versionadas).
- O teste usa uma identidade fictícia apenas em memória via ferramentas de desenvolvimento Angular e bloqueia requisições Google; não contém alteração de autenticação no aplicativo. Login Google, Firestore e dispositivos físicos ainda precisam de homologação própria.
- Corrigidas duas inconsistências encontradas na suíte: campo opcional `avatar` explicitamente indefinido no estado inicial (diferia após serialização JSON), e expectativa antiga do preview de troca que omitia `offeredLevel`.

## Melhorias de usabilidade aprovadas

1. Um objetivo atual curto junto ao mapa, atualizado conforme selos, exploração e capturas, para orientar o retorno ao jogo.
2. Uma explicação contextual sobre alcance e vantagem elemental ao selecionar uma ação, antes de tocar na arena.
3. Acesso direto ao guarda-roupa a partir das peças adquiridas na loja, com indicação clara de qual peça está equipada.

As três melhorias foram implementadas na continuação descrita abaixo, sem alteração de balanceamento.

## Continuação — orientação e acesso aos cosméticos

Implementar as três sugestões aprovadas: objetivo derivado do progresso ao lado do mapa; dicas de batalha derivadas da ação selecionada e dos multiplicadores existentes (ataque básico é neutro); experimentar peças adquiridas pela loja em um rascunho, sem equipar até salvar. O guarda-roupa deve devolver o usuário ao diálogo de origem, com indicação do equipamento atual. Itens de Eco/exploração continuam com ativação automática existente. Nenhuma regra de combate, recompensa ou compra será alterada. A compra já equipa peças do Guardião automaticamente; esse comportamento será preservado e explicado na loja.


### Validação da continuação

- Build de produção aprovado e 92 testes passando, incluindo objetivos por progresso e dicas de alcance/efetividade.
- Teste Chromium aprovado nas mesmas sete dimensões, acrescido de: objetivo inicial visível, compra e identificação da capa equipada, abertura do guarda-roupa pela peça, troca de visual, prévia/cancelamento sem alteração e equipar novamente sem nova cobrança; dicas de ataque neutro e habilidade com vantagem elemental.
- Os percursos antigos dos testes de sessão online agora usam semente fixa para evitar bloqueios aleatórios por vasos/duelistas.
- Compra continua equipando a peça imediatamente; experimentar uma peça já adquirida apenas altera o rascunho até salvar. O retorno do guarda-roupa preserva o diálogo de origem (loja/configurações).
