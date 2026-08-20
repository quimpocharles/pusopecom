import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import passEventService from '../services/passEventService';

/**
 * Offline support for the gate check-in scanner (AdminPassCheckin.jsx),
 * expected to handle 300–5000 scans per event with venue network that's
 * often worst exactly during a pre-game rush. Deliberately not fully
 * offline-optimistic: `passes`/`tiers` is a read-only local snapshot for
 * lookups with no signal, but the actual check-in write always goes
 * through the real server call (passRepository.transition's atomic CAS,
 * backend/repositories/passRepository.js) — a network failure queues it
 * for retry rather than marking it checked-in on-device alone, so two
 * offline devices can never both silently admit the same pass.
 *
 * Persisted (same persist+localStorage convention as cartStore.js) since
 * this needs to survive a reload mid-shift — ~5000 passes at ~100–150
 * bytes each is 500–750KB, comfortably under localStorage's per-origin
 * limit, so no IndexedDB needed.
 */
const useCheckinSyncStore = create(
  persist(
    (set, get) => ({
      eventId: null,
      eventName: '',
      syncedAt: null,
      passes: {}, // qrToken -> { id, status, passTierId, price }
      tiers: {}, // passTierId -> { name }
      pendingCheckins: [], // { localId, passId, qrToken, scannedAt }
      conflicts: [], // { localId, passId, qrToken, message } — resolved on replay as "already checked in elsewhere"
      syncing: false,
      syncError: '',
      authExpired: false, // a queue flush hit a 401 — needs a fresh sign-in to keep syncing

      syncEvent: async (eventId, eventName) => {
        set({ syncing: true, syncError: '' });
        try {
          const res = await passEventService.syncPassesForEvent(eventId);
          const passes = {};
          for (const p of res.data.passes) passes[p.qrToken] = { id: p._id, status: p.status, passTierId: p.passTierId, price: p.price };
          const tiers = {};
          for (const t of res.data.tiers) tiers[t._id] = { name: t.name };
          set({
            eventId, eventName, passes, tiers,
            syncedAt: new Date().toISOString(),
            syncing: false,
            pendingCheckins: [],
            conflicts: [],
          });
        } catch (err) {
          set({ syncing: false, syncError: err.response?.data?.message || 'Failed to sync passes for this event.' });
          throw err;
        }
      },

      // Local-only lookup for when a live lookupPass call fails on a
      // network error. Shaped to match lookupPass's own response object
      // (_id, passEvent.name, passTier.name) so ResultCard needs no
      // offline-specific rendering branch — _id in particular matters:
      // it's what onConfirm/queueCheckin key off, so this can't just be a
      // raw spread of the {id, status, passTierId, price} snapshot row.
      lookupLocal: (qrToken) => {
        const { passes, tiers, eventName } = get();
        const pass = passes[qrToken];
        if (!pass) return null;
        return {
          _id: pass.id,
          qrToken,
          status: pass.status,
          price: pass.price,
          passTier: tiers[pass.passTierId] || null,
          passEvent: { name: eventName },
        };
      },

      // Marks a pass checked-in in the local snapshot — used both when a
      // check-in is queued (so re-scanning the same pass before syncing
      // correctly shows "already checked in" rather than queuing twice)
      // and after a queued item successfully replays.
      applyLocalCheckin: (qrToken) => {
        set((state) => {
          const pass = state.passes[qrToken];
          if (!pass) return state;
          return { passes: { ...state.passes, [qrToken]: { ...pass, status: 'checked_in' } } };
        });
      },

      queueCheckin: ({ passId, qrToken }) => {
        const localId = `${passId}-${Date.now()}`;
        set((state) => ({
          pendingCheckins: [...state.pendingCheckins, { localId, passId, qrToken, scannedAt: new Date().toISOString() }],
        }));
        get().applyLocalCheckin(qrToken);
        return localId;
      },

      // Replays every queued check-in against the real endpoint, in scan
      // order. A success or an "already checked in" response both clear
      // the item — the latter into `conflicts` instead of silently
      // vanishing, since it means a different gate admitted this exact
      // pass first and that's worth a staff member's attention. Any other
      // failure (still offline, a genuine server error) leaves the item
      // queued for the next flush.
      flushQueue: async () => {
        const { pendingCheckins } = get();
        if (pendingCheckins.length === 0) return;

        const stillPending = [];
        const newConflicts = [];
        for (let i = 0; i < pendingCheckins.length; i++) {
          const item = pendingCheckins[i];
          try {
            await passEventService.checkinPass(item.passId, undefined, { suppressAuthRedirect: true });
          } catch (err) {
            if (err.response?.status === 401) {
              // Every remaining item would fail the same way — stop
              // replaying rather than burn requests on a token we already
              // know is stale.
              set({ authExpired: true });
              stillPending.push(...pendingCheckins.slice(i));
              break;
            }
            if (err.response?.status === 400) {
              newConflicts.push({ ...item, message: err.response?.data?.message || 'This pass was already checked in elsewhere.' });
              continue;
            }
            stillPending.push(item);
          }
        }
        set((state) => ({
          pendingCheckins: stillPending,
          conflicts: [...state.conflicts, ...newConflicts],
        }));
      },

      clearConflict: (localId) => {
        set((state) => ({ conflicts: state.conflicts.filter((c) => c.localId !== localId) }));
      },

      reset: () => {
        set({
          eventId: null, eventName: '', syncedAt: null,
          passes: {}, tiers: {}, pendingCheckins: [], conflicts: [],
          syncing: false, syncError: '', authExpired: false,
        });
      },
    }),
    {
      name: 'puso-checkin-sync-storage',
      getStorage: () => localStorage,
    }
  )
);

export default useCheckinSyncStore;
