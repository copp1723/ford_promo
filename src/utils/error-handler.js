/**
 * Error Handler Utility
 * Standardizes error handling across the PromoPilot application
 */

export const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  CONFIGURATION: 'CONFIGURATION_ERROR',
  API: 'API_ERROR',
  FILE_SYSTEM: 'FILE_SYSTEM_ERROR',
  NETWORK: 'NETWORK_ERROR',
  PROCESSING: 'PROCESSING_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, severity = ErrorSeverity.MEDIUM, details = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export function formatError(error, userFriendly = true) {
  if (error instanceof AppError) {
    if (userFriendly) {
      return getUserFriendlyMessage(error);
    }
    return error.toJSON();
  }

  // Handle unknown errors
  const appError = new AppError(
    error.message || 'An unexpected error occurred',
    ErrorTypes.UNKNOWN,
    ErrorSeverity.HIGH,
    { originalError: error.toString() }
  );

  return userFriendly ? getUserFriendlyMessage(appError) : appError.toJSON();
}

function getUserFriendlyMessage(error) {
  const messages = {
    [ErrorTypes.VALIDATION]: {
      prefix: 'Invalid input',
      suggestion: 'Please check your data and try again.'
    },
    [ErrorTypes.CONFIGURATION]: {
      prefix: 'Configuration issue',
      suggestion: 'Please verify your settings and environment variables.'
    },
    [ErrorTypes.API]: {
      prefix: 'External service error',
      suggestion: 'The service is temporarily unavailable. Please try again later.'
    },
    [ErrorTypes.FILE_SYSTEM]: {
      prefix: 'File access error',
      suggestion: 'Please check file permissions and paths.'
    },
    [ErrorTypes.NETWORK]: {
      prefix: 'Network error',
      suggestion: 'Please check your internet connection and try again.'
    },
    [ErrorTypes.PROCESSING]: {
      prefix: 'Processing error',
      suggestion: 'The operation could not be completed. Please try again.'
    },
    [ErrorTypes.UNKNOWN]: {
      prefix: 'Unexpected error',
      suggestion: 'An unexpected error occurred. Please contact support if this persists.'
    }
  };

  const errorInfo = messages[error.type] || messages[ErrorTypes.UNKNOWN];
  
  return {
    error: `${errorInfo.prefix}: ${error.message}`,
    suggestion: errorInfo.suggestion,
    errorCode: error.type,
    timestamp: error.timestamp
  };
}

export function handleError(error, context = '') {
  const formattedError = formatError(error, false);
  
  // Log error with context
  console.error(`[${context}] Error occurred:`, {
    ...formattedError,
    stack: error.stack
  });

  // Return user-friendly error
  return formatError(error, true);
}

export function wrapAsync(fn, context = '') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, context);
    }
  };
}