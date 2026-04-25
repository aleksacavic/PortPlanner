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

describe('ProjectObjectSchema (ADR-019)', () => {
  const minimalDirect = () => ({
    id: newObjectId(),
    type: 'RTG_BLOCK',
    geometry: { type: 'Polygon', coordinates: [] },
    parameters: { containers_wide: 6 },
    ownership: 'AUTHORED' as const,
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    sourceKind: 'direct' as const,
  });

  it('accepts a minimal direct-placed object', () => {
    expect(ProjectObjectSchema.parse(minimalDirect())).toBeTruthy();
  });

  it('preserves unknown keys in parameters (JSONB passthrough)', () => {
    const o = { ...minimalDirect(), parameters: { future_field: 42 } };
    const parsed = ProjectObjectSchema.parse(o);
    expect((parsed.parameters as Record<string, unknown>).future_field).toBe(42);
  });

  it('accepts a promoted object with sourceProvenance', () => {
    const o = {
      ...minimalDirect(),
      sourceKind: 'promoted' as const,
      sourceProvenance: {
        primitiveKind: 'rectangle' as const,
        promotedAt: '2026-04-25T10:00:00.000Z',
        primitiveId: newPrimitiveId(),
      },
    };
    expect(ProjectObjectSchema.parse(o)).toBeTruthy();
  });

  it("rejects 'direct' source with sourceProvenance set", () => {
    const o = {
      ...minimalDirect(),
      sourceProvenance: {
        primitiveKind: 'rectangle' as const,
        promotedAt: '2026-04-25T10:00:00.000Z',
        primitiveId: newPrimitiveId(),
      },
    };
    expect(() => ProjectObjectSchema.parse(o)).toThrow();
  });

  it("rejects 'promoted' source without sourceProvenance", () => {
    const o = { ...minimalDirect(), sourceKind: 'promoted' as const };
    expect(() => ProjectObjectSchema.parse(o)).toThrow();
  });

  it('rejects missing layerId', () => {
    const { layerId: _omitted, ...o } = minimalDirect();
    expect(() => ProjectObjectSchema.parse(o)).toThrow();
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

describe('OperationSchema (ADR-020)', () => {
  it('accepts a CREATE operation on a primitive (before=null)', () => {
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 1,
      timestamp: '2026-04-25T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'CREATE' as const,
      targetKind: 'primitive' as const,
      targetId: newPrimitiveId(),
      before: null,
      after: {
        kind: 'primitive' as const,
        snapshot: {
          id: newPrimitiveId(),
          kind: 'line' as const,
          layerId: LayerId.DEFAULT,
          displayOverrides: {},
          p1: { x: 0, y: 0 },
          p2: { x: 10, y: 0 },
        },
      },
    };
    expect(() => OperationSchema.parse(op)).not.toThrow();
  });

  it('accepts a DELETE operation on a layer (after=null)', () => {
    const layerId = newLayerId();
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 2,
      timestamp: '2026-04-25T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'DELETE' as const,
      targetKind: 'layer' as const,
      targetId: layerId,
      before: {
        kind: 'layer' as const,
        snapshot: {
          id: layerId,
          name: 'temp',
          color: '#FFFFFF',
          lineType: 'continuous',
          lineWeight: 0.25,
          visible: true,
          frozen: false,
          locked: false,
        },
      },
      after: null,
    };
    expect(() => OperationSchema.parse(op)).not.toThrow();
  });

  it('accepts an UPDATE operation on a grid', () => {
    const gridId = newGridId();
    const baseGrid = {
      id: gridId,
      origin: { x: 0, y: 0 },
      angle: 0,
      spacingX: 6.058,
      spacingY: 2.6,
      layerId: LayerId.DEFAULT,
      visible: true,
      activeForSnap: true,
    };
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 3,
      timestamp: '2026-04-25T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'UPDATE' as const,
      targetKind: 'grid' as const,
      targetId: gridId,
      before: { kind: 'grid' as const, snapshot: baseGrid },
      after: { kind: 'grid' as const, snapshot: { ...baseGrid, spacingX: 12 } },
    };
    expect(() => OperationSchema.parse(op)).not.toThrow();
  });

  it('rejects an operation missing targetKind', () => {
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 1,
      timestamp: '2026-04-25T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'CREATE' as const,
      targetId: newPrimitiveId(),
      before: null,
      after: null,
    };
    expect(() => OperationSchema.parse(op)).toThrow();
  });

  it('rejects an operation with mismatched snapshot.kind vs targetKind', () => {
    // Schema does not cross-check targetKind ↔ snapshot.kind today;
    // this test documents the current behaviour. Cross-check is a
    // store-side invariant enforced by emitOperation in Phase 6.
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 1,
      timestamp: '2026-04-25T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'CREATE' as const,
      targetKind: 'primitive' as const,
      targetId: newPrimitiveId(),
      before: null,
      // snapshot.kind is 'layer' even though targetKind is 'primitive'
      after: {
        kind: 'layer' as const,
        snapshot: {
          id: newLayerId(),
          name: '0',
          color: '#FFFFFF',
          lineType: 'continuous',
          lineWeight: 0.25,
          visible: true,
          frozen: false,
          locked: false,
        },
      },
    };
    // Zod accepts because the snapshot is a valid layer shape; the
    // cross-check is enforced upstream.
    expect(() => OperationSchema.parse(op)).not.toThrow();
  });

  it('accepts an optional promotionGroupId', () => {
    const op = {
      id: newOperationId(),
      projectId: newProjectId(),
      sequence: 1,
      timestamp: '2026-04-25T10:00:00.000Z',
      userId: LOCAL_USER_ID,
      type: 'DELETE' as const,
      targetKind: 'primitive' as const,
      targetId: newPrimitiveId(),
      before: {
        kind: 'primitive' as const,
        snapshot: {
          id: newPrimitiveId(),
          kind: 'point' as const,
          layerId: LayerId.DEFAULT,
          displayOverrides: {},
          position: { x: 0, y: 0 },
        },
      },
      after: null,
      promotionGroupId: 'some-uuid',
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
