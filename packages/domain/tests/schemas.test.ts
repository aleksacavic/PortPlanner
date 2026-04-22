import { describe, expect, it } from 'vitest';
import { LOCAL_USER_ID, newObjectId, newOperationId, newProjectId } from '../src/ids';
import {
  CoordinateSystemSchema,
  OperationSchema,
  OwnershipStateSchema,
  ProjectObjectSchema,
  ProjectSchema,
} from '../src/schemas';

describe('OwnershipStateSchema', () => {
  it('accepts all four valid states', () => {
    expect(OwnershipStateSchema.parse('AUTHORED')).toBe('AUTHORED');
    expect(OwnershipStateSchema.parse('GENERATED')).toBe('GENERATED');
    expect(OwnershipStateSchema.parse('FROZEN')).toBe('FROZEN');
    expect(OwnershipStateSchema.parse('DETACHED')).toBe('DETACHED');
  });

  it('rejects unknown states', () => {
    expect(() => OwnershipStateSchema.parse('DELETED')).toThrow();
  });
});

describe('CoordinateSystemSchema', () => {
  it('accepts a valid coordinate system', () => {
    const cs = {
      originLat: 24.4539,
      originLng: 54.3773,
      trueNorthRotation: 0,
      utmZone: '40N',
    };
    expect(CoordinateSystemSchema.parse(cs)).toEqual(cs);
  });

  it('rejects missing required fields', () => {
    expect(() => CoordinateSystemSchema.parse({ originLat: 0 })).toThrow();
  });
});

describe('ProjectObjectSchema', () => {
  it('accepts a minimal object', () => {
    const o = {
      id: newObjectId(),
      type: 'RTG_BLOCK',
      geometry: { type: 'Polygon', coordinates: [] },
      parameters: { containers_wide: 6 },
      ownership: 'AUTHORED',
    };
    expect(ProjectObjectSchema.parse(o)).toBeTruthy();
  });

  it('preserves unknown keys in parameters (JSONB passthrough)', () => {
    const o = {
      id: newObjectId(),
      type: 'RTG_BLOCK',
      geometry: null,
      parameters: { future_field: 42 },
      ownership: 'AUTHORED',
    };
    const parsed = ProjectObjectSchema.parse(o);
    expect(parsed.parameters.future_field).toBe(42);
  });
});

describe('ProjectSchema', () => {
  const validProject = () => ({
    id: newProjectId(),
    schemaVersion: '1.0.0' as const,
    name: 'Test Port',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    scenarioId: null,
  });

  it('accepts a valid minimal project', () => {
    expect(() => ProjectSchema.parse(validProject())).not.toThrow();
  });

  it('rejects missing name', () => {
    const { name: _omitted, ...p } = validProject();
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('rejects wrong schemaVersion', () => {
    const p = { ...validProject(), schemaVersion: '2.0.0' };
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('strips unknown fields at root (default Zod behaviour)', () => {
    const p = { ...validProject(), bogus: 'ignored' };
    const parsed = ProjectSchema.parse(p) as Record<string, unknown>;
    expect(parsed.bogus).toBeUndefined();
  });
});

describe('OperationSchema', () => {
  it('accepts a valid CREATE operation with before=null', () => {
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 1,
      timestamp: '2026-04-22T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'CREATE' as const,
      objectId: newObjectId(),
      before: null,
      after: {
        id: newObjectId(),
        type: 'RTG_BLOCK',
        geometry: null,
        parameters: {},
        ownership: 'AUTHORED' as const,
      },
    };
    expect(() => OperationSchema.parse(op)).not.toThrow();
  });
});
