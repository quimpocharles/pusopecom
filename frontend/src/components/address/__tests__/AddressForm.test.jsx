import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import AddressForm from '../AddressForm';

// select-philippines-address hits a third-party GitHub Pages JSON endpoint
// and, per its own source, resolves to e.message (a string) instead of
// rejecting when that fetch fails — this is exactly what happened in
// production and crashed the whole page with "u.map is not a function"
// once regionList.map() ran against a string. Simulating that failure mode
// directly rather than the happy path, since that's the case that broke.
vi.mock('select-philippines-address', () => ({
  regions: vi.fn().mockResolvedValue('Network Error'),
  provinces: vi.fn().mockResolvedValue('Network Error'),
  cities: vi.fn().mockResolvedValue('Network Error'),
  barangays: vi.fn().mockResolvedValue('Network Error'),
}));

function Harness() {
  const { register, formState: { errors }, setValue, watch } = useForm({
    defaultValues: { country: 'Philippines' },
  });
  return <AddressForm register={register} errors={errors} setValue={setValue} watch={watch} />;
}

describe('AddressForm — a failed PSGC address lookup must not crash the page', () => {
  it('renders normally when regions() resolves to a string instead of an array', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText('Select Region')).toBeInTheDocument();
    });

    // Only the "Select Region" placeholder should be present — no options
    // were derived from the failed (string) response, and no crash occurred.
    // Labels aren't programmatically linked to these selects (no htmlFor),
    // so select by role position: Country, then Region.
    const [, regionSelect] = screen.getAllByRole('combobox');
    expect(regionSelect.querySelectorAll('option')).toHaveLength(1);
  });
});
