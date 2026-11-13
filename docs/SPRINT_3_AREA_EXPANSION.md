# Choravia — Sprint 3: segunda área

## Objetivo

Dar continuidade à exploração após a Clareira do Primeiro Canto e fazer o mundo parecer conectado, sem alterar as regras de batalha e captura.

## Entrega

- A Clareira Antiga fica acessível pelo Arco Enraizado, no caminho leste da primeira área.
- O mesmo arco leva de volta à primeira clareira. A posição de chegada fica no caminho, sem exigir menu ou carregamento de conta.
- Cada área tem terreno, ruínas, ponto de recuperação e conjunto de encontros próprios.
- Na Clareira Antiga, um marco pode ser ouvido para revelar um trecho curto da história; a pedra acende depois da primeira interação.
- Saves antigos sem identificador de área continuam na primeira clareira; saves novos persistem a área atual.
- A coleção, a batalha, o login e o salvamento online mantêm o mesmo formato de criatura e encontro.

## Critérios de aceite

1. Caminhar até o arco muda a área e apresenta o nome dela.
2. A volta pelo arco retorna à primeira clareira.
3. Recarregar em qualquer uma das áreas mantém área e posição válidas.
4. Criaturas da Clareira Antiga são Brotatu, Gotril e Terruco; a clareira inicial mantém Braseco, Brotatu e Zunisco.
5. A recuperação funciona perto do marco de cada área.
6. Navegação por teclado e controles touch continuam usando a mesma ação de caminhar.
7. O marco pode ser ativado pelo botão acessível ou pela tecla `E`, e mantém o estado após recarregar.

## Fora do escopo

Terceira área, missões, inventário de itens, quebra-cabeças, criaturas novas e homologação remota. A expansão não publica Cloud Functions nem regras Firebase.

## Implementação

Estado da área adicionado de forma retrocompatível ao save `Game` v1: campo ausente significa Clareira do Primeiro Canto. Alterações no código precisam ser validadas com build e testes antes de considerar a sprint homologada.
