import { HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from './error-codes';

/**
 * Base application error with stable machine-readable code.
 */
export abstract class BaseError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly httpStatus: number;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends BaseError {
  readonly code = ErrorCodes.VALIDATION_ERROR;
  readonly httpStatus = HttpStatus.BAD_REQUEST;
}

export class BusinessError extends BaseError {
  readonly code: ErrorCode;
  readonly httpStatus: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.BUSINESS_ERROR,
    httpStatus: number = HttpStatus.UNPROCESSABLE_ENTITY,
    details?: unknown,
  ) {
    super(message, details);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class RepositoryError extends BaseError {
  readonly code = ErrorCodes.REPOSITORY_ERROR;
  readonly httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
}

export class AuthenticationError extends BaseError {
  readonly code: ErrorCode;
  readonly httpStatus = HttpStatus.UNAUTHORIZED;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.AUTHENTICATION_ERROR,
    details?: unknown,
  ) {
    super(message, details);
    this.code = code;
  }
}

export class ConflictError extends BusinessError {
  constructor(message: string, code: ErrorCode = ErrorCodes.CONFLICT, details?: unknown) {
    super(message, code, HttpStatus.CONFLICT, details);
  }
}

export class NotFoundError extends BusinessError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCodes.NOT_FOUND, HttpStatus.NOT_FOUND, details);
  }
}

export class AuthorizationError extends BaseError {
  readonly code = ErrorCodes.AUTHORIZATION_ERROR;
  readonly httpStatus = HttpStatus.FORBIDDEN;
}
