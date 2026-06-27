type UserFacingBackendErrorParams = {
  userMessage: string;
  debugMessage?: string | null;
  cause?: unknown;
};

declare const __DEV__: boolean;

export class UserFacingBackendError extends Error {
  readonly userMessage: string;
  readonly debugMessage: string;

  constructor({ userMessage, debugMessage, cause }: UserFacingBackendErrorParams) {
    super(userMessage);
    this.name = 'UserFacingBackendError';
    this.userMessage = userMessage;
    this.debugMessage = debugMessage?.trim() || userMessage;

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function formatBackendErrorForDisplay(error: unknown, fallbackUserMessage: string) {
  const userMessage =
    error instanceof UserFacingBackendError ? error.userMessage : fallbackUserMessage;

  if (isDevRuntime()) {
    const debugMessage = getBackendErrorDebugMessage(error);

    if (debugMessage && debugMessage !== userMessage) {
      return `${userMessage}\n\n開発者向け詳細: ${debugMessage}`;
    }
  }

  return userMessage;
}

export function logBackendError(context: string, error: unknown) {
  if (isDevRuntime()) {
    console.error(`[${context}]`, error);
  }
}

function getBackendErrorDebugMessage(error: unknown) {
  if (error instanceof UserFacingBackendError) {
    return error.debugMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : null;
}

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
