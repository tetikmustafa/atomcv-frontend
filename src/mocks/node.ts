import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Used by Vitest. Same handlers as the browser worker, by design. */
export const server = setupServer(...handlers);
