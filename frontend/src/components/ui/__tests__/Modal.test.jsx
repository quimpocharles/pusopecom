import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with role="dialog" and aria-modal when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    // The backdrop is the outer fixed inset-0 element the portal renders.
    const backdrop = container.parentElement.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the header close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the panel on Tab', async () => {
    const user = userEvent.setup();
    // No title here on purpose: with a title, the header's own Close
    // button is the first focusable element in DOM order, which would
    // make this test couple to Modal's internal header markup instead of
    // testing the trap logic itself.
    render(
      <Modal open onClose={vi.fn()}>
        <button>First</button>
        <button>Last</button>
      </Modal>
    );

    const firstButton = screen.getByRole('button', { name: 'First' });
    const lastButton = screen.getByRole('button', { name: 'Last' });

    lastButton.focus();
    expect(document.activeElement).toBe(lastButton);

    await user.tab();
    // Tabbing past the last focusable element wraps back to the first.
    expect(document.activeElement).toBe(firstButton);
  });

  it('restores focus to the previously focused element on close', async () => {
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Open modal';
    document.body.appendChild(triggerButton);
    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Test">
        <button>Inside</button>
      </Modal>
    );

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Test">
        <button>Inside</button>
      </Modal>
    );

    expect(document.activeElement).toBe(triggerButton);
    document.body.removeChild(triggerButton);
  });

  it('locks body scroll while open and releases it on close', () => {
    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('');
  });
});
