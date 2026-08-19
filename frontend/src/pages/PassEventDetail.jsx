import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPinIcon, CalendarDaysIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import passEventService from '../services/passEventService';
import usePassCartStore from '../store/passCartStore';
import SEO from '../components/common/SEO';

const TierPicker = ({ tier }) => {
  const selections = usePassCartStore((s) => s.selections);
  const setQuantity = usePassCartStore((s) => s.setQuantity);
  const quantity = selections.find((s) => s.tierId === tier._id)?.quantity || 0;

  return (
    <div className="flex items-center justify-between p-4 border border-ink-200">
      <div>
        <p className="font-semibold text-ink-900">{tier.name}</p>
        <p className="text-sm text-ink-500">
          {tier.venueSection?.name && `${tier.venueSection.name} · `}₱{tier.price.toFixed(2)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setQuantity(tier, Math.max(0, quantity - 1))}
          disabled={quantity === 0}
          className="w-8 h-8 flex items-center justify-center border border-ink-200 disabled:opacity-40"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="w-6 text-center font-medium">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity(tier, quantity + 1)}
          className="w-8 h-8 flex items-center justify-center border border-ink-200 hover:border-ink-900"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
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
  const passSelections = usePassCartStore((s) => s.selections);
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

  const tiers = event.tiers || [];
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
            {event.images?.[0] && (
              <img src={event.images[0]} alt={event.name} className="w-full aspect-video object-cover border border-ink-200" />
            )}

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

            {/* Static reference image only — "roughly where each section is,"
                no coordinates or interactivity (ADR-011 addendum: per-seat
                selection was scrapped after checking it against a real
                curved arena bowl a flat grid couldn't represent). Absent
                when the venue hasn't set one, per CLAUDE.md's CMS-first
                "empty section renders as absent" rule. */}
            {event.venue?.seatingChartUrl && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 mb-2">Seating Chart</h2>
                <img src={event.venue.seatingChartUrl} alt={`${event.venue.name} seating chart`} className="w-full border border-ink-200" />
              </div>
            )}

            {!event.onSale && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Passes for this event aren't on sale right now.
              </div>
            )}

            {event.onSale && (
              <div className="space-y-4">
                {tiers.map((tier) => <TierPicker key={tier._id} tier={tier} />)}
                {tiers.length === 0 && (
                  <p className="text-sm text-gray-500">No tiers available for this event yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="order-first lg:order-last">
            <div className="card p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Your Passes</h2>
              {count === 0 || !isCurrentEvent ? (
                <p className="text-sm text-gray-500">Pick a tier to get started.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {passSelections.map((s) => (
                    <div key={s.tierId} className="flex justify-between text-sm">
                      <span>{s.tierName} × {s.quantity}</span>
                      <span className="font-medium">₱{(s.price * s.quantity).toFixed(2)}</span>
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
