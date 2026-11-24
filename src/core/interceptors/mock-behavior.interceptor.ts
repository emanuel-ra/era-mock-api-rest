import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { STATUS_CODES } from 'http';
import { Observable, mergeMap, of, timer } from 'rxjs';

export const MOCK_DELAY_HEADER = 'x-mock-delay';
export const MOCK_STATUS_HEADER = 'x-mock-status';
export const MAX_MOCK_DELAY_MS = 10_000;

export interface MockBehaviorOptions {
  /** Delay applied to every request without an `x-mock-delay` header. */
  baseDelayMs: number;
  /** Probability (0–1) of answering 500 at random. */
  errorRate: number;
  /** Source of randomness, injectable for tests. */
  random?: () => number;
}

/**
 * Requests that keep working while MOCK_DELAY_MS / MOCK_ERROR_RATE are set:
 * the Docker healthcheck calls GET /seed/status with a 3s timeout.
 * The headers still apply to them.
 */
function isExempt(req: Request): boolean {
  const path = req.path ?? req.url ?? '';
  return (req.method === 'GET' && path === '/seed/status') || path.startsWith('/api/docs');
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseDelayHeader(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!/^\d+$/.test(value) || Number(value) > MAX_MOCK_DELAY_MS) {
    throw new BadRequestException(
      `${MOCK_DELAY_HEADER} must be an integer between 0 and ${MAX_MOCK_DELAY_MS}`,
    );
  }
  return Number(value);
}

function parseStatusHeader(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!/^\d{3}$/.test(value) || Number(value) < 400 || Number(value) > 599) {
    throw new BadRequestException(`${MOCK_STATUS_HEADER} must be a 4xx or 5xx status code`);
  }
  return Number(value);
}

function simulatedError(status: number): HttpException {
  const error = STATUS_CODES[status] ?? 'Error';
  return new HttpException(
    HttpException.createBody(`Simulated error (${MOCK_STATUS_HEADER})`, error, status),
    status,
  );
}

/**
 * Simulates latency and errors so a frontend can test its loading and error
 * states. It runs after guards and before pipes and the handler, so a forced
 * or random error never executes the handler.
 */
@Injectable()
export class MockBehaviorInterceptor implements NestInterceptor {
  private readonly random: () => number;

  constructor(private readonly options: MockBehaviorOptions) {
    this.random = options.random ?? Math.random;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    // Invalid headers fail right away, without delay.
    const headerDelay = parseDelayHeader(headerValue(req, MOCK_DELAY_HEADER));
    const forcedStatus = parseStatusHeader(headerValue(req, MOCK_STATUS_HEADER));
    const exempt = isExempt(req);

    const delay = headerDelay ?? (exempt ? 0 : this.options.baseDelayMs);

    // Without a delay, skip the timer so normal requests stay synchronous.
    const wait$ = delay > 0 ? timer(delay) : of(0);

    return wait$.pipe(
      mergeMap(() => {
        if (forcedStatus !== undefined) throw simulatedError(forcedStatus);
        if (!exempt && this.options.errorRate > 0 && this.random() < this.options.errorRate) {
          throw new InternalServerErrorException('Simulated random error (MOCK_ERROR_RATE)');
        }
        return next.handle();
      }),
    );
  }
}

/** Reads MOCK_DELAY_MS and MOCK_ERROR_RATE; both are optional and default to 0. */
export function mockBehaviorOptionsFromConfig(config: ConfigService): MockBehaviorOptions {
  const rawDelay = String(config.get('MOCK_DELAY_MS') ?? '').trim();
  const rawRate = String(config.get('MOCK_ERROR_RATE') ?? '').trim();

  const baseDelayMs = rawDelay === '' ? 0 : Number(rawDelay);
  if (!Number.isInteger(baseDelayMs) || baseDelayMs < 0 || baseDelayMs > MAX_MOCK_DELAY_MS) {
    throw new Error(`MOCK_DELAY_MS must be an integer between 0 and ${MAX_MOCK_DELAY_MS}`);
  }

  const errorRate = rawRate === '' ? 0 : Number(rawRate);
  if (!Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1) {
    throw new Error('MOCK_ERROR_RATE must be a number between 0 and 1');
  }

  return { baseDelayMs, errorRate };
}
