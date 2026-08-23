import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/orderRepository.js', () => ({
  claimConfirmationEmailDelivery: vi.fn(),
  releaseConfirmationEmailClaim: vi.fn(),
  markConfirmationEmailSent: vi.fn(),
}));
vi.mock('../../repositories/passRepository.js', () => ({
  findByOrderId: vi.fn(),
}));
vi.mock('../passQrCode.js', () => ({
  ensurePassQrCode: vi.fn(),
}));
vi.mock('../../services/emailService.js', () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));

const { sendOrderConfirmation } = await import('../orderConfirmationEmail.js');
const orderRepository = await import('../../repositories/orderRepository.js');
const passRepository = await import('../../repositories/passRepository.js');
const passQrCode = await import('../passQrCode.js');
const emailService = await import('../../services/emailService.js');

const order = {
  _id: 'order-1',
  orderNumber: 'PS-20260823-EMAIL',
  email: 'fan@example.com',
  passes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  orderRepository.claimConfirmationEmailDelivery.mockResolvedValue(true);
  orderRepository.releaseConfirmationEmailClaim.mockResolvedValue(true);
  orderRepository.markConfirmationEmailSent.mockResolvedValue(true);
});

describe('sendOrderConfirmation', () => {
  it('sends QR-enriched Passes and marks delivery after SMTP succeeds', async () => {
    const pass = { _id: 'pass-1', qrToken: 'token-1' };
    passRepository.findByOrderId.mockResolvedValue([pass]);
    passQrCode.ensurePassQrCode.mockResolvedValue('https://cdn.example/qr.png');
    emailService.sendOrderConfirmationEmail.mockResolvedValue(undefined);
    orderRepository.markConfirmationEmailSent.mockResolvedValue(true);

    await sendOrderConfirmation({ ...order, passes: [pass] });

    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      order.email,
      expect.objectContaining({ passes: [{ ...pass, qrCodeUrl: 'https://cdn.example/qr.png' }] }),
    );
    expect(orderRepository.markConfirmationEmailSent).toHaveBeenCalledWith(order._id, { claimedAt: expect.any(Date) });
  });

  it('marks a Merchandise confirmation without Pass QR work', async () => {
    emailService.sendOrderConfirmationEmail.mockResolvedValue(undefined);
    orderRepository.markConfirmationEmailSent.mockResolvedValue(true);

    await sendOrderConfirmation(order);

    expect(passRepository.findByOrderId).not.toHaveBeenCalled();
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      order.email,
      expect.objectContaining({ passes: [] }),
    );
    expect(orderRepository.markConfirmationEmailSent).toHaveBeenCalledWith(order._id, { claimedAt: expect.any(Date) });
  });

  it('does not mark delivery when SMTP rejects', async () => {
    emailService.sendOrderConfirmationEmail.mockRejectedValue(new Error('SMTP down'));

    await expect(sendOrderConfirmation(order)).rejects.toThrow('SMTP down');
    expect(orderRepository.markConfirmationEmailSent).not.toHaveBeenCalled();
    expect(orderRepository.releaseConfirmationEmailClaim).toHaveBeenCalledWith(order._id, { claimedAt: expect.any(Date) });
  });

  it('does not mark delivery when Pass QR preparation rejects', async () => {
    const pass = { _id: 'pass-1', qrToken: 'token-1' };
    passRepository.findByOrderId.mockResolvedValue([pass]);
    passQrCode.ensurePassQrCode.mockRejectedValue(new Error('Cloudinary down'));

    await expect(sendOrderConfirmation({ ...order, passes: [pass] })).rejects.toThrow('Cloudinary down');
    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(orderRepository.markConfirmationEmailSent).not.toHaveBeenCalled();
    expect(orderRepository.releaseConfirmationEmailClaim).toHaveBeenCalledWith(order._id, { claimedAt: expect.any(Date) });
  });

  it('skips SMTP when another worker already owns the claim', async () => {
    orderRepository.claimConfirmationEmailDelivery.mockResolvedValue(false);

    await expect(sendOrderConfirmation(order)).resolves.toBe('skipped');

    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(orderRepository.markConfirmationEmailSent).not.toHaveBeenCalled();
  });

  it('allows only one concurrent sender to reach SMTP', async () => {
    let releaseSend;
    const sendGate = new Promise((resolve) => { releaseSend = resolve; });
    emailService.sendOrderConfirmationEmail.mockImplementation(async () => sendGate);
    orderRepository.claimConfirmationEmailDelivery
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const first = sendOrderConfirmation(order);
    const second = sendOrderConfirmation(order);
    releaseSend();

    await expect(Promise.all([first, second])).resolves.toEqual(['sent', 'skipped']);
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledTimes(1);
  });
});
