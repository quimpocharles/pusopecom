import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { passStatusLabel, passStatusStyle } from '../../utils/passStatus';
import { ticketDate } from '../../utils/ticketDate';

// A pass in the Passes grid — a digital ticket at a glance. The QR is shown
// in the card itself (not hidden behind a second navigation) so "where is
// my ticket / can I scan it right now?" is answered without leaving the
// Locker. "View Ticket" opens the full gate view for the large QR.
const PassCard = ({ pass, onViewTicket }) => {
  const event = pass.passEvent || {};
  const venue = event.venue || {};
  const org = event.organization || {};
  const tier = pass.passTier || {};
  const section = tier.venueSection || {};

  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Event identity — artwork (or org logo) + name + date + venue. */}
      <div className="relative bg-ink-900">
        {event.images?.[0] ? (
          <img src={event.images[0]} alt={event.name} className="w-full h-24 object-cover" />
        ) : (
          <div className="w-full h-24 bg-ink-900 flex items-center justify-center px-3">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-white/60 text-2xl font-display">{org.name?.[0] || 'P'}</span>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3">
          <p className="text-white font-bold leading-tight">{event.name}</p>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {venue.name && <p className="text-editorial-caption text-ink-500 truncate">{venue.name}</p>}
            {event.startsAt && (
              <p className="text-editorial-caption text-ink-900 font-semibold">{ticketDate(event.startsAt)}</p>
            )}
          </div>
          <span className={`text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${passStatusStyle(pass.status)}`}>
            {passStatusLabel(pass.status)}
          </span>
        </div>

        {tier.name && (
          <p className="text-editorial-label text-ink-700">
            <span className="font-bold">{tier.name}</span>
            {section.name && <span className="text-ink-500"> · {section.name}</span>}
          </p>
        )}

        {/* QR — a primary element, visible without leaving the Locker. */}
        {pass.status === 'issued' && (
          <div className="flex justify-center py-1">
            {pass.qrCodeUrl ? (
              <img src={pass.qrCodeUrl} alt="Pass QR code" className="w-28 h-28 bg-white border border-ink-200 p-1.5" />
            ) : (
              <div className="w-28 h-28 bg-white border border-ink-200 flex items-center justify-center">
                <span className="font-mono text-xs text-ink-500 px-1 break-all">{pass.qrToken}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onViewTicket(pass)}
          className="btn-secondary w-full inline-flex items-center justify-center gap-1.5"
        >
          View Ticket
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PassCard;
