import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Add to Cart</Button>);
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
  });

  it('applies the btn-primary class by default', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it.each([
    ['primary', 'btn-primary'],
    ['secondary', 'btn-secondary'],
    ['text', 'btn-text'],
  ])('maps variant="%s" to the existing .%s class', (variant, expectedClass) => {
    render(<Button variant={variant}>Button</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('adds w-full when fullWidth is set', () => {
    render(<Button fullWidth>Checkout</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled attribute', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards a ref to the underlying button element', () => {
    let ref;
    function Wrapper() {
      ref = { current: null };
      return <Button ref={(el) => { ref.current = el; }}>Ref test</Button>;
    }
    render(<Wrapper />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
