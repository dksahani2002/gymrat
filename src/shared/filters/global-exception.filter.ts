import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseError } from '../errors/base.error';
import { ErrorCodes } from '../errors/error-codes';

interface ErrorBody {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId?: string;
    timestamp: string;
  };
}

/**
 * Maps domain and HTTP exceptions to the standard API error envelope.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const { status, body } = this.toErrorResponse(exception, request.requestId);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status} ${body.error.code}`);
    }

    response.status(status).json(body);
  }

  private toErrorResponse(
    exception: unknown,
    requestId?: string,
  ): { status: number; body: ErrorBody } {
    const meta = {
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof BaseError) {
      return {
        status: exception.httpStatus,
        body: {
          success: false,
          data: null,
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          },
          meta,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as { message?: string | string[] }).message ??
            exception.message);
      const details = Array.isArray(message) ? message : undefined;
      const normalizedMessage = Array.isArray(message)
        ? 'Validation failed'
        : String(message);

      return {
        status,
        body: {
          success: false,
          data: null,
          error: {
            code:
              status === HttpStatus.TOO_MANY_REQUESTS
                ? ErrorCodes.RATE_LIMITED
                : status === HttpStatus.UNAUTHORIZED
                  ? ErrorCodes.AUTHENTICATION_ERROR
                  : status === HttpStatus.FORBIDDEN
                    ? ErrorCodes.AUTHORIZATION_ERROR
                    : status === HttpStatus.BAD_REQUEST
                      ? ErrorCodes.VALIDATION_ERROR
                      : ErrorCodes.INTERNAL_ERROR,
            message: normalizedMessage,
            details,
          },
          meta,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
        meta,
      },
    };
  }
}
