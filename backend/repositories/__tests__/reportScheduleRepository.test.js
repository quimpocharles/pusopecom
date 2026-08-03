import { describe, it, expect, vi } from 'vitest';
import * as reportScheduleRepository from '../reportScheduleRepository.js';

describe('reportScheduleRepository.list', () => {
  it('self-heals missing frequencies rather than requiring a seed migration', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ id: 's1', frequency: 'daily', active: true }]) // first read: only daily exists
      .mockResolvedValueOnce([
        { id: 's1', frequency: 'daily', active: true },
        { id: 's2', frequency: 'weekly', active: true },
        { id: 's3', frequency: 'monthly', active: true },
        { id: 's4', frequency: 'quarterly', active: true },
      ]);
    const createMany = vi.fn().mockResolvedValue({ count: 3 });
    const client = { reportSchedule: { findMany, createMany } };

    const schedules = await reportScheduleRepository.list({ client });

    expect(createMany).toHaveBeenCalledWith({
      data: [{ frequency: 'weekly' }, { frequency: 'monthly' }, { frequency: 'quarterly' }],
      skipDuplicates: true,
    });
    expect(schedules.map((s) => s.frequency)).toEqual(['daily', 'weekly', 'monthly', 'quarterly']);
  });

  it('does not write anything when all four already exist', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 's1', frequency: 'daily', active: true },
      { id: 's2', frequency: 'weekly', active: false },
      { id: 's3', frequency: 'monthly', active: true },
      { id: 's4', frequency: 'quarterly', active: true },
    ]);
    const createMany = vi.fn();
    const client = { reportSchedule: { findMany, createMany } };

    await reportScheduleRepository.list({ client });

    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('reportScheduleRepository.isActive', () => {
  it('defaults to true when no row exists yet', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const client = { reportSchedule: { findUnique } };

    expect(await reportScheduleRepository.isActive('weekly', { client })).toBe(true);
  });

  it('returns the stored value when a row exists', async () => {
    const findUnique = vi.fn().mockResolvedValue({ frequency: 'weekly', active: false });
    const client = { reportSchedule: { findUnique } };

    expect(await reportScheduleRepository.isActive('weekly', { client })).toBe(false);
  });
});

describe('reportScheduleRepository.setActive', () => {
  it('upserts by frequency', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 's1', frequency: 'monthly', active: false });
    const client = { reportSchedule: { upsert } };

    const schedule = await reportScheduleRepository.setActive('monthly', false, { client });

    expect(upsert).toHaveBeenCalledWith({
      where: { frequency: 'monthly' },
      update: { active: false },
      create: { frequency: 'monthly', active: false },
    });
    expect(schedule.active).toBe(false);
  });
});
