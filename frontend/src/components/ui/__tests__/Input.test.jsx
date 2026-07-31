import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '../Input';

describe('Input', () => {
  it('applies the existing .input-field class', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toHaveClass('input-field');
  });

  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it('renders an error message matching the existing red-600 error style', () => {
    render(<Input label="Password" error="Password is required" />);
    const error = screen.getByText('Password is required');
    expect(error).toHaveClass('text-red-600', 'text-sm');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders helper text only when there is no error', () => {
    render(<Input label="Phone" helperText="Include country code" />);
    expect(screen.getByText('Include country code')).toBeInTheDocument();
  });

  it('does not render helper text when an error is present', () => {
    render(<Input label="Phone" helperText="Include country code" error="Required" />);
    expect(screen.queryByText('Include country code')).not.toBeInTheDocument();
  });

  it('forwards a ref to the underlying input, as react-hook-form register() requires', () => {
    const ref = createRef();
    render(<Input label="Name" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('accepts typed input, confirming the ref/value wiring works end to end', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    await user.type(input, 'Gilas');
    expect(input).toHaveValue('Gilas');
  });
});
