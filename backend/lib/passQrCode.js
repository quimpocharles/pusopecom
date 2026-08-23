import QRCode from 'qrcode';
import { uploadToCloudinary } from '../routes/upload.js';
import * as passRepository from '../repositories/passRepository.js';

export async function getPassQrCodeDataUrl(pass) {
  return QRCode.toDataURL(pass.qrToken, { errorCorrectionLevel: 'H', width: 300 });
}

/**
 * Generates and persists a Pass's QR image, if it doesn't have one yet.
 * Encodes the plain qrToken string, not a URL — the same reasoning proven
 * ticketing products use: a bare token can't be auto-opened/redeemed by a
 * phone's camera app the way a link could. Lazy and idempotent — safe to
 * call on every Pass on an order; ones that already have a qrCodeUrl are a
 * no-op.
 */
export async function ensurePassQrCode(pass) {
  if (pass.qrCodeUrl) return pass.qrCodeUrl;

  const buffer = await QRCode.toBuffer(pass.qrToken, { errorCorrectionLevel: 'H', width: 300 });
  const result = await uploadToCloudinary(buffer, 'puso-shop/pass-qr', { timeoutMs: 15_000 });
  await passRepository.updateById(pass._id, { qrCodeUrl: result.secure_url });
  return result.secure_url;
}
