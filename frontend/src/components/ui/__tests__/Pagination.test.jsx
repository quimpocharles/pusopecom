import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../Pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are zero pages', () => {
    const { container } = render(<Pagination page={1} totalPages={0} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('disables prev on page 1 and next on the last page', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText('‹')).toBeDisabled();
    expect(screen.getByText('›')).not.toBeDisabled();
  });

  it('calls onPageChange with the clicked page number', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('never calls onPageChange for the already-active page', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByText('2'));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('collapses distant pages into an ellipsis, keeping first/last and neighbors of current', () => {
    render(<Pagination page={5} totalPages={10} onPageChange={() => {}} />);
    // Expect: 1 ... 4 5 6 ... 10
    ['1', '4', '5', '6', '10'].forEach((p) => expect(screen.getByText(p)).toBeInTheDocument());
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('prev/next move by one page relative to the current page', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByText('‹'));
    expect(onPageChange).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByText('›'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
