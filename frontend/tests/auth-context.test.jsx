import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext.jsx';
import { getCurrentAdmin } from '../src/services/api.js';
import { supabase } from '../src/services/supabase.js';

vi.mock('../src/services/supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../src/services/api.js', () => ({
  getCurrentAdmin: vi.fn(),
}));

function AuthHarness() {
  const { phase, admin, signOut } = useAuth();
  return (
    <div>
      <span data-testid="phase">{phase}</span>
      <span data-testid="admin">{admin?.email || ''}</span>
      <button type="button" onClick={signOut}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token', user: { id: 'admin-user-id' } } },
      error: null,
    });
    getCurrentAdmin.mockResolvedValue({ id: 'admin-user-id', email: 'admin@example.com', role: 'admin' });
  });

  it('does not expose the authorized state before backend authorization completes', async () => {
    let resolveAuthorization;
    getCurrentAdmin.mockReturnValue(new Promise((resolve) => { resolveAuthorization = resolve; }));
    render(<AuthProvider><AuthHarness /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('verifying'));
    expect(screen.getByTestId('admin')).toHaveTextContent('');
    resolveAuthorization({ id: 'admin-user-id', email: 'admin@example.com', role: 'admin' });
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('authorized'));
  });

  it('clears the authenticated state after logout', async () => {
    render(<AuthProvider><AuthHarness /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('authorized'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('admin')).toHaveTextContent('');
    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });
});
