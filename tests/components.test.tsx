import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../src/components/common/Avatar';
import { Button } from '../src/components/common/Button';

describe('UI Common Components', () => {
  it('renders Avatar with initials when no image source is provided', () => {
    render(<Avatar name="Krishnendu Pal" size="md" />);
    expect(screen.getByText('KP')).toBeInTheDocument();
  });

  it('renders Button with variants and children', () => {
    render(<Button variant="primary">Click Me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('renders disabled state when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });
});
