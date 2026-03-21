import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { gql } from '../api/client';
import { ME_QUERY, LOGIN_MUTATION, SIGNUP_MUTATION, LOGOUT_MUTATION } from '../api/queries';
import type { MeResponse } from '../types';

type AuthState = {
  user: MeResponse | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async (): Promise<MeResponse | null> => {
    // Cookie is sent automatically — just call the me query
    try {
      const data = await gql<{ me: MeResponse | null }>(ME_QUERY);
      return data.me;
    } catch {
      return null;
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
  }, [fetchMe]);

  useEffect(() => {
    fetchMe().then((me) => {
      setUser(me);
      setLoading(false);
    });
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await gql<{ login: { token: string } }>(
          LOGIN_MUTATION,
          { email, password }
        );
        // Cookie is set automatically by the server response
        const me = await fetchMe();
        setUser(me);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Login failed';
        setError(msg);
        throw err;
      }
    },
    [fetchMe]
  );

  const signup = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await gql<{ signup: boolean }>(
        SIGNUP_MUTATION,
        { email, password }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await gql<{ logout: boolean }>(LOGOUT_MUTATION);
    } catch {
      // Cookies are cleared by the server response
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, signup, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
