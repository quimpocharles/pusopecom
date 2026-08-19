import { create } from 'zustand';

/**
 * A fan's pending Pass selection for one event at a time — not persisted to
 * localStorage the way cartStore.js's Merchandise cart is. That's
 * deliberate: a RESERVED_SEAT selection is backed by a real server-side
 * hold with a short TTL (see backend/repositories/passRepository.js), so
 * showing a "still selected" seat after a page reload — once its hold has
 * likely already expired — would be misleading rather than convenient.
 * Session-only state matches what's actually still true.
 *
 * Selections are keyed by passTierId for GENERAL_ADMISSION (one entry,
 * quantity adjustable) and by seatId for RESERVED_SEAT (one entry per
 * held seat, since each is independently scannable at checkout — see the
 * schema comment on the Pass model for why).
 */
const usePassCartStore = create((set, get) => ({
  event: null,
  gaSelections: [], // { tierId, tierName, price, quantity }
  seatSelections: [], // { tierId, tierName, price, seatId, seatLabel, holdToken, heldUntil }

  setEvent: (event) => {
    set((state) => (state.event?._id === event._id ? state : { event, gaSelections: [], seatSelections: [] }));
  },

  setGaQuantity: (tier, quantity) => {
    set((state) => {
      const rest = state.gaSelections.filter((s) => s.tierId !== tier._id);
      if (quantity <= 0) return { gaSelections: rest };
      return { gaSelections: [...rest, { tierId: tier._id, tierName: tier.name, price: tier.price, quantity }] };
    });
  },

  addSeatSelection: ({ tier, seat, holdToken, heldUntil }) => {
    set((state) => ({
      seatSelections: [
        ...state.seatSelections.filter((s) => s.seatId !== seat._id),
        { tierId: tier._id, tierName: tier.name, price: tier.price, seatId: seat._id, seatLabel: seat.label, holdToken, heldUntil },
      ],
    }));
  },

  removeSeatSelection: (seatId) => {
    set((state) => ({ seatSelections: state.seatSelections.filter((s) => s.seatId !== seatId) }));
  },

  clear: () => set({ event: null, gaSelections: [], seatSelections: [] }),

  getPassCount: () => {
    const { gaSelections, seatSelections } = get();
    return gaSelections.reduce((sum, s) => sum + s.quantity, 0) + seatSelections.length;
  },

  getPassTotal: () => {
    const { gaSelections, seatSelections } = get();
    return (
      gaSelections.reduce((sum, s) => sum + s.price * s.quantity, 0) +
      seatSelections.reduce((sum, s) => sum + s.price, 0)
    );
  },

  // Shape orders.js's POST /orders expects for its `passes` array.
  toOrderPasses: () => {
    const { gaSelections, seatSelections } = get();
    return [
      ...gaSelections.map((s) => ({ passTierId: s.tierId, quantity: s.quantity })),
      ...seatSelections.map((s) => ({ passTierId: s.tierId, seatId: s.seatId, holdToken: s.holdToken })),
    ];
  },
}));

export default usePassCartStore;
