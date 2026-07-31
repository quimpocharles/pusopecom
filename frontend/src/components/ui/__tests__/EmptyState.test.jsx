import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title in the existing gray-500 text-lg style', () => {
    render(<EmptyState title="No products found" />);
    const title = screen.getByText('No products found');
    expect(title).toHaveClass('text-gray-500', 'text-lg');
  });

  it('renders an optional description', () => {
    render(<EmptyState title="No orders found" description="Try adjusting your filters" />);
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('does not render an action button when no handler is given', () => {
    render(<EmptyState title="No products found" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button using the existing btn-secondary class', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState title="No products found" actionLabel="Clear Filters" onAction={onAction} />);
    const button = screen.getByRole('button', { name: 'Clear Filters' });
    expect(button).toHaveClass('btn-secondary');
    await user.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
