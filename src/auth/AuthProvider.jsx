// Tracks who is signed in, so any page can call useAuth() to find out.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

// A user's role (owner, super_admin, ...) and name come from the profiles table.
function getProfile(userId) {
    return supabase
        .from('profiles')
        .select('id, email, role, display_name')
        .eq('id', userId)
        .maybeSingle();
}

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [error, setError] = useState('');

    // Restore a saved sign-in when the site opens, then follow later sign-ins and sign-outs.
    useEffect(() => {
        if (!supabase) return undefined;

        // `mounted` stops late responses from updating state after this component is gone.
        let mounted = true;
        const loadProfile = async (userId) => {
            if (!userId) {
                if (mounted) setProfile(null);
                return;
            }
            const { data, error: profileError } = await getProfile(userId);
            if (!mounted) return;
            setProfile(data);
            setError(profileError?.message ?? (data ? '' : 'This account has no admin profile. Ask a super admin to provision it.'));
        };

        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setError('');
            setLoading(true);
            // Supabase can freeze if it's called directly inside this callback, so wait a moment first.
            queueMicrotask(() => loadProfile(nextSession?.user?.id)
                .finally(() => {
                    if (mounted) setLoading(false);
                }));
        });

        supabase.auth.getSession()
            .then(async ({ data, error: sessionError }) => {
                if (!mounted) return;
                if (sessionError) throw sessionError;
                setSession(data.session);
                await loadProfile(data.session?.user?.id);
            })
            .catch((loadError) => {
                if (mounted) setError(`Could not restore your admin session: ${loadError.message}`);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    // Everything useAuth() gives to the rest of the site.
    const value = useMemo(() => ({
        configured: isSupabaseConfigured,
        user: session?.user ?? null,
        profile,
        loading,
        error,
        async signIn(email, password) {
            setError('');
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) throw signInError;
        },
        async signOut() {
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) throw signOutError;
        }
    }), [session, profile, loading, error]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider.');
    return context;
}
