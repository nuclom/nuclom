import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandBar } from './command-bar';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('CommandBar Component', () => {
  it('should render search button', () => {
    render(<CommandBar organization="test-org" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should have keyboard shortcut in button', () => {
    render(<CommandBar organization="test-org" />);

    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('should render with organization prop', () => {
    const { container } = render(<CommandBar organization="my-org" />);

    expect(container.firstChild).toBeInTheDocument();
  });
});
