import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../core/decorators/roles.decorator';
import { UsersRepository } from '../repositories/users.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'fallback-secret'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    // The token may outlive the user (e.g. after POST /seed/reset), so always
    // check the store and trust its current data over the token's claims.
    const user = this.usersRepository.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return { id: user.id, email: user.email, role: user.role };
  }
}
