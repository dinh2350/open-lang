import { beforeAll, beforeEach } from 'vitest';
import { createWorkerDatabase, truncateTables } from './test-database.js';

// Every test starts with empty tables in its worker's own database.
beforeAll(createWorkerDatabase);
beforeEach(truncateTables);
