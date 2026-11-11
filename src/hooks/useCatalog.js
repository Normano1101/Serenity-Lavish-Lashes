// Shared loading logic behind useServices and useServiceAddons. Loads a price-list table,
// reloads when it changes, and falls back to the starter list if the database isn't set up.
import { useCallback, useEffect, useState } from 'react';
import { subscribeToTable, supabase } from '../lib/supabase.js';

// catalog describes the table: { table, columns, channel, label, initialRows, canUseInitialRows, initialRowsMessage }.
// Customers see active rows only; admin screens pass includeInactive to see all of them.
export default function useCatalog(catalog, includeInactive) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(Boolean(supabase));
    const [error, setError] = useState('');
    const [usingInitialCatalog, setUsingInitialCatalog] = useState(false);

    const refresh = useCallback(async ({ showLoading = false } = {}) => {
        // Demo mode: customers see the starter list, and admins can't manage anything.
        if (!supabase) {
            setRows(includeInactive ? [] : catalog.initialRows);
            setLoading(false);
            setUsingInitialCatalog(!includeInactive);
            setError(includeInactive ? `Configure Supabase to manage shared ${catalog.label}s.` : '');
            return;
        }

        if (showLoading) setLoading(true);
        try {
            let query = supabase.from(catalog.table).select(catalog.columns).order('name');
            if (!includeInactive) query = query.eq('is_active', true);
            const { data, error: queryError } = await query;

            if (queryError) {
                // Customers still get a price list when the database just isn't set up yet.
                if (!includeInactive && catalog.canUseInitialRows(queryError)) {
                    setRows(catalog.initialRows);
                    setUsingInitialCatalog(true);
                    setError(catalog.initialRowsMessage);
                    return;
                }
                throw queryError;
            }
            setRows(data);
            setUsingInitialCatalog(false);
            setError('');
        } catch (queryError) {
            setError(`Could not load ${catalog.label}s: ${queryError.message}`);
        } finally {
            setLoading(false);
        }
    }, [catalog, includeInactive]);

    // Load once when the page opens, then again whenever the table changes.
    useEffect(() => {
        refresh({ showLoading: true });
        if (!supabase) return undefined;

        return subscribeToTable({
            channel: `${catalog.channel}-${includeInactive ? 'admin' : 'public'}`,
            table: catalog.table,
            onChange: refresh,
            onUnavailable: () => setError(`Live ${catalog.label} updates are unavailable. Reload or refresh to get the latest ${catalog.label}s.`)
        });
    }, [catalog, includeInactive, refresh]);

    return { rows, loading, error, usingInitialCatalog, refresh: () => refresh({ showLoading: true }) };
}
