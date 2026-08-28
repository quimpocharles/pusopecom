import { PH_TIME_ZONE } from './manilaTime';

// Shared date formatting for a Pass event's startsAt on the ticket. The
// confirmation page used inline `new Date(...).toLocaleString('en-PH', ...)`
// in two places; a ticket needs a compact "date · time" that reads cleanly at
// ticket size, while the Locker card and gate view call it with `full` for
// the bigger "Readable, Month Day, Year · time" treatment. Always rendered
// in Philippine time regardless of the viewer's own device timezone — a
// ticket's gate time can't shift depending on who's looking at it.
export function ticketDate(value, { full = false } = {}) {
  if (!value) return '';
  const date = new Date(value);
  if (full) {
    return date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: PH_TIME_ZONE }) +
      ' · ' +
      date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: PH_TIME_ZONE });
  }
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: PH_TIME_ZONE }) +
    ' · ' +
    date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: PH_TIME_ZONE });
}

export default ticketDate;
