import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentAdmin } from '../services/api.js';
import { isSupabaseConfigured, supabase } from '../services/supabase.js';

const AuthContext = createContext(null);

const initialState = {
  phase: 'loading',
  session: null,
  admin: null,
  error: null,
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [session, setSession] = useState(null);
  const [authorizationAttempt, setAuthorizationAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({ phase: 'configuration_error', session: null, admin: null, error: null });
      return undefined;
    }

    let active = true;
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        setState({ phase: 'unauthenticated', session: null, admin: null, error });
        return;
      }

      setSession(data.session);
      setState((current) => ({
        ...current,
        phase: data.session ? 'verifying' : 'unauthenticated',
        session: data.session,
        error: null,
      }));
    };

    loadSession();
    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setState((current) => ({
        ...current,
        phase: nextSession ? 'verifying' : 'unauthenticated',
        session: nextSession,
        admin: null,
        error: null,
      }));
    });

    return () => {
      active = false;
      subscriptionData.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    let active = true;
    setState((current) => ({ ...current, phase: 'verifying', error: null }));

    getCurrentAdmin(session.access_token)
      .then((admin) => {
        if (active) setState((current) => ({ ...current, phase: 'authorized', admin, error: null }));
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, phase: error.status === 403 ? 'unauthorized' : 'authorization_error', admin: null, error }));
      });

    return () => {
      active = false;
    };
  }, [session, authorizationAttempt]);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      const error = new Error('Supabase is not configured');
      error.code = 'CONFIGURATION_ERROR';
      throw error;
    }

    setState((current) => ({ ...current, phase: 'signing_in', error: null }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((current) => ({ ...current, phase: 'unauthenticated', error }));
      throw error;
    }

    setSession(data.session);
    setState((current) => ({ ...current, phase: 'verifying', session: data.session, error: null }));
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setState({ phase: 'unauthenticated', session: null, admin: null, error: null });
  }, []);

  const retryAuthorization = useCallback(() => {
    setAuthorizationAttempt((attempt) => attempt + 1);
  }, []);

  const value = useMemo(() => ({
    ...state,
    signIn,
    signOut,
    retryAuthorization,
  }), [state, signIn, signOut, retryAuthorization]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
