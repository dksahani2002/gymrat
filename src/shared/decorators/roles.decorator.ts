import { SetMetadata } from '@nestjs/common';
import { Role } from '../../domain/identity/role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
