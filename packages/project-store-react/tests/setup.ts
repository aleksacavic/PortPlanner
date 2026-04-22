import '@testing-library/jest-dom/vitest';
import { resetProjectStoreForTests } from '@portplanner/project-store';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  resetProjectStoreForTests();
});
