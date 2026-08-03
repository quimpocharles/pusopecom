import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateRangeSelector, { getDateRange } from '../DateRangeSelector';

describe('getDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('today: start and end are both today', () => {
    expect(getDateRange('today')).toEqual({ startDate: '2026-08-15', endDate: '2026-08-15' });
  });

  it('yesterday: start and end are both yesterday, not today', () => {
    expect(getDateRange('yesterday')).toEqual({ startDate: '2026-08-14', endDate: '2026-08-14' });
  });

  it('lastMonth: spans the full previous calendar month', () => {
    expect(getDateRange('lastMonth')).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });

  it('lastMonth at a year boundary rolls back to December of the prior year', () => {
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
    expect(getDateRange('lastMonth')).toEqual({ startDate: '2025-12-01', endDate: '2025-12-31' });
  });

  it('ytd: starts January 1st of the current year, ends today', () => {
    expect(getDateRange('ytd')).toEqual({ startDate: '2026-01-01', endDate: '2026-08-15' });
  });

  it('all: both bounds null (no filter)', () => {
    expect(getDateRange('all')).toEqual({ startDate: null, endDate: null });
  });
});

describe('DateRangeSelector', () => {
  it('calls onSelect with the preset value and its computed range', () => {
    const onSelect = vi.fn();
    render(<DateRangeSelector selected="30d" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Yesterday'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [preset, range] = onSelect.mock.calls[0];
    expect(preset).toBe('yesterday');
    expect(range).toHaveProperty('startDate');
    expect(range).toHaveProperty('endDate');
  });

  it('reveals custom start/end inputs and only applies once both are filled', () => {
    const onSelect = vi.fn();
    render(<DateRangeSelector selected="30d" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Custom Range'));
    const [startInput, endInput] = screen.getAllByDisplayValue('');
    const applyButton = screen.getByText('Apply');
    expect(applyButton).toBeDisabled();

    fireEvent.change(startInput, { target: { value: '2026-08-01' } });
    expect(applyButton).toBeDisabled(); // end still empty

    fireEvent.change(endInput, { target: { value: '2026-08-10' } });
    expect(applyButton).not.toBeDisabled();

    fireEvent.click(applyButton);
    expect(onSelect).toHaveBeenCalledWith('custom', { startDate: '2026-08-01', endDate: '2026-08-10' });
  });
});
