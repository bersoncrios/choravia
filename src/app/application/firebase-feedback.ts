export type FirebasePhase = "authentication" | "online";
export interface FirebaseFeedback {
  phase: FirebasePhase;
  code: string;
  message: string;
}

/** Preserve the stage that actually failed; a backend error is not a failed Google login. */
export function firebaseFeedback(
  error: unknown,
  phase: FirebasePhase,
): FirebaseFeedback {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  const messages: Record<string, string> = {
    "auth/operation-not-allowed":
      "Use Entrar com Google para conectar sua conta. O modo local continua disponível.",
    "auth/popup-blocked":
      "O navegador bloqueou a janela de login. Libere a janela e tente novamente.",
    "auth/popup-closed-by-user":
      "O login não foi concluído pelo popup. A janela foi fechada ou perdeu a comunicação com o aplicativo.",
    "auth/cancelled-popup-request":
      "Uma nova tentativa substituiu o popup anterior. Use apenas uma janela de login por vez.",
    "auth/unauthorized-domain":
      "O domínio desta página não está autorizado no Firebase Authentication. Autorize localhost para este ambiente local.",
    "auth/web-storage-unsupported":
      "O navegador não disponibilizou o armazenamento necessário ao login.",
    "auth/network-request-failed":
      "A autenticação não conseguiu acessar o Firebase. Verifique a requisição bloqueada na aba Network.",
    "permission-denied":
      "O Firestore recusou o acesso. Confira se as regras atualizadas do jogo foram publicadas e se o App Check não está sendo exigido no Console Firebase.",
    "unavailable":
      "O Firestore está indisponível. Verifique sua conexão e tente sincronizar novamente.",
    "functions/not-found":
      "Os serviços online do jogo ainda não estão disponíveis neste projeto.",
    "functions/unauthenticated":
      "O serviço online recusou a sessão. Reconecte antes de continuar.",
  };
  const detail =
    messages[code] ??
    (error instanceof Error
      ? error.message
      : "Não foi possível concluir esta etapa.");
  return { phase, code, message: code ? `${detail} Código: ${code}.` : detail };
}
