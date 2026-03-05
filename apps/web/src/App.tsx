import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/context';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CreateOrg from './pages/CreateOrg';
import AppLayout from './pages/AppLayout';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.orgId) return <Navigate to="/create-org" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
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
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

function ProtectedOrCreateOrg({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.orgId) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
