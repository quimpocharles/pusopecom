import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Panel from '../Panel';

describe('Panel', () => {
  it('renders children', () => {
    render(<Panel>Body content</Panel>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders the shared .card treatment — no separate elevated variant', () => {
    render(<Panel>Content</Panel>);
    // No title is passed, so the text is a direct child with no wrapping
    // element — getByText resolves to the Panel's own root div.
    const el = screen.getByText('Content');
    expect(el).toHaveClass('card');
    expect(el).toHaveClass('p-6');
  });

  it('renders an optional title in the editorial title voice', () => {
    render(<Panel title="Sales This Month">Content</Panel>);
    const heading = screen.getByText('Sales This Month');
    expect(heading.tagName).toBe('H3');
    expect(heading).toHaveClass('text-editorial-title', 'font-semibold', 'text-ink-900');
  });

  it('respects a custom padding override', () => {
    render(<Panel padding="p-8">Content</Panel>);
    expect(screen.getByText('Content')).toHaveClass('p-8');
  });
});
