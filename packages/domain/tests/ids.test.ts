import { describe, expect, it } from 'vitest';
import { LOCAL_USER_ID, isUUIDv7, newObjectId, newOperationId, newProjectId } from '../src/ids';

describe('UUIDv7 generators', () => {
  it('newProjectId returns a well-formed UUIDv7', () => {
    const id = newProjectId();
    expect(isUUIDv7(id)).toBe(true);
  });

  it('newObjectId returns a well-formed UUIDv7', () => {
    const id = newObjectId();
    expect(isUUIDv7(id)).toBe(true);
  });

  it('newOperationId returns a well-formed UUIDv7', () => {
    const id = newOperationId();
    expect(isUUIDv7(id)).toBe(true);
  });

  it('UUIDv7 IDs sort lexicographically by creation time', async () => {
    const id1 = newProjectId();
    // Millisecond-level resolution in UUIDv7 means two IDs in the
    // same ms may not sort correctly; a short wait guarantees order.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = newProjectId();
    expect(id1 < id2).toBe(true);
  });

  it('LOCAL_USER_ID is the documented placeholder UUID', () => {
    expect(LOCAL_USER_ID).toBe('00000000-0000-0000-0000-000000000000');
  });
});
