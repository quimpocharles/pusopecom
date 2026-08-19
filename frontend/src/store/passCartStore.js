import { create } from 'zustand';

/**
 * A fan's pending Pass selection for one event at a time — not persisted to
 * localStorage the way cartStore.js's Merchandise cart is, to keep the same
 * session-only shape now that selection has no server-side hold to expire
 * either (ADR-011 addendum — per-seat selection was scrapped; every tier is
 * a plain quantity pick now).
 *
 * Selections are keyed by passTierId, one entry per tier with an adjustable
 * quantity.
 */
const usePassCartStore = create((set, get) => ({
  event: null,
  selections: [], // { tierId, tierName, price, quantity }

  setEvent: (event) => {
    set((state) => (state.event?._id === event._id ? state : { event, selections: [] }));
  },

  setQuantity: (tier, quantity) => {
    set((state) => {
      const rest = state.selections.filter((s) => s.tierId !== tier._id);
      if (quantity <= 0) return { selections: rest };
      return { selections: [...rest, { tierId: tier._id, tierName: tier.name, price: tier.price, quantity }] };
    });
  },

  clear: () => set({ event: null, selections: [] }),

  getPassCount: () => {
    const { selections } = get();
    return selections.reduce((sum, s) => sum + s.quantity, 0);
  },

  getPassTotal: () => {
    const { selections } = get();
    return selections.reduce((sum, s) => sum + s.price * s.quantity, 0);
  },

  // Shape orders.js's POST /orders expects for its `passes` array.
  toOrderPasses: () => {
    const { selections } = get();
    return selections.map((s) => ({ passTierId: s.tierId, quantity: s.quantity }));
  },
}));

export default usePassCartStore;
