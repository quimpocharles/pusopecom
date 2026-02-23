import express from 'express';
import VenuePickupConfig from '../models/VenuePickupConfig.js';
import {
  getDomesticRate,
  getInternationalRate,
  isSlotActive,
} from '../lib/shipping/calculateShipping.js';

const router = express.Router();

// Format "YYYY-MM-DD" → "Mar 15" without timezone shift
const formatSlotDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

// POST /api/shipping/options
// Body: { cartTotal: number, country: string, region?: string }
router.post('/options', async (req, res) => {
  try {
    const { cartTotal, country, region } = req.body;

    const total = Number(cartTotal);
    if (isNaN(total) || total < 0) {
      return res.status(400).json({ success: false, message: 'Invalid cartTotal' });
    }
    if (typeof country !== 'string' || !country.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid country' });
    }

    const shippingOptions = [];

    if (country === 'Philippines') {
      // Standard domestic delivery
      const domestic = getDomesticRate(region || '', total);
      shippingOptions.push({
        method: domestic.method,
        label: 'Standard Delivery',
        description: 'Delivered to your address · 2–4 days',
        fee: domestic.fee,
        isFree: domestic.fee === 0,
      });

      // Venue pickup — one card per active slot
      const config = await VenuePickupConfig.findOne().lean();
      if (config?.enabled && config.slots?.length) {
        const deadlineHours = config.deadlineHours ?? 6;
        for (const slot of config.slots) {
          if (isSlotActive(slot, deadlineHours)) {
            shippingOptions.push({
              method: 'venue_pickup',
              slotId: slot._id.toString(),
              label: slot.venueName ? `Pick Up at ${slot.venueName}` : 'Pick Up at Venue',
              description: [
                slot.venueName,
                formatSlotDate(slot.pickupDate),
                slot.pickupHours,
              ].filter(Boolean).join(' · '),
              fee: 0,
              isFree: true,
              note: slot.specialInstructions || null,
              venueName: slot.venueName,
              venueAddress: slot.venueAddress,
            });
          }
        }
      }
    } else {
      const intl = getInternationalRate(country);
      if (intl.method === 'contact_us') {
        shippingOptions.push({ method: 'contact_us', label: null, description: null, fee: null, isFree: false });
      } else {
        shippingOptions.push({
          method: 'international',
          label: 'International Shipping',
          description: 'Delivered to your address · 10–21 days',
          fee: intl.fee,
          isFree: false,
          region: intl.region,
        });
      }
    }

    res.json({ success: true, data: { shippingOptions } });
  } catch (error) {
    console.error('Shipping options error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipping options' });
  }
});

export default router;
