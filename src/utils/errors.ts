/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error - 400
 */
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * Not found error - 404
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

/**
 * Order processing error
 */
export class OrderProcessingError extends AppError {
  constructor(message: string, public orderId?: string) {
    super(message, 500, 'ORDER_PROCESSING_ERROR');
  }
}

/**
 * DEX execution error
 */
export class DexExecutionError extends AppError {
  constructor(
    message: string,
    public dex?: string,
    public orderId?: string
  ) {
    super(message, 500, 'DEX_EXECUTION_ERROR');
  }
}

/**
 * Database connection error
 */
export class DatabaseError extends AppError {
  constructor(message: string, public operation?: string) {
    super(message, 500, 'DATABASE_ERROR');
  }
}

/**
 * Queue error
 */
export class QueueError extends AppError {
  constructor(message: string, public operation?: string) {
    super(message, 500, 'QUEUE_ERROR');
  }
}

/**
 * WebSocket error
 */
export class WebSocketError extends AppError {
  constructor(message: string, public clientId?: string) {
    super(message, 500, 'WEBSOCKET_ERROR');
  }
}

/**
 * Check if error is a known application error
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown) {
  if (isAppError(error)) {
    return {
      error: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  return {
    error: 'Internal Server Error',
    message: getErrorMessage(error),
    statusCode: 500,
  };
}
