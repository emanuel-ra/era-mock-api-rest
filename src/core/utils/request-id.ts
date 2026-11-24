import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Ids taken from the client: letters, digits and `._:-`, up to 128 chars. */
const VALID_REQUEST_ID = /^[\w.:-]{1,128}$/;

type RequestWithId = Request & { requestId?: string };

/**
 * Returns the request id: the one already assigned to this request, the
 * client's `x-request-id` header when it is valid, or a new uuid v4.
 * The result is stored on the request so every caller sees the same id.
 */
export function resolveRequestId(req: Request): string {
  const withId = req as RequestWithId;
  if (withId.requestId) return withId.requestId;

  const raw = req.headers?.[REQUEST_ID_HEADER];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  withId.requestId = value && VALID_REQUEST_ID.test(value) ? value : uuidv4();
  return withId.requestId;
}

/**
 * Assigns the request id before anything else runs and echoes it in the
 * `x-request-id` response header, on successful and error responses alike.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader(REQUEST_ID_HEADER, resolveRequestId(req));
  next();
}
