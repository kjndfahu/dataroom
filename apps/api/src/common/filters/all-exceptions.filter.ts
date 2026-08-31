import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

export interface ErrorBody {
  statusCode: number;
  /** Stable machine-readable code the frontend can branch on. */
  code: string;
  /** Message safe to display to the end user. */
  message: string;
  /** Field-level validation problems, when applicable. */
  details?: unknown;
}

/**
 * Turns every thrown error into a predictable JSON body.
 * Internal errors are logged in full but never leak stack traces to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toErrorBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    };
  }

  private fromHttpException(exception: HttpException): ErrorBody {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { statusCode, code: codeFor(statusCode), message: payload };
    }

    const record = payload as Record<string, unknown>;
    const rawMessage = record['message'];

    // ValidationPipe hands us an array of messages; keep them as details.
    if (Array.isArray(rawMessage)) {
      return {
        statusCode,
        code: 'VALIDATION_FAILED',
        message: 'Some of the submitted values are invalid.',
        details: rawMessage,
      };
    }

    return {
      statusCode,
      code:
        typeof record['code'] === 'string'
          ? record['code']
          : codeFor(statusCode),
      message:
        typeof rawMessage === 'string' ? rawMessage : exception.message,
      details: record['details'],
    };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): ErrorBody {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'ALREADY_EXISTS',
          message: 'An item with that name already exists here.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The requested item no longer exists.',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'INVALID_REFERENCE',
          message: 'The referenced item does not exist.',
        };
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}`);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        };
    }
  }
}

function codeFor(statusCode: number): string {
  const codes: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  };

  return codes[statusCode] ?? 'ERROR';
}
