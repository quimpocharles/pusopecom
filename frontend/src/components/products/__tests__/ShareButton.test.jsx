import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from '../ShareButton';

const props = { title: 'Adamson University Classic Tee', text: 'Check it out!', url: 'https://pusostore.test/products/adamson-tee' };

describe('ShareButton', () => {
  afterEach(() => {
    delete navigator.share;
  });

  it('calls navigator.share directly when supported, with no dropdown', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    navigator.share = share;
    const user = userEvent.setup();
    render(<ShareButton {...props} />);

    await user.click(screen.getByRole('button', { name: /Share/ }));
    expect(share).toHaveBeenCalledWith({ title: props.title, text: props.text, url: props.url });
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });

  it('opens a dropdown with Copy Link and share targets when navigator.share is unsupported', async () => {
    const user = userEvent.setup();
    render(<ShareButton {...props} />);

    await user.click(screen.getByRole('button', { name: /Share/ }));
    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Facebook/ })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent(props.url))
    );
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Share on X$/ })).toBeInTheDocument();
  });

  it('copies the link to the clipboard and shows confirmation', async () => {
    // fireEvent rather than userEvent here deliberately: userEvent v14's
    // click simulation does its own internal clipboard feature-detection
    // that conflicts with a mocked navigator.clipboard, silently
    // swallowing the click before it reaches the button's onClick at all.
    // fireEvent dispatches the click directly with no such interference.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareButton {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Share/ }));
    fireEvent.click(screen.getByText('Copy link'));

    expect(writeText).toHaveBeenCalledWith(props.url);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });
});
