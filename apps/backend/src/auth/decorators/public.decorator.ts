import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = Symbol('PublicRoute');

/** Lets people who aren't signed in call this route or controller. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
