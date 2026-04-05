import { describe, it, expect } from 'vitest';
import { groupActivityItems } from './ServiceAccountWorkspace';

const makeItem = (overrides: Partial<{
  type: 'note' | 'task' | 'folder';
  action: 'created' | 'updated';
  id: string;
  title: string;
  folder: { id: string; name: string } | null;
  timestamp: string;
}> = {}) => ({
  type: 'note' as const,
  action: 'created' as const,
  id: overrides.id ?? 'n1',
  title: overrides.title ?? 'Test Note',
  folder: overrides.folder ?? null,
  timestamp: overrides.timestamp ?? '2026-04-05T14:00:00Z',
  ...overrides,
});

describe('groupActivityItems', () => {
  it('should return single items when no consecutive matches', () => {
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', timestamp: '2026-04-05T14:00:00Z' }),
      makeItem({ id: 't1', type: 'task', action: 'created', timestamp: '2026-04-05T13:00:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('single');
    expect(result[1].kind).toBe('single');
  });

  it('should group consecutive same-type/action/folder items within 5 minutes', () => {
    const folder = { id: 'f1', name: 'Research' };
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:04:00Z' }),
      makeItem({ id: 'n2', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:03:00Z' }),
      makeItem({ id: 'n3', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:02:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('group');
    if (result[0].kind === 'group') {
      expect(result[0].items).toHaveLength(3);
      expect(result[0].action).toBe('created');
      expect(result[0].type).toBe('note');
    }
  });

  it('should NOT group items more than 5 minutes apart', () => {
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', timestamp: '2026-04-05T14:10:00Z' }),
      makeItem({ id: 'n2', type: 'note', action: 'created', timestamp: '2026-04-05T14:00:00Z' }), // 10 min gap
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('single');
    expect(result[1].kind).toBe('single');
  });

  it('should NOT group items with different types', () => {
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', timestamp: '2026-04-05T14:01:00Z' }),
      makeItem({ id: 't1', type: 'task', action: 'created', timestamp: '2026-04-05T14:00:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(2);
  });

  it('should NOT group items with different actions', () => {
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', timestamp: '2026-04-05T14:01:00Z' }),
      makeItem({ id: 'n2', type: 'note', action: 'updated', timestamp: '2026-04-05T14:00:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(2);
  });

  it('should NOT group items in different folders', () => {
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', folder: { id: 'f1', name: 'A' }, timestamp: '2026-04-05T14:01:00Z' }),
      makeItem({ id: 'n2', type: 'note', action: 'created', folder: { id: 'f2', name: 'B' }, timestamp: '2026-04-05T14:00:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(2);
  });

  it('should handle empty input', () => {
    expect(groupActivityItems([])).toEqual([]);
  });

  it('should handle single item input', () => {
    const items = [makeItem()];
    const result = groupActivityItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('single');
  });

  it('should create multiple groups when separated by different items', () => {
    const folder = { id: 'f1', name: 'Research' };
    const items = [
      // Group 1: 2 created notes
      makeItem({ id: 'n1', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:02:00Z' }),
      makeItem({ id: 'n2', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:01:00Z' }),
      // Separator: a task
      makeItem({ id: 't1', type: 'task', action: 'created', timestamp: '2026-04-05T14:00:00Z' }),
      // Group 2: 2 more created notes
      makeItem({ id: 'n3', type: 'note', action: 'created', folder, timestamp: '2026-04-05T13:59:00Z' }),
      makeItem({ id: 'n4', type: 'note', action: 'created', folder, timestamp: '2026-04-05T13:58:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('group');
    expect(result[1].kind).toBe('single');
    expect(result[2].kind).toBe('group');
  });

  it('should assign stable keys to singles and groups', () => {
    const folder = { id: 'f1', name: 'Research' };
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:02:00Z' }),
      makeItem({ id: 'n2', type: 'note', action: 'created', folder, timestamp: '2026-04-05T14:01:00Z' }),
      makeItem({ id: 't1', type: 'task', action: 'updated', timestamp: '2026-04-05T13:00:00Z' }),
    ];

    const result = groupActivityItems(items);

    expect(result).toHaveLength(2);
    // Group key is content-based, not index-based
    expect(result[0].key).toBe('group-created-note-f1-2026-04-05T14:02:00Z');
    // Single key uses type-id
    expect(result[1].key).toBe('task-t1');
  });

  it('should produce consistent keys across re-renders', () => {
    const items = [
      makeItem({ id: 'n1', type: 'note', action: 'created', timestamp: '2026-04-05T14:00:00Z' }),
    ];

    const result1 = groupActivityItems(items);
    const result2 = groupActivityItems(items);

    expect(result1[0].key).toBe(result2[0].key);
  });
});
