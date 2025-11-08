// ChatKit Errors - TypeScript equivalent of errors.py

// Not a closed enum, new error codes can and will be added as needed
export enum ErrorCode {
  STREAM_ERROR = "stream.error",
}

export const DEFAULT_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.STREAM_ERROR]: 500,
};

export const DEFAULT_ALLOW_RETRY: Record<ErrorCode, boolean> = {
  [ErrorCode.STREAM_ERROR]: true,
};

export abstract class BaseStreamError extends Error {
  allow_retry: boolean;
  
  constructor(message?: string) {
    super(message);
    this.name = this.constructor.name;
    this.allow_retry = false; // Default value, will be overridden by subclasses
  }
}

export class StreamError extends BaseStreamError {
  /**
   * Error with a specific error code that maps to a localized user-facing
   * error message.
   */
  code: ErrorCode;
  status_code: number;

  constructor(
    code: ErrorCode,
    options?: {
      allow_retry?: boolean;
    }
  ) {
    super();
    this.code = code;
    this.status_code = DEFAULT_STATUS[code] || 500;
    this.allow_retry = options?.allow_retry !== undefined 
      ? options.allow_retry 
      : DEFAULT_ALLOW_RETRY[code] || false;
  }
}

export class CustomStreamError extends BaseStreamError {
  /**
   * Error with a custom user-facing error message. The message should be
   * localized as needed before raising the error.
   */
  override message: string;
  /** The user-facing error message to display. */

  constructor(
    message: string,
    options?: {
      allow_retry?: boolean;
    }
  ) {
    super(message);
    this.message = message;
    this.allow_retry = options?.allow_retry !== undefined ? options.allow_retry : false;
  }
}

