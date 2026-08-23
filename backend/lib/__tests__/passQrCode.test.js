import { describe, it, expect, vi } from 'vitest';

vi.mock('../../routes/upload.js', () => ({
  uploadToCloudinary: vi.fn(),
}));
vi.mock('../../repositories/passRepository.js', () => ({
  updateById: vi.fn(),
}));

const { getPassQrCodeDataUrl } = await import('../passQrCode.js');
const { uploadToCloudinary } = await import('../../routes/upload.js');

describe('getPassQrCodeDataUrl', () => {
  it('renders a missing pass QR locally without waiting for Cloudinary', async () => {
    const dataUrl = await getPassQrCodeDataUrl({ qrToken: 'pass-token' });

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });
});
