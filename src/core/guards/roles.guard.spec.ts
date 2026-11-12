import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

// A fake controller: the guard reads the @Roles metadata from the real decorators.
@Roles(Role.Admin, Role.User)
class FakeController {
  @Roles(Role.Admin)
  adminOnly() {}

  inheritsClassRoles() {}
}

class OpenController {
  open() {}
}

function contextFor(
  controller: new () => object,
  handler: (...args: unknown[]) => unknown,
  user?: { role: Role },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows any request when no roles are required', () => {
    const ctx = contextFor(OpenController, OpenController.prototype.open);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a user whose role is listed on the handler', () => {
    const ctx = contextFor(FakeController, FakeController.prototype.adminOnly, { role: Role.Admin });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a user whose role is not listed on the handler', () => {
    const ctx = contextFor(FakeController, FakeController.prototype.adminOnly, { role: Role.User });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('falls back to the roles declared on the controller class', () => {
    const handler = FakeController.prototype.inheritsClassRoles;

    expect(guard.canActivate(contextFor(FakeController, handler, { role: Role.User }))).toBe(true);
    expect(guard.canActivate(contextFor(FakeController, handler, { role: Role.Viewer }))).toBe(false);
  });

  it('rejects a request without an authenticated user', () => {
    const ctx = contextFor(FakeController, FakeController.prototype.adminOnly);

    expect(guard.canActivate(ctx)).toBe(false);
  });
});
