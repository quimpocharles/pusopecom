import { describe, it, expect, vi } from 'vitest';
import * as reportRecipientRepository from '../reportRecipientRepository.js';

describe('reportRecipientRepository.findActiveEmails', () => {
  it('returns only active recipients as a flat email array', async () => {
    const findMany = vi.fn().mockResolvedValue([{ email: 'a@test.local' }, { email: 'b@test.local' }]);
    const client = { reportRecipient: { findMany } };

    const emails = await reportRecipientRepository.findActiveEmails({ client });

    expect(findMany).toHaveBeenCalledWith({ where: { active: true }, select: { email: true } });
    expect(emails).toEqual(['a@test.local', 'b@test.local']);
  });
});

describe('reportRecipientRepository.create/updateById/deleteById', () => {
  it('creates a recipient and serializes _id', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'r1', email: 'x@test.local', active: true, createdAt: new Date() });
    const client = { reportRecipient: { create } };

    const recipient = await reportRecipientRepository.create({ email: 'x@test.local' }, { client });

    expect(create).toHaveBeenCalledWith({ data: { email: 'x@test.local' } });
    expect(recipient._id).toBe('r1');
  });

  it('toggles active via updateById', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'r1', email: 'x@test.local', active: false });
    const client = { reportRecipient: { update } };

    const recipient = await reportRecipientRepository.updateById('r1', { active: false }, { client });

    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { active: false } });
    expect(recipient.active).toBe(false);
  });

  it('deletes by id', async () => {
    const del = vi.fn().mockResolvedValue({});
    const client = { reportRecipient: { delete: del } };

    await reportRecipientRepository.deleteById('r1', { client });

    expect(del).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
});
