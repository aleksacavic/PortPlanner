import { afterEach } from 'vitest';
import { resetProjectStoreForTests } from '../src/test-utils';

afterEach(() => {
  resetProjectStoreForTests();
});
