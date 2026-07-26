import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../../domain/identity/role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

/**
 * Extracts the authenticated principal from the request.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
