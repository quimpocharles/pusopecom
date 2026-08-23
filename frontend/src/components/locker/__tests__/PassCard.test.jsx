import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PassCard from '../../locker/PassCard';

function passFixture(overrides = {}) {
  return {
    _id: 'p1', status: 'issued', qrToken: 'tok-1', qrCodeUrl: 'https://cloudinary.com/qr1.png',
    price: 600,
    passEvent: { _id: 'e1', name: 'UAAP Finals', images: ['https://img.test/evt.jpg'], startsAt: '2026-09-01T18:00:00Z', venue: { name: 'Araneta Coliseum' }, organization: { name: 'UAAP' } },
    passTier: { _id: 't1', name: 'Lower Box', venueSection: { name: 'Section 101' } },
    ...overrides,
  };
}

describe('PassCard — digital ticket at a glance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows event name, venue, date, tier and section', () => {
    render(<PassCard pass={passFixture()} onViewTicket={() => {}} />);
    expect(screen.getByText('UAAP Finals')).toBeTruthy();
    expect(screen.getByText('Araneta Coliseum')).toBeTruthy();
    expect(screen.getByText('Lower Box')).toBeTruthy();
    expect(screen.getByText(/Section 101/)).toBeTruthy();
  });

  it('shows the QR code image for an issued pass', () => {
    render(<PassCard pass={passFixture()} onViewTicket={() => {}} />);
    expect(screen.getByAltText('Pass QR code').getAttribute('src')).toBe('https://cloudinary.com/qr1.png');
  });

  it('calls onViewTicket when View Ticket is tapped', () => {
    const onView = vi.fn();
    render(<PassCard pass={passFixture()} onViewTicket={onView} />);
    fireEvent.click(screen.getByText('View Ticket'));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('hides the QR and marks a non-issued pass with its status', () => {
    render(<PassCard pass={passFixture({ status: 'checked_in', qrCodeUrl: null })} onViewTicket={() => {}} />);
    expect(screen.queryByAltText('Pass QR code')).toBeNull();
    expect(screen.getByText('Checked In')).toBeTruthy();
  });
});
