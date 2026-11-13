import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { AllExceptionsFilter, ErrorResponseBody } from './all-exceptions.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
}

function setup(headers: Record<string, string> = {}, url = '/customers?page=2') {
  const req = { method: 'GET', url, originalUrl: url, headers };
  const res: MockResponse = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { req, res, host };
}

function run(exception: unknown, headers?: Record<string, string>, url?: string) {
  const { res, host } = setup(headers, url);
  new AllExceptionsFilter().catch(exception, host);
  const body = res.json.mock.calls[0][0] as ErrorResponseBody;
  return { res, body };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('answers the full error format for an HttpException', () => {
    const { res, body } = run(new NotFoundException('Customer not found'), {
      'x-request-id': 'abc-123',
    });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Customer not found',
      path: '/customers?page=2',
      timestamp: expect.any(String),
      requestId: 'abc-123',
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it.each([
    [new UnauthorizedException(), 401, 'Unauthorized', 'Unauthorized'],
    [new ForbiddenException('Forbidden resource'), 403, 'Forbidden', 'Forbidden resource'],
    [new ConflictException('Email already exists'), 409, 'Conflict', 'Email already exists'],
  ])('maps %p to its status, error and message', (exception, status, error, message) => {
    const { res, body } = run(exception);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(body).toMatchObject({ statusCode: status, error, message });
  });

  it('keeps the array of messages of a validation error', () => {
    const messages = ['name must be longer than or equal to 2 characters', 'email must be an email'];
    const { body } = run(new BadRequestException(messages));

    expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request', message: messages });
  });

  it('uses the reason phrase when the exception response is a plain string', () => {
    const { body } = run(new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS));

    expect(body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many requests',
    });
  });

  it('keeps extra fields of the exception body without letting them override the format', () => {
    const missing = [{ productId: 'p1', productName: 'Lamp', requested: 4, available: 1 }];
    const exception = new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message: 'Insufficient stock for: Lamp',
      missing,
      path: '/spoofed',
      requestId: 'spoofed',
    });
    const { body } = run(exception, { 'x-request-id': 'abc-123' });

    expect(body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'Insufficient stock for: Lamp',
      missing,
      path: '/customers?page=2',
      requestId: 'abc-123',
    });
  });

  it('keeps a custom error field', () => {
    const exception = new HttpException(
      HttpException.createBody('Simulated error', 'Custom Error', 503),
      503,
    );
    const { body } = run(exception);

    expect(body).toMatchObject({ statusCode: 503, error: 'Custom Error', message: 'Simulated error' });
  });

  it('turns unknown errors into a 500 without leaking their message', () => {
    const { res, body } = run(new Error('database password is hunter2'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('generates a uuid when there is no x-request-id header', () => {
    const { res, body } = run(new NotFoundException());

    expect(isUuid(body.requestId)).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', body.requestId);
  });

  it('echoes the client request id in the response header', () => {
    const { res } = run(new NotFoundException(), { 'x-request-id': 'trace-42' });

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'trace-42');
  });

  it('generates a uuid when the x-request-id header is not valid', () => {
    const { body } = run(new NotFoundException(), { 'x-request-id': 'bad id with spaces' });

    expect(isUuid(body.requestId)).toBe(true);
  });
});
