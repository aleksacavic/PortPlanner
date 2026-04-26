import { describe, expect, it } from 'vitest';
import { LayerId, newPrimitiveId, newProjectId } from '../src/ids';
import { LoadFailure, deserialize, serialize } from '../src/serialize';
import type { Project } from '../src/types';
import { defaultLayer } from '../src/types/layer';

function makeProject(): Project {
  const dl = defaultLayer();
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
    name: 'Test Port',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: dl },
    grids: {},
    scenarioId: null,
  };
}

describe('canonical serialize / deserialize', () => {
  it('round-trips to byte-identical canonical form', () => {
    const p = makeProject();
    const s1 = serialize(p);
    const p2 = deserialize(s1);
    const s2 = serialize(p2);
    expect(s1).toBe(s2);
  });

  it('produces keys in sorted order', () => {
    const p = makeProject();
    const s = serialize(p);
    const parsed = JSON.parse(s) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
  });

  it('is deterministic across calls with identical input', () => {
    const p = makeProject();
    const s1 = serialize(p);
    const s2 = serialize(p);
    expect(s1).toBe(s2);
  });

  it('deserialize throws LoadFailure for malformed JSON', () => {
    expect(() => deserialize('not json')).toThrow(LoadFailure);
  });

  it('deserialize throws LoadFailure for valid JSON with wrong shape', () => {
    expect(() => deserialize('{"foo": "bar"}')).toThrow(LoadFailure);
  });

  it('deserialize throws LoadFailure on schema version mismatch (1.0.0 payload)', () => {
    const oldShape = JSON.stringify({
      id: newProjectId(),
      schemaVersion: '1.0.0',
      name: 'Old Port',
      createdAt: '2026-04-22T10:00:00.000Z',
      updatedAt: '2026-04-22T10:00:00.000Z',
      coordinateSystem: null,
      objects: {},
      scenarioId: null,
    });
    expect(() => deserialize(oldShape)).toThrow(LoadFailure);
  });

  it('round-trips a project containing primitives, layers, and grids', () => {
    const p = makeProject();
    const primitiveId = newPrimitiveId();
    p.primitives[primitiveId] = {
      id: primitiveId,
      kind: 'line',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    };
    const s1 = serialize(p);
    const p2 = deserialize(s1);
    const s2 = serialize(p2);
    expect(s1).toBe(s2);
    expect(Object.keys(p2.primitives)).toHaveLength(1);
    expect(Object.keys(p2.layers)).toHaveLength(1);
  });
});
