import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TryOnEntryScreen from '../TryOnEntryScreen';

describe('TryOnEntryScreen', () => {
  it('makes Take Photo the primary (btn-primary) action when a camera exists', () => {
    render(<TryOnEntryScreen hasCamera={true} onTakePhoto={() => {}} onUploadPhoto={() => {}} />);
    expect(screen.getByRole('button', { name: /Take Photo/ })).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: /Upload Existing Photo/ })).not.toHaveClass('btn-primary');
  });

  it('promotes Upload Existing Photo to primary (accent-colored) and disables Take Photo when no camera exists', () => {
    render(<TryOnEntryScreen hasCamera={false} onTakePhoto={() => {}} onUploadPhoto={() => {}} />);
    expect(screen.getByRole('button', { name: /Upload Existing Photo/ })).toHaveClass('bg-[#6de7ff]');
    expect(screen.getByRole('button', { name: /Take Photo/ })).toBeDisabled();
  });

  it('treats hasCamera === null (still checking) as camera-primary, not disabled', () => {
    render(<TryOnEntryScreen hasCamera={null} onTakePhoto={() => {}} onUploadPhoto={() => {}} />);
    expect(screen.getByRole('button', { name: /Take Photo/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Take Photo/ })).toHaveClass('btn-primary');
  });

  it('calls onTakePhoto and onUploadPhoto when their buttons are clicked', async () => {
    const onTakePhoto = vi.fn();
    const onUploadPhoto = vi.fn();
    const user = userEvent.setup();
    render(<TryOnEntryScreen hasCamera={true} onTakePhoto={onTakePhoto} onUploadPhoto={onUploadPhoto} />);

    await user.click(screen.getByRole('button', { name: /Take Photo/ }));
    expect(onTakePhoto).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Upload Existing Photo/ }));
    expect(onUploadPhoto).toHaveBeenCalledTimes(1);
  });

  it('renders an optional notice message', () => {
    render(
      <TryOnEntryScreen hasCamera={false} onTakePhoto={() => {}} onUploadPhoto={() => {}} notice="Camera unavailable." />
    );
    expect(screen.getByText('Camera unavailable.')).toBeInTheDocument();
  });
});
