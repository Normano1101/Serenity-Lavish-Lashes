// Load the add-ons (spikes, color, ...). Use: const { addons, loading, error, refresh } = useServiceAddons();
import { INITIAL_SERVICE_ADDONS } from '../data/services.js';
import useCatalog from './useCatalog.js';

const ADDONS_CATALOG = {
    table: 'service_addons',
    columns: 'id, name, description, price, is_active',
    channel: 'service-addons',
    label: 'add-on',
    initialRows: INITIAL_SERVICE_ADDONS,
    initialRowsMessage: 'Showing initial add-ons. Apply migrations 20261012030000 and 20261012040000 to enable shared, admin-managed add-ons.',
    // These database errors mean "not set up yet", not a real failure.
    canUseInitialRows: (error) => error.code === '42P01'
        || error.code === 'PGRST205'
        || (error.code === '42501' && /permission denied for function is_business_admin/i.test(error.message))
        || /could not find the table .*service_addons.*schema cache/i.test(error.message)
};

export default function useServiceAddons({ includeInactive = false } = {}) {
    const { rows, ...catalog } = useCatalog(ADDONS_CATALOG, includeInactive);
    return { addons: rows, ...catalog };
}
