import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { supabase } from '../../lib/supabase.js';

// Let super admins review profiles and assign roles through the protected database RPC.
export default function AdminAccounts() {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Fetch profiles in email order for the role-management list.
    const loadAccounts = async () => {
        setLoading(true);
        setError('');
        const { data, error: loadError } = await supabase
            .from('profiles')
            .select('id, email, role, display_name')
            .order('email');
        if (loadError) setError(`Could not load admin accounts: ${loadError.message}`);
        else setAccounts(data ?? []);
        setLoading(false);
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    // Save a role change and reload the authoritative profile list.
    const changeRole = async (account, role) => {
        setSavingId(account.id);
        setError('');
        setMessage('');
        const { error: roleError } = await supabase.rpc('manage_admin_role', {
            target_user_id: account.id,
            new_role: role
        });
        if (roleError) {
            setError(`Could not update this role: ${roleError.message}`);
        } else {
            setMessage(`Updated ${account.email} to ${role}.`);
            await loadAccounts();
        }
        setSavingId('');
    };

    return (
        <section className="admin-panel admin-accounts-panel">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Super Admin only</p>
                    <h2>Admin accounts</h2>
                </div>
            </div>
            <p>Create user accounts in Supabase Authentication first. New users have no admin access until a Super Admin assigns a role here. Your own role cannot be changed from this screen.</p>
            {error && <p className="form-message form-error" role="alert">{error}</p>}
            {message && <p className="form-message form-success" role="status">{message}</p>}
            {loading ? <p role="status">Loading accounts…</p> : (
                <div className="admin-account-list">
                    {accounts.map((account) => (
                        <article className="admin-account-card" key={account.id}>
                            <div>
                                <strong>{account.display_name || account.email || account.id}</strong>
                                {account.display_name && <span>{account.email}</span>}
                                <small>Current role: {account.role}</small>
                            </div>
                            <label>
                                Admin role
                                <select
                                    value={account.role}
                                    disabled={savingId === account.id || account.id === user?.id}
                                    onChange={(event) => changeRole(account, event.target.value)}
                                >
                                    <option value="unassigned">No admin access</option>
                                    <option value="owner">Owner</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </label>
                        </article>
                    ))}
                    {!accounts.length && <p>No profiles are available.</p>}
                </div>
            )}
        </section>
    );
}
