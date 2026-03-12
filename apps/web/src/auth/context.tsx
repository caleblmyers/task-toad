import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { gql, TOKEN_KEY } from '../api/client';
import type { MeResponse } from '../types';

type AuthState = {
  user: MeResponse | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async (): Promise<MeResponse | null> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const data = await gql<{ me: MeResponse | null }>('query { me { userId email orgId role emailVerifiedAt } }');
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
        const data = await gql<{ login: { token: string } }>(
          `mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) { token }
          }`,
          { email, password }
        );
        localStorage.setItem(TOKEN_KEY, data.login.token);
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
        `mutation Signup($email: String!, $password: String!) {
          signup(email: $email, password: $password)
        }`,
        { email, password }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
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
