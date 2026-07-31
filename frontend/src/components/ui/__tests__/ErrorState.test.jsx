import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorState from '../ErrorState';

describe('ErrorState', () => {
  it('renders a default title with role="alert"', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('renders the message in the existing red-600 error color', () => {
    render(<ErrorState title="Failed to load orders" />);
    expect(screen.getByText('Failed to load orders')).toHaveClass('text-red-600');
  });

  it('does not render a retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a retry button and calls onRetry when clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: 'Try Again' });
    expect(button).toHaveClass('btn-outline');
    await user.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('supports a custom retry label', () => {
    render(<ErrorState onRetry={() => {}} retryLabel="Reload" />);
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
