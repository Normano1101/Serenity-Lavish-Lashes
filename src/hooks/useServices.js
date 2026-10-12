import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { INITIAL_LASH_CATALOG, SERVICE_COLUMNS } from '../data/services.js';

function canUseInitialCatalog(queryError) {
    return queryError.code === '42703'
        || queryError.code === 'PGRST204'
        || (queryError.code === '42501' && /permission denied for function is_business_admin/i.test(queryError.message))
        || /column .* does not exist|schema cache/i.test(queryError.message);
}

function getInitialServices() {
    return INITIAL_LASH_CATALOG.flatMap(({ fill, ...fullService }) => [
        fullService,
        fill
    ]);
}

export default function useServices({ includeInactive = false } = {}) {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [error, setError] = useState('');
    const [usingInitialCatalog, setUsingInitialCatalog] = useState(false);

    const refresh = useCallback(async ({ showLoading = false } = {}) => {
        if (!supabase) {
            setServices(includeInactive ? [] : getInitialServices());
            setLoading(false);
            setUsingInitialCatalog(!includeInactive);
            setError(includeInactive ? 'Configure Supabase to manage shared services.' : '');
            return;
        }

        if (showLoading) setLoading(true);
        try {
            const query = supabase.from('services').select(SERVICE_COLUMNS).order('name');
            const { data, error: queryError } = includeInactive
                ? await query
                : await query.eq('is_active', true);
            if (queryError) {
                if (!includeInactive && canUseInitialCatalog(queryError)) {
                    setServices(getInitialServices());
                    setUsingInitialCatalog(true);
                    setError('Showing the initial price list because this Supabase project needs the service migrations and public-read permission fix. Apply migrations 20261012020000, 20261012030000, and 20261012040000 to enable shared, admin-managed prices.');
                    return;
                }
                throw queryError;
            }
            setServices(data);
            setUsingInitialCatalog(false);
            setError('');
        } catch (queryError) {
            setError(`Could not load services: ${queryError.message}`);
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => {
        refresh({ showLoading: true });
        if (!supabase) return undefined;

        const channel = supabase
            .channel(`services-${includeInactive ? 'admin' : 'public'}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'services'
            }, () => {
                refresh();
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setError('Live service updates are unavailable. Reload or refresh to get the latest services.');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [includeInactive, refresh]);

    return {
        services,
        loading,
        error,
        usingInitialCatalog,
        refresh: () => refresh({ showLoading: true })
    };
}
