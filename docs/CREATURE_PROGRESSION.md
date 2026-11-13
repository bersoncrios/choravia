# Progressão dos Ecos

Os atributos base atuais e os poderes do combate clássico estão em [COMBAT_V2.md](COMBAT_V2.md). As regras de níveis e XP abaixo continuam válidas.

## Objetivo

Dar progressão de longo prazo sem trocar a identidade elemental dos Ecos nem permitir que níveis tornem uma batalha automaticamente fácil. Cada Eco sobe de nível individualmente; capturas começam no nível do Eco selvagem e trocas carregam nível e experiência.

## Regras do MVP

- Níveis de **1 a 30**, sem evolução de espécie nesta entrega.
- XP fica salvo como progresso parcial para o próximo nível. O limite do nível 30 não acumula XP.
- XP para o próximo nível: `30 + 12 × nível atual`.
- Vitória em encontro selvagem: `30 + 5 × nível do adversário` XP.
- Captura bem-sucedida: `18 + 3 × nível do Eco capturado` XP para o Eco que participou; não exige derrotar o alvo.
- Vitória em duelo de NPC: `45 + 5 × nível do adversário` XP. Derrota, fuga e retirada não concedem XP.
- A cada nível, PV máximos aumentam em `⌊PV base / 30⌋`, mínimo 1. Ataque e defesa passam a `atributo base + ⌊atributo base × (nível − 1) / 25⌋`.
- Ao subir de nível, PV atuais recebem o mesmo aumento dos PV máximos e não ultrapassam o novo máximo. Cura completa continua restrita aos pontos de descanso.
- Inimigos selvagens e de duelo aparecem no nível do Eco ativo. Isso mantém os encontros do MVP justos; áreas futuras poderão ter faixas próprias explícitas.
- O cálculo usa os atributos base já definidos no catálogo. Elementos, terreno, guarda e efeitos de habilidade continuam aplicados depois dos atributos de nível.

## Compatibilidade e autoridade

Saves antigos sem `level` ou `experience` são interpretados como nível 1 e 0 XP. Novas capturas, saves locais e inventário online gravam ambos os campos. As batalhas online usam o motor compartilhado executado pelo cliente, com transações Firestore, que concede XP ao encerrar o encontro e persiste o nível no registro da criatura. Não há validação independente do resultado por servidor. Uma troca transfere a criatura inteira, incluindo a progressão.

O jogo local permanece editável pelo próprio navegador, como o restante do save solo. O adaptador online usa as transações do motor compartilhado para preservar idempotência. Futuras classificações competitivas exigem uma arquitetura com autoridade independente do cliente.

## Interface e feedback

- Exibir nível, barra de XP e PV/ataque/defesa efetivos na coleção e no Eco ativo.
- Mostrar nível de ambos os Ecos e PV máximos reais na arena.
- Ao alcançar um nível, anunciar o novo nível e os aumentos de atributos sem modal bloqueante.
- Capturas, trocas e derrotas não devem resetar experiência.

## Fora do escopo

Evolução, atributos aleatórios, IV/EV, itens de experiência, treinamento pago, bônus de XP premium e vantagem de nível em PvP. Não vender níveis ou XP.
