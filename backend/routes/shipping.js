import express from 'express';
import VenuePickupConfig from '../models/VenuePickupConfig.js';
import { getDomesticRate, getInternationalRate } from '../lib/shipping/calculateShipping.js';

const router = express.Router();

const formatPickupDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// POST /api/shipping/options
// Body: { cartTotal: number, country: string, region?: string }
// Returns computed shipping options + venue pickup config (auto-disabled if date passed)
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

    // Venue pickup: auto-disable when pickup date has passed
    const rawVenue = await VenuePickupConfig.findOne().lean();
    const isVenueActive =
      rawVenue?.enabled &&
      rawVenue?.pickupDate &&
      new Date(rawVenue.pickupDate) > new Date();
    const venuePickup = isVenueActive ? rawVenue : null;

    const shippingOptions = [];

    if (country === 'Philippines') {
      const domestic = getDomesticRate(region || '', total);
      shippingOptions.push({
        method: domestic.method,
        label: 'Standard Delivery',
        description: 'Delivered to your address · 2–4 days',
        fee: domestic.fee,
        isFree: domestic.fee === 0,
      });

      if (venuePickup) {
        shippingOptions.push({
          method: 'venue_pickup',
          label: 'Pick Up at Venue',
          description: [
            venuePickup.venueName,
            formatPickupDate(venuePickup.pickupDate),
            venuePickup.pickupHours,
          ].filter(Boolean).join(' · '),
          fee: 0,
          isFree: true,
          note: venuePickup.specialInstructions || null,
        });
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

    res.json({ success: true, data: { shippingOptions, venuePickup } });
  } catch (error) {
    console.error('Shipping options error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipping options' });
  }
});

export default router;
