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
 * Network/RPC connection error (retryable)
 */
export class NetworkError extends AppError {
  constructor(message: string, public endpoint?: string) {
    super(message, 503, 'NETWORK_ERROR');
  }
}

/**
 * Blockchain transaction error
 */
export class BlockchainError extends AppError {
  constructor(message: string, public txHash?: string) {
    super(message, 500, 'BLOCKCHAIN_ERROR');
  }
}

/**
 * Configuration error (critical)
 */
export class ConfigurationError extends AppError {
  constructor(message: string, public configKey?: string) {
    super(message, 500, 'CONFIGURATION_ERROR');
  }
}

/**
 * Insufficient balance error
 */
export class InsufficientBalanceError extends AppError {
  constructor(
    required: number,
    available: number,
    public currency: string = 'SOL'
  ) {
    super(
      `Insufficient ${currency} balance. Required: ${required}, Available: ${available}`,
      400,
      'INSUFFICIENT_BALANCE'
    );
  }
}

/**
 * Slippage exceeded error
 */
export class SlippageExceededError extends AppError {
  constructor(
    expected: number,
    actual: number,
    public tolerance: number
  ) {
    super(
      `Slippage exceeded tolerance. Expected: ${expected}, Actual: ${actual}, Tolerance: ${tolerance * 100}%`,
      400,
      'SLIPPAGE_EXCEEDED'
    );
  }
}

/**
 * Pool not found error
 */
export class PoolNotFoundError extends AppError {
  constructor(public pair: string, public dex: string) {
    super(`Pool not found for ${pair} on ${dex}`, 404, 'POOL_NOT_FOUND');
  }
}

/**
 * Transaction timeout error (retryable)
 */
export class TransactionTimeoutError extends AppError {
  constructor(public txHash: string, public timeout: number) {
    super(
      `Transaction timeout after ${timeout}ms: ${txHash}`,
      504,
      'TRANSACTION_TIMEOUT'
    );
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

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Specific retryable error types
  if (
    error instanceof NetworkError ||
    error instanceof TransactionTimeoutError ||
    error instanceof DatabaseError
  ) {
    return true;
  }

  // Pattern-based detection for unknown errors
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /rate limit/i,
    /too many requests/i,
    /503/i,
    /504/i,
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof ValidationError) {
    return `Invalid input: ${error.message}`;
  }
  if (error instanceof InsufficientBalanceError) {
    return 'Insufficient balance for this transaction';
  }
  if (error instanceof SlippageExceededError) {
    return 'Price moved too much during execution. Please try again.';
  }
  if (error instanceof PoolNotFoundError) {
    return 'This trading pair is not available right now';
  }
  if (error instanceof NetworkError) {
    return 'Network connection issue. Please try again.';
  }
  if (error instanceof ConfigurationError) {
    return 'System configuration error. Please contact support.';
  }
  if (error instanceof TransactionTimeoutError) {
    return 'Transaction is taking longer than expected. Please check status.';
  }

  // Generic message for unknown errors
  return 'An unexpected error occurred. Please try again later.';
}

/**
 * Log error with context
 */
export function logError(error: Error, context?: string): void {
  const prefix = context ? `[${context}]` : '';
  const timestamp = new Date().toISOString();

  if (isAppError(error)) {
    console.error(`${timestamp} ${prefix} ${error.name} [${error.code}]:`, error.message);
  } else {
    console.error(`${timestamp} ${prefix} Error:`, error.message);
  }

  // Log stack trace for non-validation errors
  if (!(error instanceof ValidationError)) {
    console.error('Stack:', error.stack);
  }
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error as Error, context);
    throw error;
  }
}

/**
 * Safe execution wrapper with fallback
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error as Error, context);
    return fallback;
  }
}
