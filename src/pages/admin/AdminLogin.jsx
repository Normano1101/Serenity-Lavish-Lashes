// The admin sign-in page. After signing in, the admin returns to the page they originally asked for.
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { ErrorMessage } from '../../components/Messages.jsx';

// Only ever return to an admin address, so a crafted link can't send someone elsewhere.
function getReturnPath(requestedPath) {
    const isAdminPath = typeof requestedPath === 'string'
        && /^\/admin(?:\/|$)/.test(requestedPath)
        && !requestedPath.includes('\\');
    return isAdminPath ? requestedPath : '/admin';
}

export default function AdminLogin() {
    const { configured, loading, user, signIn } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!configured) {
        return (
            <main className="admin-auth-page">
                <section className="admin-auth-card" aria-labelledby="admin-login-title">
                    <p className="eyebrow">Supabase setup required</p>
                    <h1 id="admin-login-title">Admin sign-in is not configured</h1>
                    <p>Add the Supabase project URL and publishable/anon key to your local environment, then apply the database migration.</p>
                    <p>The current <Link to="/admin">development dashboard</Link> is an unsecured localStorage demo. Do not enter real customer data there.</p>
                </section>
            </main>
        );
    }
    if (loading) return <main className="admin-auth-page"><p role="status">Checking your session…</p></main>;
    if (user) return <Navigate to="/admin" replace />;

    const submitLogin = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);
        const form = new FormData(event.currentTarget);
        try {
            await signIn(String(form.get('email')).trim(), String(form.get('password')));
            navigate(getReturnPath(location.state?.from?.pathname), { replace: true });
        } catch (loginError) {
            setError(`Could not sign in: ${loginError.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="admin-auth-page">
            <section className="admin-auth-card" aria-labelledby="admin-login-title">
                <p className="eyebrow">Private business tools</p>
                <h1 id="admin-login-title">Admin sign-in</h1>
                <p>Use the email address and password for your provisioned admin account.</p>
                <ErrorMessage>{error}</ErrorMessage>
                <form className="admin-login-form" onSubmit={submitLogin}>
                    <label>
                        Email
                        <input type="email" name="email" autoComplete="username" required />
                    </label>
                    <label>
                        Password
                        <input type="password" name="password" autoComplete="current-password" required />
                    </label>
                    <button type="submit" className="btn booking-btn" disabled={submitting}>
                        {submitting ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </section>
        </main>
    );
}
