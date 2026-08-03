import { describe, it, expect, vi } from 'vitest';
import * as reportRunRepository from '../reportRunRepository.js';

describe('reportRunRepository.create', () => {
  it('creates a run with the given fields and serializes _id', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'run-1', type: 'daily_business_report', status: 'sent',
      reportDate: new Date('2026-08-01'), data: { sales: {} }, recipients: ['a@test.local'], errorMessage: null,
    });
    const client = { reportRun: { create } };

    const run = await reportRunRepository.create(
      { status: 'sent', reportDate: new Date('2026-08-01'), data: { sales: {} }, recipients: ['a@test.local'] },
      { client }
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        type: 'daily_business_report',
        status: 'sent',
        reportDate: new Date('2026-08-01'),
        data: { sales: {} },
        recipients: ['a@test.local'],
        errorMessage: undefined,
      },
    });
    expect(run._id).toBe('run-1');
  });

  it('defaults recipients to an empty array', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'run-2', status: 'skipped' });
    const client = { reportRun: { create } };

    await reportRunRepository.create({ status: 'skipped', reportDate: new Date() }, { client });

    expect(create.mock.calls[0][0].data.recipients).toEqual([]);
  });
});

describe('reportRunRepository.find/count/findById/deleteById', () => {
  it('find passes where/orderBy/skip/take through, defaulting to newest first', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { reportRun: { findMany } };

    await reportRunRepository.find({ where: { status: 'sent' }, skip: 10, take: 5, client });

    expect(findMany).toHaveBeenCalledWith({ where: { status: 'sent' }, orderBy: { createdAt: 'desc' }, skip: 10, take: 5 });
  });

  it('findById returns null for a non-existent run without throwing', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const client = { reportRun: { findUnique } };

    const run = await reportRunRepository.findById('missing', { client });
    expect(run).toBeNull();
  });

  it('deleteById deletes by id', async () => {
    const del = vi.fn().mockResolvedValue({});
    const client = { reportRun: { delete: del } };

    await reportRunRepository.deleteById('run-1', { client });
    expect(del).toHaveBeenCalledWith({ where: { id: 'run-1' } });
  });
});
