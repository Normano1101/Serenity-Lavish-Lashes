import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';

export default function AdminRoute({ children, requiredRole }) {
    const { configured, loading, user, profile, error } = useAuth();
    const location = useLocation();

    if (!configured) return children ?? <Outlet />;
    if (loading) {
        return <main className="admin-auth-page"><p role="status">Checking admin access…</p></main>;
    }
    if (!user) {
        return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }
    if (error || !profile) {
        return (
            <main className="admin-auth-page">
                <section className="admin-auth-card">
                    <h1>Admin access is not configured</h1>
                    <p role="alert">{error || 'This account does not have an admin profile.'}</p>
                </section>
            </main>
        );
    }
    if (!['owner', 'super_admin'].includes(profile.role)) {
        return (
            <main className="admin-auth-page">
                <section className="admin-auth-card">
                    <h1>Admin access has not been granted</h1>
                    <p>Your account is signed in but does not have an admin role. Contact the business administrator.</p>
                </section>
            </main>
        );
    }
    if (requiredRole && profile.role !== requiredRole) {
        return <Navigate to="/admin" replace />;
    }
    return children ?? <Outlet />;
}
