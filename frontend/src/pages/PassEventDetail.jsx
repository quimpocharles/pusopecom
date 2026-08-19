import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPinIcon, CalendarDaysIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import passEventService from '../services/passEventService';
import usePassCartStore from '../store/passCartStore';
import SEO from '../components/common/SEO';

// Live availability, colored by status — available (pickable), held by me
// (from this browser's own passCartStore, not the server response, since
// the server never returns another holder's token — see the route's own
// comment), held by someone else / sold (both simply unavailable to click).
const SeatMap = ({ seats, heldSeatIds, onSelect, disabled }) => {
  if (!seats.length) return <p className="text-sm text-gray-400">No seats in this section yet.</p>;

  const rows = {};
  for (const seat of seats) (rows[seat.row] ??= []).push(seat);
  for (const row of Object.values(rows)) row.sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));

  return (
    <div className="space-y-1.5">
      {Object.entries(rows).map(([row, rowSeats]) => (
        <div key={row} className="flex items-center gap-1.5">
          <span className="w-6 text-xs font-medium text-gray-500 flex-shrink-0">{row}</span>
          <div className="flex flex-wrap gap-1">
            {rowSeats.map((seat) => {
              const mine = heldSeatIds.has(seat.seat._id);
              const clickable = !disabled && (seat.status === 'available' || mine);
              return (
                <button
                  key={seat._id}
                  type="button"
                  title={seat.seat.label}
                  disabled={!clickable}
                  onClick={() => onSelect(seat, mine)}
                  className={`w-8 h-8 flex items-center justify-center text-[10px] font-medium border transition-colors ${
                    mine
                      ? 'bg-ink-900 border-ink-900 text-white'
                      : seat.status === 'available'
                      ? 'bg-white border-ink-200 text-ink-700 hover:border-ink-900 cursor-pointer'
                      : 'bg-ink-200 border-ink-200 text-ink-500 cursor-not-allowed'
                  }`}
                >
                  {seat.seat.seatNumber}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const GaTierPicker = ({ tier }) => {
  const gaSelections = usePassCartStore((s) => s.gaSelections);
  const setGaQuantity = usePassCartStore((s) => s.setGaQuantity);
  const quantity = gaSelections.find((s) => s.tierId === tier._id)?.quantity || 0;

  return (
    <div className="flex items-center justify-between p-4 border border-ink-200">
      <div>
        <p className="font-semibold text-ink-900">{tier.name}</p>
        <p className="text-sm text-ink-500">₱{tier.price.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setGaQuantity(tier, Math.max(0, quantity - 1))}
          disabled={quantity === 0}
          className="w-8 h-8 flex items-center justify-center border border-ink-200 disabled:opacity-40"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="w-6 text-center font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => setGaQuantity(tier, quantity + 1)}
          className="w-8 h-8 flex items-center justify-center border border-ink-200 hover:border-ink-900"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ReservedTierSection = ({ tier }) => {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busySeatId, setBusySeatId] = useState(null);
  const [error, setError] = useState('');
  const event = usePassCartStore((s) => s.event);
  const seatSelections = usePassCartStore((s) => s.seatSelections);
  const addSeatSelection = usePassCartStore((s) => s.addSeatSelection);
  const removeSeatSelection = usePassCartStore((s) => s.removeSeatSelection);

  const sectionId = tier.venueSection?._id || tier.venueSectionId;
  const heldSeatIds = new Set(seatSelections.filter((s) => s.tierId === tier._id).map((s) => s.seatId));

  const fetchSeats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await passEventService.getSectionSeats(event._id, sectionId);
      setSeats(res.data);
    } catch {
      setError('Failed to load seats.');
    } finally {
      setLoading(false);
    }
  }, [event, sectionId]);

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  const handleSelect = async (eventSeat, mine) => {
    setError('');
    setBusySeatId(eventSeat.seat._id);
    try {
      if (mine) {
        const existing = seatSelections.find((s) => s.seatId === eventSeat.seat._id);
        await passEventService.releaseSeat(event._id, eventSeat.seat._id, existing?.holdToken);
        removeSeatSelection(eventSeat.seat._id);
      } else {
        const res = await passEventService.holdSeat(event._id, eventSeat.seat._id);
        addSeatSelection({ tier, seat: eventSeat.seat, holdToken: res.data.holdToken, heldUntil: res.data.heldUntil });
      }
      fetchSeats();
    } catch (err) {
      setError(err.response?.data?.message || 'That seat is no longer available.');
      fetchSeats();
    } finally {
      setBusySeatId(null);
    }
  };

  return (
    <div className="p-4 border border-ink-200">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-ink-900">{tier.name}</p>
          <p className="text-sm text-ink-500">₱{tier.price.toFixed(2)} per seat</p>
        </div>
        {heldSeatIds.size > 0 && <span className="text-sm font-medium text-ink-900">{heldSeatIds.size} selected</span>}
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {loading ? <LoadingSpinner /> : <SeatMap seats={seats} heldSeatIds={heldSeatIds} onSelect={handleSelect} disabled={!!busySeatId} />}
      <div className="flex items-center gap-4 mt-3 text-xs text-ink-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white border border-ink-200 inline-block" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-ink-900 inline-block" /> Your pick</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-ink-200 border border-ink-200 inline-block" /> Taken</span>
      </div>
    </div>
  );
};

const PassEventDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const storeEvent = usePassCartStore((s) => s.event);
  const setEventInStore = usePassCartStore((s) => s.setEvent);
  const gaSelections = usePassCartStore((s) => s.gaSelections);
  const seatSelections = usePassCartStore((s) => s.seatSelections);
  const getPassTotal = usePassCartStore((s) => s.getPassTotal);
  const getPassCount = usePassCartStore((s) => s.getPassCount);

  useEffect(() => {
    setLoading(true);
    passEventService
      .getBySlug(slug)
      .then((res) => {
        setEvent(res.data);
        setEventInStore(res.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, setEventInStore]);

  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-12"><LoadingSpinner /></div>
      </Layout>
    );
  }

  if (notFound || !event) {
    return (
      <Layout>
        <div className="container-custom py-12 text-center text-gray-500">Event not found.</div>
      </Layout>
    );
  }

  const gaTiers = (event.tiers || []).filter((t) => (t.venueSection?.seatingType || t.seatingType) === 'GENERAL_ADMISSION');
  const reservedTiers = (event.tiers || []).filter((t) => (t.venueSection?.seatingType || t.seatingType) === 'RESERVED_SEAT');
  const total = getPassTotal();
  const count = getPassCount();
  const isCurrentEvent = storeEvent?._id === event._id;

  const handleCheckout = () => {
    navigate('/checkout');
  };

  return (
    <Layout>
      <SEO title={event.name} description={event.description} />
      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              {event.organization?.name && <p className="text-sm font-medium text-ink-500 uppercase tracking-wide mb-1">{event.organization.name}</p>}
              <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDaysIcon className="w-4 h-4" />
                  {new Date(event.startsAt).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1.5">
                    <MapPinIcon className="w-4 h-4" />
                    {event.venue.name}, {event.venue.city}
                  </span>
                )}
              </div>
              {event.description && <p className="text-gray-600 mt-4">{event.description}</p>}
            </div>

            {!event.onSale && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Passes for this event aren't on sale right now.
              </div>
            )}

            {event.onSale && (
              <div className="space-y-4">
                {gaTiers.map((tier) => <GaTierPicker key={tier._id} tier={tier} />)}
                {reservedTiers.map((tier) => <ReservedTierSection key={tier._id} tier={tier} />)}
                {gaTiers.length === 0 && reservedTiers.length === 0 && (
                  <p className="text-sm text-gray-500">No tiers available for this event yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="order-first lg:order-last">
            <div className="card p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Your Passes</h2>
              {count === 0 || !isCurrentEvent ? (
                <p className="text-sm text-gray-500">Pick a tier or seat to get started.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {gaSelections.map((s) => (
                    <div key={s.tierId} className="flex justify-between text-sm">
                      <span>{s.tierName} × {s.quantity}</span>
                      <span className="font-medium">₱{(s.price * s.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {seatSelections.map((s) => (
                    <div key={s.seatId} className="flex justify-between text-sm">
                      <span>{s.tierName} — {s.seatLabel}</span>
                      <span className="font-medium">₱{s.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-3 border-t mb-4">
                <span>Total</span>
                <span className="text-ink-900">₱{isCurrentEvent ? total.toFixed(2) : '0.00'}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={!isCurrentEvent || count === 0}
                className="btn-primary w-full disabled:opacity-50"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PassEventDetail;
