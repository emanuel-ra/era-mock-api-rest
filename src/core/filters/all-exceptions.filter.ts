import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import { REQUEST_ID_HEADER, resolveRequestId } from '../utils/request-id';

/** Body of every error response. */
export interface ErrorResponseBody {
  statusCode: number;
  /** Reason phrase of the status code, e.g. `Not Found`. */
  error: string;
  /** Human readable message; validation errors keep the array of messages. */
  message: string | string[];
  /** Requested URL, including the query string. */
  path: string;
  /** ISO 8601 time of the response. */
  timestamp: string;
  requestId: string;
}

function reasonPhrase(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

/** Reads `error` and `message` from an HttpException's response, whatever its shape. */
function describeHttpException(
  exception: HttpException,
  status: number,
): Pick<ErrorResponseBody, 'error' | 'message'> {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { error: reasonPhrase(status), message: response };
  }

  const body = response as { error?: unknown; message?: unknown };
  const message =
    typeof body.message === 'string' ||
    (Array.isArray(body.message) && body.message.every((m) => typeof m === 'string'))
      ? (body.message as string | string[])
      : exception.message;
  // Nest puts the reason phrase in `error` unless a custom one was given.
  const error = typeof body.error === 'string' ? body.error : reasonPhrase(status);

  return { error, message };
}

/**
 * Catches every exception and answers with the same JSON shape:
 * `{ statusCode, error, message, path, timestamp, requestId }`.
 * Errors that are not HttpExceptions become a 500 without leaking details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = resolveRequestId(req);

    let statusCode: number;
    let details: Pick<ErrorResponseBody, 'error' | 'message'>;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      details = describeHttpException(exception, statusCode);
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      details = { error: reasonPhrase(statusCode), message: 'Internal server error' };
      this.logger.error(
        `Unhandled error on ${req.method} ${req.originalUrl ?? req.url} (requestId ${requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      ...details,
      path: req.originalUrl ?? req.url,
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.status(statusCode).json(body);
  }
}
