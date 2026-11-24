import { BadRequestException, CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, of } from 'rxjs';
import {
  MockBehaviorInterceptor,
  MockBehaviorOptions,
  mockBehaviorOptionsFromConfig,
} from './mock-behavior.interceptor';

function contextFor(
  headers: Record<string, string> = {},
  method = 'GET',
  path = '/customers',
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ headers, method, path, url: path }),
    }),
  } as unknown as ExecutionContext;
}

function handler(): CallHandler & { handle: jest.Mock } {
  return { handle: jest.fn(() => of('ok')) };
}

function interceptor(options: Partial<MockBehaviorOptions> = {}): MockBehaviorInterceptor {
  return new MockBehaviorInterceptor({
    baseDelayMs: 0,
    errorRate: 0,
    ...options,
  });
}

/** Subscribes and records the outcome, so the test can advance fake timers in between. */
function run(i: MockBehaviorInterceptor, ctx: ExecutionContext, next: CallHandler) {
  const result: { value?: unknown; error?: unknown; done: boolean } = {
    done: false,
  };
  i.intercept(ctx, next).subscribe({
    next: (value) => (result.value = value),
    error: (error) => {
      result.error = error;
      result.done = true;
    },
    complete: () => (result.done = true),
  });
  return result;
}

describe('MockBehaviorInterceptor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('passes the request through when nothing is configured', async () => {
    const next = handler();
    await expect(lastValueFrom(interceptor().intercept(contextFor(), next))).resolves.toBe('ok');
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('waits for the x-mock-delay header before calling the handler', () => {
    const next = handler();
    const result = run(interceptor(), contextFor({ 'x-mock-delay': '500' }), next);

    jest.advanceTimersByTime(499);
    expect(next.handle).not.toHaveBeenCalled();
    expect(result.done).toBe(false);

    jest.advanceTimersByTime(1);
    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: 'ok', done: true });
  });

  it('applies the base delay when there is no header', () => {
    const next = handler();
    run(interceptor({ baseDelayMs: 300 }), contextFor(), next);

    jest.advanceTimersByTime(299);
    expect(next.handle).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('lets the header override the base delay', () => {
    const next = handler();
    run(interceptor({ baseDelayMs: 5000 }), contextFor({ 'x-mock-delay': '0' }), next);

    jest.advanceTimersByTime(0);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it.each(['abc', '-1', '1.5', '', '10001'])('rejects x-mock-delay "%s" with 400', (value) => {
    const next = handler();
    expect(() => interceptor().intercept(contextFor({ 'x-mock-delay': value }), next)).toThrow(
      BadRequestException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('accepts the maximum delay of 10000 ms', () => {
    const next = handler();
    run(interceptor(), contextFor({ 'x-mock-delay': '10000' }), next);
    jest.advanceTimersByTime(10000);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('responds the x-mock-status code without calling the handler', () => {
    const next = handler();
    const result = run(interceptor(), contextFor({ 'x-mock-status': '503' }), next);
    jest.advanceTimersByTime(0);

    expect(next.handle).not.toHaveBeenCalled();
    const error = result.error as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Simulated error (x-mock-status)',
    });
  });

  it('delays before responding the forced status', () => {
    const next = handler();
    const result = run(
      interceptor(),
      contextFor({ 'x-mock-status': '404', 'x-mock-delay': '200' }),
      next,
    );

    jest.advanceTimersByTime(199);
    expect(result.done).toBe(false);
    jest.advanceTimersByTime(1);
    expect((result.error as HttpException).getStatus()).toBe(404);
  });

  it.each(['200', '302', '600', '4xx', '99', ''])(
    'rejects x-mock-status "%s" with 400',
    (value) => {
      expect(() =>
        interceptor().intercept(contextFor({ 'x-mock-status': value }), handler()),
      ).toThrow(BadRequestException);
    },
  );

  it('responds 500 at random according to the error rate', () => {
    const next = handler();
    const result = run(interceptor({ errorRate: 0.5, random: () => 0.49 }), contextFor(), next);
    jest.advanceTimersByTime(0);

    expect(next.handle).not.toHaveBeenCalled();
    expect((result.error as HttpException).getStatus()).toBe(500);
  });

  it('does not fail when the random value is above the error rate', () => {
    const next = handler();
    const result = run(interceptor({ errorRate: 0.5, random: () => 0.5 }), contextFor(), next);
    jest.advanceTimersByTime(0);

    expect(result).toEqual({ value: 'ok', done: true });
  });

  it.each([
    ['GET', '/seed/status'],
    ['GET', '/api/docs'],
    ['GET', '/api/docs-json'],
  ])('exempts %s %s from the random errors and the base delay', (method, path) => {
    const next = handler();
    const result = run(
      interceptor({ errorRate: 1, baseDelayMs: 5000, random: () => 0 }),
      contextFor({}, method, path),
      next,
    );
    jest.advanceTimersByTime(0);

    expect(result).toEqual({ value: 'ok', done: true });
  });

  it('still applies the headers to exempt routes', () => {
    const result = run(
      interceptor(),
      contextFor({ 'x-mock-status': '500' }, 'GET', '/seed/status'),
      handler(),
    );
    jest.advanceTimersByTime(0);

    expect((result.error as HttpException).getStatus()).toBe(500);
  });

  it('does not exempt POST /seed/reset', () => {
    const result = run(
      interceptor({ errorRate: 1, random: () => 0 }),
      contextFor({}, 'POST', '/seed/reset'),
      handler(),
    );
    jest.advanceTimersByTime(0);

    expect((result.error as HttpException).getStatus()).toBe(500);
  });
});

describe('mockBehaviorOptionsFromConfig', () => {
  const configWith = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('defaults to no delay and no errors', () => {
    expect(mockBehaviorOptionsFromConfig(configWith({}))).toEqual({
      baseDelayMs: 0,
      errorRate: 0,
    });
  });

  it('reads MOCK_DELAY_MS and MOCK_ERROR_RATE', () => {
    expect(
      mockBehaviorOptionsFromConfig(configWith({ MOCK_DELAY_MS: '250', MOCK_ERROR_RATE: '0.1' })),
    ).toEqual({ baseDelayMs: 250, errorRate: 0.1 });
  });

  it.each(['-1', 'abc', '1.5', '10001'])('rejects MOCK_DELAY_MS=%s', (value) => {
    expect(() => mockBehaviorOptionsFromConfig(configWith({ MOCK_DELAY_MS: value }))).toThrow(
      /MOCK_DELAY_MS/,
    );
  });

  it.each(['-0.1', '1.1', 'abc'])('rejects MOCK_ERROR_RATE=%s', (value) => {
    expect(() => mockBehaviorOptionsFromConfig(configWith({ MOCK_ERROR_RATE: value }))).toThrow(
      /MOCK_ERROR_RATE/,
    );
  });
});
