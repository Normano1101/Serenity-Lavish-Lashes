import { useCallback, useEffect, useState } from 'react';
import { INITIAL_SERVICE_ADDONS } from '../data/services.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

// Recognize schema/setup errors for which the bundled public list is a valid fallback.
function canUseInitialAddons(queryError) {
    return queryError.code === '42P01'
        || queryError.code === 'PGRST205'
        || (queryError.code === '42501' && /permission denied for function is_business_admin/i.test(queryError.message))
        || /could not find the table .*service_addons.*schema cache/i.test(queryError.message);
}

// Fetch active add-ons for customers or all add-ons for admin management.
export default function useServiceAddons({ includeInactive = false } = {}) {
    const [addons, setAddons] = useState([]);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [error, setError] = useState('');
    const [usingInitialCatalog, setUsingInitialCatalog] = useState(false);

    // Load add-ons, using starter data only when public catalog access is unavailable.
    const refresh = useCallback(async ({ showLoading = false } = {}) => {
        if (!supabase) {
            setAddons(includeInactive ? [] : INITIAL_SERVICE_ADDONS);
            setLoading(false);
            setUsingInitialCatalog(!includeInactive);
            setError(includeInactive ? 'Configure Supabase to manage shared add-ons.' : '');
            return;
        }

        if (showLoading) setLoading(true);
        try {
            let query = supabase
                .from('service_addons')
                .select('id, name, description, price, is_active')
                .order('name');
            if (!includeInactive) query = query.eq('is_active', true);
            const { data, error: queryError } = await query;
            if (queryError) {
                if (!includeInactive && canUseInitialAddons(queryError)) {
                    setAddons(INITIAL_SERVICE_ADDONS);
                    setUsingInitialCatalog(true);
                    setError('Showing initial add-ons. Apply migrations 20261012030000 and 20261012040000 to enable shared, admin-managed add-ons.');
                    return;
                }
                throw queryError;
            }
            setAddons(data);
            setUsingInitialCatalog(false);
            setError('');
        } catch (queryError) {
            setError(`Could not load add-ons: ${queryError.message}`);
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    // Refresh on mount and subscribe to shared catalog changes when configured.
    useEffect(() => {
        refresh({ showLoading: true });
        if (!supabase) return undefined;

        const channel = supabase
            .channel(`service-addons-${includeInactive ? 'admin' : 'public'}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'service_addons'
            }, () => refresh())
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setError('Live add-on updates are unavailable. Reload or refresh to get the latest add-ons.');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [includeInactive, refresh]);

    return {
        addons,
        loading,
        error,
        usingInitialCatalog,
        refresh: () => refresh({ showLoading: true })
    };
}
