import { describe, expect, it } from 'vitest';
import { LayerId, LOCAL_USER_ID, newGridId, newLayerId, newObjectId, newOperationId, newPrimitiveId, newProjectId } from '../src/ids';
import {
  CoordinateSystemSchema,
  GridSchema,
  LayerSchema,
  OperationSchema,
  OwnershipStateSchema,
  PrimitiveSchema,
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
    schemaVersion: '1.1.0' as const,
    name: 'Test Port',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: {},
    grids: {},
    scenarioId: null,
  });

  it('accepts a valid minimal project at v1.1.0', () => {
    expect(() => ProjectSchema.parse(validProject())).not.toThrow();
  });

  it('rejects missing name', () => {
    const { name: _omitted, ...p } = validProject();
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('rejects schema version mismatch — 1.0.0 payload', () => {
    const p = { ...validProject(), schemaVersion: '1.0.0' };
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('rejects schema version mismatch — 2.0.0 payload', () => {
    const p = { ...validProject(), schemaVersion: '2.0.0' };
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('strips unknown fields at root (default Zod behaviour)', () => {
    const p = { ...validProject(), bogus: 'ignored' };
    const parsed = ProjectSchema.parse(p) as Record<string, unknown>;
    expect(parsed.bogus).toBeUndefined();
  });

  it('rejects missing primitives map', () => {
    const { primitives: _omitted, ...p } = validProject();
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('rejects missing layers map', () => {
    const { layers: _omitted, ...p } = validProject();
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it('rejects missing grids map', () => {
    const { grids: _omitted, ...p } = validProject();
    expect(() => ProjectSchema.parse(p)).toThrow();
  });
});

describe('OperationSchema', () => {
  it('accepts a valid CREATE operation with before=null', () => {
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 1,
      timestamp: '2026-04-25T10:00:00.000Z',
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

describe('LayerSchema', () => {
  it('accepts a valid layer', () => {
    const layer = {
      id: newLayerId(),
      name: '0',
      color: '#FFFFFF',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    };
    expect(LayerSchema.parse(layer)).toBeTruthy();
  });

  it('rejects unknown line type', () => {
    const layer = {
      id: newLayerId(),
      name: '0',
      color: '#FFFFFF',
      lineType: 'wavy',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    };
    expect(() => LayerSchema.parse(layer)).toThrow();
  });

  it('rejects empty name', () => {
    const layer = {
      id: newLayerId(),
      name: '',
      color: '#FFFFFF',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    };
    expect(() => LayerSchema.parse(layer)).toThrow();
  });
});

describe('GridSchema', () => {
  it('accepts a valid grid', () => {
    const grid = {
      id: newGridId(),
      origin: { x: 0, y: 0 },
      angle: 0,
      spacingX: 6.058,
      spacingY: 2.6,
      layerId: LayerId.DEFAULT,
      visible: true,
      activeForSnap: true,
    };
    expect(GridSchema.parse(grid)).toBeTruthy();
  });
});

describe('PrimitiveSchema (point/line/rectangle/circle/arc/xline)', () => {
  const base = () => ({
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
  });

  it('accepts a point', () => {
    expect(() =>
      PrimitiveSchema.parse({ ...base(), kind: 'point', position: { x: 0, y: 0 } }),
    ).not.toThrow();
  });

  it('accepts a line', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        kind: 'line',
        p1: { x: 0, y: 0 },
        p2: { x: 10, y: 0 },
      }),
    ).not.toThrow();
  });

  it('accepts a rectangle', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        kind: 'rectangle',
        origin: { x: 0, y: 0 },
        width: 5,
        height: 3,
        localAxisAngle: 0,
      }),
    ).not.toThrow();
  });

  it('accepts a circle', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        kind: 'circle',
        center: { x: 0, y: 0 },
        radius: 5,
      }),
    ).not.toThrow();
  });

  it('accepts an arc', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        kind: 'arc',
        center: { x: 0, y: 0 },
        radius: 5,
        startAngle: 0,
        endAngle: Math.PI / 2,
      }),
    ).not.toThrow();
  });

  it('accepts an xline', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        kind: 'xline',
        pivot: { x: 0, y: 0 },
        angle: 0,
      }),
    ).not.toThrow();
  });

  it('preserves displayOverrides keys (color, lineType, lineWeight)', () => {
    const parsed = PrimitiveSchema.parse({
      ...base(),
      displayOverrides: { color: '#FF0000', lineType: 'dashed', lineWeight: 0.5 },
      kind: 'point',
      position: { x: 0, y: 0 },
    });
    expect((parsed as { displayOverrides: { color?: string } }).displayOverrides.color).toBe(
      '#FF0000',
    );
  });
});

describe('PrimitiveSchema polyline invariants', () => {
  const base = () => ({
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    kind: 'polyline' as const,
  });

  it('accepts open polyline with N vertices and N-1 bulges', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 5 },
        ],
        bulges: [0, 0],
        closed: false,
      }),
    ).not.toThrow();
  });

  it('accepts closed polyline with N vertices and N bulges', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
        bulges: [0, 0, 0],
        closed: true,
      }),
    ).not.toThrow();
  });

  it('rejects closed polyline with vertices.length < 3', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        bulges: [0, 0],
        closed: true,
      }),
    ).toThrow();
  });

  it('rejects bulge length mismatch — open with N bulges', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 5 },
        ],
        bulges: [0, 0, 0],
        closed: false,
      }),
    ).toThrow();
  });

  it('rejects bulge length mismatch — closed with N-1 bulges', () => {
    expect(() =>
      PrimitiveSchema.parse({
        ...base(),
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
        bulges: [0, 0],
        closed: true,
      }),
    ).toThrow();
  });
});
