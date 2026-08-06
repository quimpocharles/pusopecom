/**
 * Enterprise Fulfillment Blueprint, Phase 3 — the Phase 1/2 "courier" made
 * explicit: staff types a tracking number by hand, same interface a real
 * API-backed gateway will implement later (courierService.js's own
 * comment). Nothing here calls out to a network — bookPickup just echoes
 * back whatever the staff member entered, and getTrackingStatus has no
 * live status to poll, since there's no API behind this account. This
 * module existing at all is what lets a real courier module drop in next
 * to it later without anything upstream needing to know the difference
 * between a real API call and a manual entry.
 */

export async function bookPickup(shipment, { trackingNumber, labelUrl } = {}) {
  if (!trackingNumber) {
    throw new Error('Manual courier requires a trackingNumber to be provided by staff');
  }
  return { trackingNumber, labelUrl: labelUrl || null };
}

export async function getTrackingStatus() {
  throw new Error('Manual courier has no API to poll — status is staff-entered via the Shipment status transition, not pulled here');
}

export default { bookPickup, getTrackingStatus };
