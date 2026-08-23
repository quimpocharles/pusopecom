import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PassTicket from '../PassTicket';

vi.mock('../../assets/images/Logo.png', () => ({ default: 'logo.png' }));
vi.mock('../../../utils/ticketImage', () => ({ downloadTicketImage: vi.fn() }));

function passFixture(overrides = {}) {
  return {
    _id: 'pass-abc-123', status: 'issued', qrToken: 'tok-1', qrCodeUrl: 'https://cloudinary.com/qr1.png',
    price: 600,
    passEvent: { _id: 'e1', name: 'UAAP Finals', images: [], startsAt: '2026-09-01T18:00:00Z', venue: { name: 'Araneta Coliseum' }, organization: { name: 'UAAP' } },
    passTier: { _id: 't1', name: 'Lower Box', venueSection: { name: 'Section 101' } },
    ...overrides,
  };
}

describe('PassTicket — ticket fields and pager', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the pass status', () => {
    render(<PassTicket pass={passFixture()} />);
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
  });

  it('shows a non-issued status', () => {
    render(<PassTicket pass={passFixture({ status: 'checked_in' })} />);
    expect(screen.getAllByText('Checked In').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the order number and ticket number', () => {
    render(<PassTicket pass={passFixture()} orderNumber="PS-20260822-ABC" />);
    expect(screen.getByText('PS-20260822-ABC')).toBeTruthy();
    expect(screen.getByText('pass-abc-123')).toBeTruthy();
  });

  it('shows hidden order number when not provided', () => {
    render(<PassTicket pass={passFixture()} />);
    expect(screen.getByText('Ticket No.')).toBeTruthy();
    expect(screen.queryByText('Order')).toBeNull();
  });

  it('shows a "Ticket X of Y" pager when total > 1 and hides it for a single ticket', () => {
    const { rerender } = render(<PassTicket pass={passFixture()} position={{ index: 0, total: 3 }} />);
    expect(screen.getByText('Ticket 1 of 3')).toBeTruthy();
    rerender(<PassTicket pass={passFixture()} position={{ index: 0, total: 1 }} />);
    expect(screen.queryByText('Ticket 1 of 1')).toBeNull();
  });

  it('shows the QR code for an issued pass', () => {
    render(<PassTicket pass={passFixture()} />);
    expect(screen.getByAltText('Pass QR code').getAttribute('src')).toBe('https://cloudinary.com/qr1.png');
  });

  it('shows the fallback token when no QR code url is set', () => {
    render(<PassTicket pass={passFixture({ qrCodeUrl: null })} />);
    expect(screen.getByText('tok-1')).toBeTruthy();
  });
});
