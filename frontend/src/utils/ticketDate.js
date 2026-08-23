// Shared date formatting for a Pass event's startsAt on the ticket. The
// confirmation page used inline `new Date(...).toLocaleString('en-PH', ...)`
// in two places; a ticket needs a compact "date · time" that reads cleanly at
// ticket size, while the Locker card and gate view call it with `full` for
// the bigger "Readable, Month Day, Year · time" treatment.
export function ticketDate(value, { full = false } = {}) {
  if (!value) return '';
  const date = new Date(value);
  if (full) {
    return date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' +
      date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export default ticketDate;
