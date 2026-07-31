import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '../Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Sale</Badge>);
    expect(screen.getByText('Sale')).toBeInTheDocument();
  });

  it('applies the base .badge class and defaults to primary tone', () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText('Default');
    expect(el).toHaveClass('badge');
    expect(el).toHaveClass('badge-primary');
  });

  it.each([
    ['secondary', 'badge-secondary'],
    ['accent', 'badge-accent'],
    ['success', 'badge-success'],
  ])('maps tone="%s" to the existing .%s class', (tone, expectedClass) => {
    render(<Badge tone={tone}>Badge</Badge>);
    expect(screen.getByText('Badge')).toHaveClass(expectedClass);
  });
});
