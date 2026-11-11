// Load the lash services. Use: const { services, loading, error, refresh } = useServices();
import { INITIAL_SERVICES, SERVICE_COLUMNS } from '../data/services.js';
import useCatalog from './useCatalog.js';

const SERVICES_CATALOG = {
    table: 'services',
    columns: SERVICE_COLUMNS,
    channel: 'services',
    label: 'service',
    initialRows: INITIAL_SERVICES,
    initialRowsMessage: 'Showing the initial price list because this Supabase project needs the service migrations and public-read permission fix. Apply migrations 20261012020000, 20261012030000, and 20261012040000 to enable shared, admin-managed prices.',
    // These database errors mean "not set up yet", not a real failure.
    canUseInitialRows: (error) => error.code === '42703'
        || error.code === 'PGRST204'
        || (error.code === '42501' && /permission denied for function is_business_admin/i.test(error.message))
        || /column .* does not exist|schema cache/i.test(error.message)
};

export default function useServices({ includeInactive = false } = {}) {
    const { rows, ...catalog } = useCatalog(SERVICES_CATALOG, includeInactive);
    return { services: rows, ...catalog };
}
