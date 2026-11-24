import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenExpiredError } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    // passport-jwt reports why a token was rejected in `info`. Only expiry gets
    // its own message, so clients know when a refresh is worth trying.
    if (!err && !user && info instanceof TokenExpiredError) {
      throw new UnauthorizedException('Token expired');
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
