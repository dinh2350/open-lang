/** The global prefix every route sits under. */
export const API_PREFIX = 'api';

/** The path of AuthController, under the global prefix. */
export const AUTH_PATH = 'auth';

/** The auth routes as the browser sees them: the global prefix, then AuthController's path. */
export const AUTH_ROUTES = `/${API_PREFIX}/${AUTH_PATH}`;
