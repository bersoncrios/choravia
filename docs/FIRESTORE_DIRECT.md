> Atualização de produto: [Expedição única da conta](SINGLE_EXPEDITION.md). Mundo e inventário agora são reconciliados, com migração por recibos e trilhas da mesma expedição. A arquitetura permanece cliente + Firestore direto, sem servidor independente validando resultados.

# Firestore direto — decisão e migração

Por solicitação explícita do usuário, o aplicativo usa Firebase Authentication e Firestore diretamente, sem App Check/reCAPTCHA e sem chamadas a Cloud Functions.

## Regras de jogo preservadas

O mesmo `GameService` foi movido de `functions/src/service.ts` para `src/app/domain/online-engine/service.ts`. O caminho antigo reexporta o serviço para manter compatibilidade com testes e código legado. Os contratos do gateway e o reducer de combate continuam iguais. Permanecem progressão, captura, primeiro Eco por conta, desafios diários/semanais, recibos de recompensas, paginação, limites, reservas, cancelamento/expiração, convites, rotação de tokens e aceites idempotentes.

`BrowserFirestoreStore` adapta a porta transacional ao SDK Web. As gravações são acumuladas até todas as leituras terminarem, como exige o Firestore. As trocas transferem ambas as criaturas e encerram a oferta numa única transação. `tokenProof` é enviado somente no aceite; as Rules conferem seu SHA-256 contra o hash do convite. Listagem pública de ofertas é negada. `transferTradeId` relaciona cada mudança de dono à mesma troca concluída.

Os documentos existentes de criaturas, encontros, ofertas, progresso e saves são mantidos. O perfil legado não é limpo pelo cliente durante a migração, preservando campos administrativos. Recibos de operações passam a usar `users/{uid}/operations/{requestId}`; o caminho anterior tinha quantidade ímpar de segmentos e não era um caminho válido de documento Firestore.

## Limite de confiança

As regras de jogabilidade continuam no motor compartilhado, mas agora são executadas no navegador. As Security Rules autorizam acesso, formato, revisão, propriedade, reservas e transferências atômicas; elas não reexecutam o reducer TypeScript, não escondem o RNG do próprio jogador e não comprovam que um resultado de batalha ou recompensa foi obtido honestamente. O limitador por UID continua no serviço e valida seu próprio documento, mas não é um limitador global inviolável de leituras/escritas. Não apresentar esse inventário como validado por servidor.

O perfil, o save e os recibos de recompensas continuam privados. O estado operacional `users/{uid}/online/state` pode ser lido por ID por usuários autenticados para executar trocas; não contém email nem snapshot pessoal. Os dados da criatura ofertada e da oferta podem ser lidos por ID por um usuário autenticado. O token é necessário para concluir o aceite.

O GM consulta perfis já registrados no Firestore, em vez de usar Admin Auth. A role `users/{uid}.role = "admin"` deve ser atribuída pelo administrador no Console; o jogador não pode atribuir a própria role. Alterações do GM e o registro de auditoria são gravados juntos em transação. As Rules não interpretam o JSON do snapshot do save; administradores são usuários privilegiados.

## Publicação

1. Inspecionar e preservar regras de outras coleções que possam existir no projeto.
2. Publicar `firestore.rules` e os índices:

   ```sh
   npx firebase-tools deploy --only firestore:rules,firestore:indexes --project wildwoods-b3684
   ```

3. Publicar o frontend atualizado na Vercel.
4. No Console Firebase, deixar App Check sem enforcement nos serviços usados pelo jogo, se estiver ativo.
5. Homologar login, save, captura, desafios, troca com duas contas e GM.

Não é necessário publicar Functions. A remoção de funções antigas, caso existam, é uma operação separada; esta migração não as apaga.

## Verificação

```sh
npm run build
npm test
npx firebase-tools emulators:exec --only auth,firestore --project demo-wildwoods "npm run test:emulator"
```

Os testes de emulador importam o adaptador real do cliente e o mesmo motor de regras. Nenhuma chamada callable é necessária.

## Resultado da verificação desta migração

- Build de produção: passou.
- Integração real nos emuladores Auth/Firestore: 9 testes passaram, incluindo captura/replay simultâneo, aceites concorrentes, expiração, desafios, permissões do GM e recusa de reutilização de troca antiga.
- Suíte geral: 85 de 89 passaram. Permanecem falhas já observadas antes da migração: expectativa antiga sem `offeredLevel`, comparação de saves com `avatar: undefined` removido pelo JSON e teste de percurso que depende da geração do mapa.
- Nenhuma publicação de Rules, frontend ou alteração no banco de produção foi executada.
