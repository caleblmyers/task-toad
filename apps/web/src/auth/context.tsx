import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  type CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import type { MeResponse } from '../types';

const poolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string;

const userPool =
  poolId && clientId
    ? new CognitoUserPool({ UserPoolId: poolId, ClientId: clientId })
    : null;

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

const ID_TOKEN_KEY = 'task-toad-id-token';

function getCognitoUser(email: string): CognitoUser {
  return new CognitoUser({
    Username: email,
    Pool: userPool!,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const BASE = (import.meta.env.VITE_API_URL as string) ?? '';

  const fetchMe = useCallback(async (): Promise<MeResponse | null> => {
    const token = localStorage.getItem(ID_TOKEN_KEY);
    if (!token) return null;
    const res = await fetch(`${BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  }, [BASE]);

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
      if (!userPool) {
        setError('Cognito not configured');
        return;
      }
      setError(null);
      return new Promise<void>((resolve, reject) => {
        const cognitoUser = getCognitoUser(email);
        cognitoUser.authenticateUser(
          new AuthenticationDetails({ Username: email, Password: password }),
          {
            onSuccess: (result) => {
              const idToken = result.getIdToken().getJwtToken();
              localStorage.setItem(ID_TOKEN_KEY, idToken);
              fetchMe().then((me) => {
                setUser(me);
                resolve();
              });
            },
            onFailure: (err) => {
              setError(err.message ?? 'Login failed');
              reject(err);
            },
          }
        );
      });
    },
    [fetchMe]
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      if (!userPool) {
        setError('Cognito not configured');
        return;
      }
      setError(null);
      return new Promise<void>((resolve, reject) => {
        userPool.signUp(
          email,
          password,
          [new CognitoUserAttribute({ Name: 'email', Value: email })],
          [],
          (err) => {
            if (err) {
              setError(err.message ?? 'Signup failed');
              reject(err);
              return;
            }
            resolve();
          }
        );
      });
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(ID_TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, signup, logout, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
