# GM: catálogo, balanceamento e badges

## Decisões

- Acessórios personalizados usam modelos visuais (broche, lenço, coroa), cor hexadecimal, nome, descrição, preço em Sementes e publicação/retirada da loja. Não executar HTML, CSS ou scripts fornecidos por administradores. Retirar não remove compras anteriores.
- Balanceamento por espécie: PV base 20–200, ataque e defesa 1–50. Configuração explícita no snapshot do jogo e da batalha; aplicar alterações apenas fora de batalhas em andamento. Saves sem configuração usam valores originais. Preservar XP e níveis, limitar PV ao novo máximo sem recuperar criaturas derrotadas.
- Badges possuem nome, descrição, símbolo de catálogo, cor, categoria evento/marco/especial e estado ativo. O GM concede a badge a um UID com motivo; uma badge por jogador, sem duplicação em retries. Concessão é independente do save e permanece após reset de progresso.
- Conteúdo em shop_accessories, eco_balance e badge_definitions; concessões em users/{uid}/badges. Leituras autenticadas, escritas somente admin e vinculadas a content_audit imutável na mesma transação. Atualizações exigem revisão esperada para não sobrescrever outro GM. Repetição de requestId tem o mesmo resultado; reutilização com outro payload é rejeitada.
- Cliente continua Firestore direto. Não alterar role via UI. Preparar Rules e frontend juntos, sem publicação automática. Operações offline não são confirmadas como publicadas. Sem moeda real ou autoridade independente de servidor para resultados do combate.

## Experiência

Painel GM oferece editores de acessórios, atributos e badges, com motivo obrigatório. A loja e o guarda-roupa recebem os acessórios publicados; Canvas e prévia mostram o modelo escolhido. O painel Companheiro exibe as badges concedidas à conta. Login e troca de conta cancelam assinaturas antigas e limpam badges da conta anterior.

## Uso

Em **GM → Conteúdo e eventos**, preencha o motivo da alteração e abra o editor desejado:

1. **Acessórios da loja**: crie uma peça ou selecione uma existente, escolha broche/lenço/coroa, cor, descrição e preço; salve para publicar. Desmarcar disponibilidade retira a oferta e preserva compras e equipamento já existentes. Novas peças recebem ID estável; o catálogo suporta até 100 definições.
2. **Balanceamento dos Ecos**: selecione a espécie e carregue a versão atual, ajuste PV/ataque/defesa e publique. Curvas de XP, elementos e habilidades permanecem existentes. O snapshot de atributos fica explícito no save; batalhas em curso conservam sua versão até o retorno à exploração.
3. **Badges de eventos e marcos**: crie uma definição com símbolo, cor e categoria e salve; selecione/cole o UID do jogador e conceda a badge selecionada. A concessão é manual e única por badge/jogador; o motivo é mostrado ao jogador. Inativar uma definição impede novas concessões e preserva o histórico de quem recebeu.
4. **Histórico de conteúdo e badges**: consulte as 30 operações mais recentes, com ator, data, destino e motivo. Esse histórico é separado das concessões antigas de Sementes/cosméticos e resets.

A loja recebe peças publicadas em tempo real. Guarda-roupa e Canvas suportam as peças personalizadas. **Menu → Companheiro → Badges do Guardião** mostra os reconhecimentos da própria conta. Badges não dependem da existência de save e sobrevivem a reset de progresso; contas antigas com expedição também podem receber.

## Publicação

Publicar **firestore.rules e frontend compatíveis juntos**. As novas coleções são negadas pelas Rules anteriores; a interface mostra falha do catálogo em Conta e trocas enquanto não houver autorização de leitura. Não publicar Functions. A implementação local não publica recursos nem cria conteúdo em produção.

## Validação

- `npm test`: 125 testes aprovados. Novos casos cobrem payloads inválidos, papel administrativo, auditoria, replay de operação, revisão concorrente, compra/equipamento/retirada de acessórios, limites de configuração, badges e persistência de snapshots de balanceamento.
- `npm run build`: Angular AOT e bundle de produção aprovados.
- Auth/Firestore emulados em `demo-wildwoods`: 12 testes aprovados. Nova integração cobre publicação/retirada, impedimento de escrita sem auditoria, acesso não administrativo, revisão esperada, concessão idempotente, privacidade de badges, imutabilidade dos registros e assinaturas em tempo real do catálogo e das badges do jogador.
- `node tests/browser-live-ops.mjs`: criação de acessório, compra/equipamento/prévia, ajuste de atributos, criação/concessão/exibição de badge e quatro tamanhos (320, 390, 768, 1360px) aprovados com adaptador em memória.
- Regressões Chromium de interface/role GM e combate clássico aprovadas em sete dimensões cada.
- Capturas em `artifacts/live-ops-gm-*.png`; inspeção visual de mobile e desktop realizada. Nenhum teste acessou usuários ou banco de produção.
