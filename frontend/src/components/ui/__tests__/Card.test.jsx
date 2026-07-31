import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Body content</Card>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('defaults to the bordered variant matching StatsCard/ReportCard', () => {
    render(<Card>Content</Card>);
    // No title is passed, so the text is a direct child with no wrapping
    // element — getByText resolves to the Card's own root div.
    const el = screen.getByText('Content');
    expect(el).toHaveClass('bg-white');
    expect(el).toHaveClass('rounded-xl');
    expect(el).toHaveClass('border');
    expect(el).toHaveClass('border-gray-200');
    expect(el).toHaveClass('p-6');
  });

  it('applies the existing .card class for the elevated variant', () => {
    render(<Card variant="elevated">Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('card');
  });

  it('renders an optional title matching ReportCard\'s heading style', () => {
    render(<Card title="Sales This Month">Content</Card>);
    const heading = screen.getByText('Sales This Month');
    expect(heading.tagName).toBe('H3');
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'text-gray-900');
  });

  it('respects a custom padding override', () => {
    render(<Card variant="elevated" padding="p-8">Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('p-8');
  });
});
