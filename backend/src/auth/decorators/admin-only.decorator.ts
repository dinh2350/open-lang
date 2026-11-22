import { UseGuards } from '@nestjs/common';
import { RoleGuard } from '../guards/role.guard.js';

/** Restricts a controller or route to Admins. */
export const AdminOnly = () => UseGuards(RoleGuard);
