import { describe, it, expect } from 'vitest';
import { serialize, withRelationFallback } from '../serialize.js';

describe('serialize', () => {
  it('renames id to _id on a flat record', () => {
    expect(serialize({ id: 'abc123', name: 'Gilas Jersey' })).toEqual({
      _id: 'abc123',
      name: 'Gilas Jersey',
    });
  });

  it('passes primitives through unchanged', () => {
    expect(serialize('hello')).toBe('hello');
    expect(serialize(42)).toBe(42);
    expect(serialize(true)).toBe(true);
    expect(serialize(null)).toBe(null);
    expect(serialize(undefined)).toBe(undefined);
  });

  it('does not corrupt Date fields — the exact bug a naive recursive walk would introduce', () => {
    const date = new Date('2026-01-15T00:00:00.000Z');
    const result = serialize({ id: 'abc', createdAt: date });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('recurses into a populated relation, matching Mongoose .populate() shape', () => {
    const result = serialize({
      id: 'order1',
      orderNumber: 'PP-ABC-123',
      user: { id: 'user1', firstName: 'Juan', email: 'juan@example.com' },
    });
    expect(result).toEqual({
      _id: 'order1',
      orderNumber: 'PP-ABC-123',
      user: { _id: 'user1', firstName: 'Juan', email: 'juan@example.com' },
    });
  });

  it('recurses into arrays of nested relations at any depth', () => {
    const result = serialize({
      id: 'product1',
      colors: [
        { id: 'color1', color: 'Navy', sizes: [{ id: 'size1', size: 'M', stock: 10 }] },
      ],
    });
    expect(result).toEqual({
      _id: 'product1',
      colors: [
        { _id: 'color1', color: 'Navy', sizes: [{ _id: 'size1', size: 'M', stock: 10 }] },
      ],
    });
  });

  it('serializes an array of records', () => {
    const result = serialize([{ id: 'a' }, { id: 'b' }]);
    expect(result).toEqual([{ _id: 'a' }, { _id: 'b' }]);
  });
});

describe('withRelationFallback', () => {
  it('falls back to the FK scalar when the relation was not included', () => {
    // withRelationFallback runs independently of serialize() — it doesn't
    // touch `id` at all, only the relation/FK pair it's told about.
    const record = { id: 'order1', userId: 'user1' };
    expect(withRelationFallback(record, { user: 'userId' })).toEqual({
      id: 'order1',
      user: 'user1',
    });
  });

  it('prefers the populated relation object over the FK scalar when both are present', () => {
    const record = { id: 'order1', userId: 'user1', user: { id: 'user1', firstName: 'Juan' } };
    const result = withRelationFallback(record, { user: 'userId' });
    expect(result.user).toEqual({ id: 'user1', firstName: 'Juan' });
    expect(result).not.toHaveProperty('userId');
  });

  it('handles multiple relation mappings on the same record', () => {
    const record = { id: 'item1', orderId: 'order1', productId: 'product1' };
    const result = withRelationFallback(record, { order: 'orderId', product: 'productId' });
    expect(result.order).toBe('order1');
    expect(result.product).toBe('product1');
    expect(result).not.toHaveProperty('orderId');
    expect(result).not.toHaveProperty('productId');
  });

  it('composes with serialize() to produce the full Mongoose-equivalent shape', () => {
    const record = { id: 'order1', userId: 'user1' };
    const result = serialize(withRelationFallback(record, { user: 'userId' }));
    expect(result).toEqual({ _id: 'order1', user: 'user1' });
  });
});
