import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPinIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import Layout from '../components/layout/Layout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import passEventService from '../services/passEventService';
import SEO from '../components/common/SEO';

const EventCard = ({ event }) => {
  const lowestPrice = event.tiers?.length ? Math.min(...event.tiers.map((t) => t.price)) : null;

  return (
    <Link to={`/events/${event.slug}`} className="group block card overflow-hidden hover:border-ink-900 transition-colors duration-150">
      <div className="aspect-video bg-ink-200 relative">
        {event.images?.[0] ? (
          <img src={event.images[0]} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-500">
            <CalendarDaysIcon className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-4">
        {event.organization?.name && (
          <p className="text-editorial-caption font-semibold uppercase tracking-wide text-ink-500 mb-1">{event.organization.name}</p>
        )}
        <h3 className="font-bold text-ink-900 mb-1 line-clamp-2">{event.name}</h3>
        <p className="text-sm text-ink-500 flex items-center gap-1 mb-1">
          <CalendarDaysIcon className="w-4 h-4 flex-shrink-0" />
          {new Date(event.startsAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        {event.venue?.name && (
          <p className="text-sm text-ink-500 flex items-center gap-1 mb-3">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            {event.venue.name}
          </p>
        )}
        {lowestPrice != null && (
          <p className="text-sm font-semibold text-ink-900">From ₱{lowestPrice.toFixed(2)}</p>
        )}
      </div>
    </Link>
  );
};

const PassEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    passEventService
      .getUpcoming()
      .then((res) => setEvents(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <SEO title="Events" description="Upcoming games and events — buy your Pass to attend." />
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-2">Events</h1>
        <p className="text-gray-500 mb-8">Buy a Pass to support your team live.</p>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <p className="text-sm text-red-600">Failed to load events. Please try again.</p>
        ) : events.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">No upcoming events right now — check back soon.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PassEvents;
