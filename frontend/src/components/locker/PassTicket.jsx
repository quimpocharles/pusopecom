import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import PusoLogo from '../../assets/images/Logo.png';
import { passStatusLabel, passStatusStyle } from '../../utils/passStatus';
import { ticketDate } from '../../utils/ticketDate';
import { downloadTicketImage } from '../../utils/ticketImage';

// The PusoStore event ticket, visually inherited from the confirmation page
// (OrderConfirmation.jsx) — dark photo hero + PusoLogo strip + off-white body
// + QR + "Ticket Details" grid. One component so the Order Confirmation, the
// gate/detail view, and the Locker Pass card can never drift from each other.
//
// Props:
//   pass        — the Pass row (passEvent, passTier, status, qrCodeUrl...)
//   large       — gate/confirmation size (bumps the QR to scan size)
//   ticketRef   — a ref to the root DOM node, for downloadTicketImage
//   orderNumber — the order this ticket belongs to, shown on the ticket
//   position    — { index, total }, renders a "Ticket X of Y" pager when total > 1
const PassTicket = ({ pass, large = false, ticketRef, orderNumber, position }) => {
  const event = pass.passEvent || {};
  const venue = event.venue || {};
  const org = event.organization || {};
  const tier = pass.passTier || {};
  const section = tier.venueSection || {};
  const heroBg = event.images?.[0] ? { backgroundImage: `url(${event.images[0]})` } : undefined;
  const showPager = position && position.total > 1;

  const onDownload = () => {
    const domNode = ticketRef?.current || ticketRef;
    if (domNode) downloadTicketImage(domNode, `${event.name || 'ticket'}-${tier.name || ''}.png`);
  };

  return (
    <div ref={ticketRef} className="border-2 border-ink-900 overflow-hidden bg-white">
      {/* Photo hero — dark overlay so white text reads over any artwork. */}
      <div className="relative bg-cover bg-center bg-ink-900" style={heroBg}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-ink-900" />
        <div className={`relative px-6 text-center text-white ${large ? 'pt-6 pb-8' : 'pt-4 pb-6'}`}>
          {org.name && (
            <p className="text-xs uppercase tracking-wide text-white/60 mb-3">
              {org.name}
            </p>
          )}
          <p className={`font-bold ${large ? 'text-2xl' : 'text-xl'}`}>{event.name}</p>
          {event.startsAt && (
            <p className={`${large ? 'text-base' : 'text-sm'} text-white/80 mt-1`}>
              {ticketDate(event.startsAt)}
            </p>
          )}
          {venue.name && <p className={`${large ? 'text-base' : 'text-sm'} text-white/80`}>{venue.name}</p>}
        </div>
      </div>

      {/* PusoLogo strip. */}
      <div className="bg-black py-3 flex items-center justify-center">
        <img src={PusoLogo} alt="Puso Pilipinas" className="h-6 w-auto" />
      </div>

      {/* QR / status body. */}
      <div className={`bg-paper flex flex-col items-center text-center ${large ? 'px-6 pt-6 pb-6' : 'px-6 py-5'}`}>
        <span className={`text-xs font-semibold uppercase tracking-wide mb-3 ${passStatusStyle(pass.status)}`}>
          {passStatusLabel(pass.status)}
        </span>
        {pass.status === 'issued' ? (
          <>
            <p className="text-xs text-gray-500 mb-3">Show this code at the gate</p>
            {pass.qrCodeUrl ? (
              <img
                src={pass.qrCodeUrl}
                alt="Pass QR code"
                className={`bg-white border border-ink-200 p-2 ${large ? 'w-64 h-64' : 'w-44 h-44'}`}
              />
            ) : (
              <p className="font-mono text-sm bg-white border border-ink-200 px-3 py-2 break-all">{pass.qrToken}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">This pass isn't ready to show yet.</p>
        )}
      </div>

      {/* Ticket Details grid — includes the credential identifiers a fan at
          the gate scans for: ticket number, order number, and status. */}
      <div className="bg-paper px-6 pb-6 pt-4 border-t border-ink-200 text-left">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-3">Ticket Details</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-gray-500">Status</p>
            <p className={`font-semibold text-ink-900 ${passStatusStyle(pass.status)}`}>
              {passStatusLabel(pass.status)}
            </p>
          </div>
          {orderNumber && (
            <div>
              <p className="text-gray-500">Order</p>
              <p className="font-semibold text-ink-900 break-all">{orderNumber}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Ticket Type</p>
            <p className="font-semibold text-ink-900">{tier.name}</p>
          </div>
          {section.name && (
            <div>
              <p className="text-gray-500">Section</p>
              <p className="font-semibold text-ink-900">{section.name}</p>
            </div>
          )}
          {pass._id && (
            <div>
              <p className="text-gray-500">Ticket No.</p>
              <p className="font-mono text-xs text-ink-900 break-all">{pass._id}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pager — "Ticket X of Y" (only when the order holds more than one).
          Shows over the download button, still on the off-white body. */}
      {showPager && (
        <div className="bg-paper px-6 pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Ticket {position.index + 1} of {position.total}
          </p>
        </div>
      )}

      {/* Download — only when a capturable node is available, same as the
          confirmation page. */}
      {pass.status === 'issued' && ticketRef && (
        <div className="bg-paper px-6 pb-6">
          <button
            onClick={onDownload}
            className="btn-outline w-full inline-flex items-center justify-center gap-1.5"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            Download Ticket
          </button>
        </div>
      )}
    </div>
  );
};

export default PassTicket;
