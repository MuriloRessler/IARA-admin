import { AccessDenied } from './components/AccessDenied.jsx';
import { AuthLoading } from './components/AuthLoading.jsx';
import { LoginPage } from './components/LoginPage.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import './styles/global.css';

function ProtectedApplication() {
  const { phase, admin, error, signIn, signOut, retryAuthorization } = useAuth();

  if (phase === 'loading' || phase === 'verifying') return <AuthLoading />;
  if (phase === 'configuration_error') return <LoginPage configurationError />;
  if (phase === 'signing_in' || phase === 'unauthenticated') {
    return <LoginPage onSubmit={signIn} isSubmitting={phase === 'signing_in'} error={error} />;
  }
  if (phase === 'unauthorized' || phase === 'authorization_error') {
    return <AccessDenied onRetry={retryAuthorization} onLogout={signOut} isConnectionError={phase === 'authorization_error'} />;
  }
  return <Dashboard admin={admin} onLogout={signOut} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedApplication />
    </AuthProvider>
  );
}
