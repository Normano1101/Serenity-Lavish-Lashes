import { useCallback, useEffect, useState } from 'react';
import { loadAdminAppointments, subscribeToAdminAppointments } from '../data/adminAppointments.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

// Keep database appointments and local demo appointments in sync with the dashboard.
export default function useAppointments({ demoOnly = false } = {}) {
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Reload when storage changes and expose failures instead of hiding them.
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            if (demoOnly && isSupabaseConfigured) {
                setAppointments([]);
                setError('');
                return;
            }
            const result = await loadAdminAppointments();
            setAppointments(result);
            setError('');
        } catch (loadError) {
            setError(`Could not load appointments: ${loadError.message}`);
        } finally {
            setLoading(false);
        }
    }, [demoOnly]);

    useEffect(() => {
        refresh();
        if (demoOnly && isSupabaseConfigured) return undefined;
        return subscribeToAdminAppointments(refresh, setError);
    }, [demoOnly, refresh]);

    return { appointments, error, loading, refresh };
}
