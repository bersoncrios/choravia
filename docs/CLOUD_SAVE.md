> Atualização: [Expedição única](SINGLE_EXPEDITION.md). O save da conta agora inclui a coleção reconciliada com o inventário de trocas. O cache local serve para recuperação; não há expedição pessoal separada ou opção de jogar sem conexão. O caminho histórico `saves/solo` foi mantido para preservar dados.

# Perfil e progresso pessoal na conta

Implementação desta etapa: perfil Google visível e salvamento pessoal em Firestore, independente das funções de troca. A aparência inicial do Guardião agora faz parte do snapshot pessoal. Não publicar regras nem afirmar gravação remota sem confirmação.

## Separação de dados

- Auth fornece UID, nome, email e foto; o perfil autenticado é salvo em users/{uid} e aparece após autenticação. Cada jogador só pode atualizar os campos que coincidem com o token Firebase; a role administrativa não pode ser alterada pelo cliente.
- IndexedDB mantém namespaces distintos para cache legado de visitante e cada UID. Entrar/sair não sobrescreve a expedição de outra conta; sem Google autenticado o jogador permanece no onboarding e não controla o personagem.
- O save pessoal fica em users/{uid}/saves/solo. Somente o dono pode ler/escrever. O snapshot guarda estado de jogo (avatar, mapa, Ecos, desafios e Sementes), sem email/nome/foto da conta e sem autoridade sobre creatures ou trade_links.
- O backend mantém estado da expedição online separadamente em users/{uid}/online/state. Saves legados com esse estado no documento pai são migrados no bootstrap sem apagar role ou perfil.
- Capturas pessoais continuam com provenance=local mesmo salvas na conta. Nunca são promovidas automaticamente a criaturas negociáveis.

## Sincronização

Carregar primeiro o cache da conta. Se não existir, preservar o visitante e preparar sua cópia para a primeira conta; ao trocar entre contas, iniciar outro namespace. Se houver save remoto e nenhum cache da conta, restaurá-lo. Se houver alterações locais e remotas concorrentes, oferecer escolha explícita, mantendo backup local.

Gravar localmente antes de enviar. Agregar caminhada em intervalos de 1,5 s; captura e fim de encontro podem solicitar sincronização imediata. Exibir salvo na conta apenas após confirmação da transação. Falhas mantêm cache e pedido pendente recuperável.

Cada escrita carrega expectedRevision e writeId. A transação compara revisão e incrementa exatamente uma vez. Repetir o mesmo pedido retorna o resultado existente, sem duplicar revisão; revisões concorrentes geram conflito. Um pedido pendente é persistido antes do envio e reaproveitado após perda da resposta.

O JSON possui versão, validação runtime e limite de 700 kB UTF-8, abaixo do limite de documento Firestore. Conteúdo é privado e editável pelo dono; nenhum backend de batalha/troca confia nele.

## Aceite

Nome/email/avatar da conta visíveis; logout retorna ao visitante; cache isolado por UID; restauro entre sessões; retry após perda de resposta; conflito sem sobrescrita silenciosa; Rules negam acesso de terceiros. UI distingue cache local, sincronizando, salvo na conta, pendente e conflito. Testes de memória não equivalem a confirmação de escrita no projeto real.

## Verificação desta entrega

- Compilação Angular AOT com templates estritos: passou.
- Compilação TypeScript do backend e dos testes: passou.
- 87 testes passaram, zero falhas/skips: os 67 anteriores e 20 de perfil, protocolo e recuperação do save pessoal.
- Build de produção passou: entrada JavaScript 157,02 kB gzip; Firebase e Firestore separados em chunks carregados depois do mapa.
- O teste real de emulador foi ampliado para verificar privacidade do save, revisão, limite de tamanho, timestamps e rejeição de alterações em inventário. Não executou neste ambiente por bloqueio de portas já constatado.
- Login real foi relatado pelo usuário. Aparência do perfil, logout e escrita/restauração no Firestore precisam de confirmação no navegador; o ambiente não permite essa homologação. Nenhuma publicação de Rules foi confirmada nesta execução.

Se a UI exibir permission-denied, a conta está conectada, mas o save não foi confirmado. Conferir e publicar firestore.rules no projeto existente, preservando outras políticas necessárias. O aplicativo não anuncia sucesso nem apaga o cache nesse caso. Trocas e inventário autoritativo continuam dependendo das funções da Sprint 2; o save pessoal já usa o SDK Firestore diretamente.
