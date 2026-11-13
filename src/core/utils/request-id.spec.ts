import type { NextFunction, Request, Response } from 'express';
import { validate as isUuid } from 'uuid';
import { requestIdMiddleware, resolveRequestId } from './request-id';

function request(headers: Record<string, string | string[]> = {}): Request {
  return { headers } as unknown as Request;
}

describe('resolveRequestId', () => {
  it('takes the id from the x-request-id header', () => {
    expect(resolveRequestId(request({ 'x-request-id': 'abc-123' }))).toBe('abc-123');
  });

  it('trims the header and takes the first value when repeated', () => {
    expect(resolveRequestId(request({ 'x-request-id': ['  first  ', 'second'] }))).toBe('first');
  });

  it.each(['', '   ', 'has spaces', 'a'.repeat(129), 'line\nbreak'])(
    'generates a uuid for an invalid header %p',
    (value) => {
      expect(isUuid(resolveRequestId(request({ 'x-request-id': value })))).toBe(true);
    },
  );

  it('generates a uuid without the header', () => {
    expect(isUuid(resolveRequestId(request()))).toBe(true);
  });

  it('returns the same id for the same request', () => {
    const req = request();
    expect(resolveRequestId(req)).toBe(resolveRequestId(req));
  });
});

describe('requestIdMiddleware', () => {
  it('sets the response header and calls next', () => {
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;
    const req = request({ 'x-request-id': 'trace-1' });

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'trace-1');
    expect(next).toHaveBeenCalled();
  });
});
