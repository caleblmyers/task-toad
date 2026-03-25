import { Suspense, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/context';
import ErrorBoundary from './components/ErrorBoundary';
import RouteErrorBoundary from './components/shared/RouteErrorBoundary';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CreateOrg from './pages/CreateOrg';
import AppLayout from './pages/AppLayout';
import { SSEProvider } from './hooks/useEventSource';
import Home from './pages/Home';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy-load heavy route components for code-splitting
const ProjectDetail = lazyWithRetry(() => import('./pages/ProjectDetail'));
const Portfolio = lazyWithRetry(() => import('./pages/Portfolio'));
const OrgSettings = lazyWithRetry(() => import('./pages/OrgSettings'));
const Search = lazyWithRetry(() => import('./pages/Search'));
const NewProject = lazyWithRetry(() => import('./pages/NewProject'));
const Projects = lazyWithRetry(() => import('./pages/Projects'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));

const routeSpinner = (
  <div className="flex items-center justify-center p-8">
    <div className="w-8 h-8 border-2 border-slate-300 border-t-brand-green rounded-full animate-spin" />
  </div>
);

function LazyRoute({ Component }: { Component: React.LazyExoticComponent<ComponentType<unknown>> }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={routeSpinner}>
        <Component />
      </Suspense>
    </RouteErrorBoundary>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.orgId) return <Navigate to="/create-org" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-brand-green rounded-full animate-spin" />
          </div>
        }
      >
        <Routes key={user?.userId ?? 'logged-out'}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route
            path="/create-org"
            element={
              <ProtectedOrCreateOrg>
                <CreateOrg />
              </ProtectedOrCreateOrg>
            }
          />
          <Route
            path="/app"
            element={
              <Protected>
                <SSEProvider>
                  <AppLayout />
                </SSEProvider>
              </Protected>
            }
          >
            <Route index element={<Home />} />
            <Route path="portfolio" element={<LazyRoute Component={Portfolio} />} />
            <Route path="projects" element={<LazyRoute Component={Projects} />} />
            <Route path="projects/new" element={<LazyRoute Component={NewProject} />} />
            <Route path="projects/:projectId" element={<LazyRoute Component={ProjectDetail} />} />
            <Route path="search" element={<LazyRoute Component={Search} />} />
            <Route path="profile" element={<LazyRoute Component={ProfilePage} />} />
            <Route path="settings" element={<LazyRoute Component={OrgSettings} />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedOrCreateOrg({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.orgId) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
