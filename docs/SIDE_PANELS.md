# Painéis laterais da expedição

O mapa ocupa a área principal. O menu abre um painel lateral com três destinos: Companheiro (Eco ativo, coleção e diário), Trilhas (desafios e recompensas) e Conta e trocas (Vínculos que viajam). Só o conteúdo selecionado aparece; o painel fecha pelo botão, Escape ou clique no fundo. No celular ocupa a largura disponível, com rolagem interna.

Manter o componente de conta montado mesmo com o painel fechado, preservando autenticação, sincronização e convites. Abrir os painéis interrompe movimento mantido, evita atalhos no mapa, transfere o foco para o painel e o devolve ao menu ao fechar. Diálogos de coleção/configurações conservam prioridade sobre o painel. Nenhuma mudança de regras ou persistência.

## Validação

- Build Angular AOT e bundle de produção aprovados.
- Chromium de interface aprovado em sete dimensões, incluindo coleção sobre o painel, foco, Escape, loja e configurações.
- Expedição única aprovada com menu em 320, 390, 768 e 1360px: limites da tela, trilhas em largura útil, bloqueio dos atalhos de mapa, troca para conta e retorno do foco ao botão Menu.
- Trilhas com falha transitória, recompensa idempotente e troca de conta aprovadas no painel lateral.
- Capturas em `artifacts/drawer-daily-*.png` e `artifacts/account-expedition-*.png`. Identidades simuladas, sem publicação.
