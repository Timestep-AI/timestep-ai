// ChatKit Logger - TypeScript equivalent of logger.py

// Simple logger implementation for Deno/Node.js environments
// In Deno, we can use console.log with structured logging
// For production, you might want to use a proper logging library

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (Deno.env.get("LOG_LEVEL") === "DEBUG") {
      console.debug(`[chatkit] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    const logLevel = Deno.env.get("LOG_LEVEL")?.toUpperCase();
    if (!logLevel || logLevel === "INFO" || logLevel === "DEBUG" || logLevel === "WARNING" || logLevel === "ERROR") {
      console.info(`[chatkit] ${message}`, ...args);
    }
  },
  
  warning: (message: string, ...args: any[]) => {
    const logLevel = Deno.env.get("LOG_LEVEL")?.toUpperCase();
    if (!logLevel || logLevel === "WARNING" || logLevel === "ERROR") {
      console.warn(`[chatkit] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    // Match Python: logger.warning() can also be called as logger.warn()
    logger.warning(message, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    const logLevel = Deno.env.get("LOG_LEVEL")?.toUpperCase();
    if (!logLevel || logLevel === "ERROR") {
      console.error(`[chatkit] ${message}`, ...args);
    }
  },
  
  // Match Python: logger.exception() - logs error with full traceback
  exception: (message: string | Error, ...args: any[]) => {
    // In Python, logger.exception() automatically includes traceback
    // In TypeScript, we'll log with error level and include stack trace if available
    if (message instanceof Error) {
      console.error(`[chatkit] ${message.message}`, message, ...args);
      if (message.stack) {
        console.error(`[chatkit] Stack trace:`, message.stack);
      }
    } else {
      const error = args.find(arg => arg instanceof Error);
      console.error(`[chatkit] ${message}`, ...args);
      if (error && error instanceof Error && error.stack) {
        console.error(`[chatkit] Stack trace:`, error.stack);
      }
    }
  },
};

