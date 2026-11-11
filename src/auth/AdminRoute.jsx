// The gatekeeper for admin pages: only signed-in owners and super admins get through.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout.jsx';
import { useAuth } from './AuthProvider.jsx';

// A plain page explaining why the admin dashboard isn't showing.
function AccessMessage({ children }) {
    return (
        <SiteLayout>
            <main className="admin-auth-page">{children}</main>
        </SiteLayout>
    );
}

export default function AdminRoute() {
    const { configured, loading, user, profile, error } = useAuth();
    const location = useLocation();

    // Demo mode has no accounts, so anyone can view the demo dashboard.
    if (!configured) return <Outlet />;
    if (loading) return <AccessMessage><p role="status">Checking admin access…</p></AccessMessage>;
    if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />;

    if (error || !profile) {
        return (
            <AccessMessage>
                <section className="admin-auth-card">
                    <h1>Admin access is not configured</h1>
                    <p role="alert">{error || 'This account does not have an admin profile.'}</p>
                </section>
            </AccessMessage>
        );
    }
    if (!['owner', 'super_admin'].includes(profile.role)) {
        return (
            <AccessMessage>
                <section className="admin-auth-card">
                    <h1>Admin access has not been granted</h1>
                    <p>Your account is signed in but does not have an admin role. Contact the business administrator.</p>
                </section>
            </AccessMessage>
        );
    }
    return <Outlet />;
}
