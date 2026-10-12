import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!supabase) return undefined;

        let mounted = true;
        const loadProfile = async (userId) => {
            if (!userId) {
                if (mounted) setProfile(null);
                return;
            }
            const { data, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, role, display_name')
                .eq('id', userId)
                .maybeSingle();
            if (!mounted) return;
            setProfile(data);
            setError(profileError?.message ?? (data ? '' : 'This account has no admin profile. Ask a super admin to provision it.'));
        };

        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setError('');
            setLoading(true);
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

    const value = useMemo(() => ({
        configured: isSupabaseConfigured,
        session,
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
        },
        async refreshProfile() {
            if (!session?.user?.id) return;
            const { data, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, role, display_name')
                .eq('id', session.user.id)
                .maybeSingle();
            if (profileError) throw profileError;
            setProfile(data);
        }
    }), [session, profile, loading, error]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider.');
    return context;
}
