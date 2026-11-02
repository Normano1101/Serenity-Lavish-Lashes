// Keep the database projection shared by public and admin service queries.
export const SERVICE_COLUMNS = 'id, name, duration_minutes, price, description, image_urls, refill_3_week_price, is_active';

// All bundled lash images live under this public directory.
const lashPhotoPath = '/assets/Pictures/LashSet/';

// Associate each style with the photos available for display in admin tools.
export const LASH_PHOTO_CATEGORIES = [
    {
        name: 'Anime Set',
        images: ['AnimeSet.JPG']
    },
    {
        name: 'Classic Set',
        images: ['Classic1.jpg', 'Classic2.jpg']
    },
    {
        name: 'Hybrid Set',
        images: ['Hybrid1.jpg', 'Hybrid2.jpg']
    },
    {
        name: 'Volume Set',
        images: ['VolumeSet.JPG']
    },
    {
        name: 'Wet Set',
        images: ['WetSet.JPG']
    },
    {
        name: 'Wispy Set',
        images: ['Wispy1.jpg', 'Wispy2.jpg', 'Wispy3.jpg']
    },
    {
        name: 'YY Set',
        images: ['YYset.jpg']
    },
    {
        name: 'Brown Lashes',
        images: []
    }
].map((category) => ({
    ...category,
    images: category.images.map((name, index) => ({
        label: `Photo ${index + 1}`,
        url: `${lashPhotoPath}${name}`
    }))
}));

// Pick the photo category whose name best matches a service name.
export function getLashPhotoCategory(serviceName = '') {
    const name = serviceName.toLowerCase();
    if (name.includes('anime')) return 'Anime Set';
    if (name.includes('classic')) return 'Classic Set';
    if (name.includes('hybrid')) return 'Hybrid Set';
    if (name.includes('volume')) return 'Volume Set';
    if (name.includes('wet')) return 'Wet Set';
    if (name.includes('wispy')) return 'Wispy Set';
    if (name.includes('yy')) return 'YY Set';
    return 'Brown Lashes';
}

// Provide the starter catalog for projects that have not loaded saved services.
export const INITIAL_LASH_CATALOG = [
    {
        name: 'Classic Lashes',
        fullSetPrice: 105,
        twoWeekPrice: 75,
        threeWeekPrice: 85,
        images: ['Classic1.jpg', 'Classic2.jpg']
    },
    {
        name: 'Wet Set',
        fullSetPrice: 115,
        twoWeekPrice: 80,
        threeWeekPrice: 90,
        images: ['WetSet.JPG']
    },
    {
        name: 'Hybrid Lashes',
        fullSetPrice: 120,
        twoWeekPrice: 85,
        threeWeekPrice: 90,
        images: ['Hybrid1.jpg', 'Hybrid2.jpg']
    },
    {
        name: 'Volume Lashes',
        fullSetPrice: 130,
        twoWeekPrice: 90,
        threeWeekPrice: 95,
        images: ['VolumeSet.JPG']
    },
    {
        name: 'Anime Lashes',
        fullSetPrice: 115,
        twoWeekPrice: 80,
        threeWeekPrice: 90,
        images: ['AnimeSet.JPG']
    },
    {
        name: 'Wispy Set',
        fullSetPrice: null,
        twoWeekPrice: null,
        threeWeekPrice: null,
        images: ['Wispy1.jpg', 'Wispy2.jpg', 'Wispy3.jpg']
    },
    {
        name: 'YY Set',
        fullSetPrice: 100,
        twoWeekPrice: 75,
        threeWeekPrice: 80,
        images: ['YYset.jpg']
    },
    {
        name: 'Brown Lashes',
        fullSetPrice: 135,
        twoWeekPrice: 95,
        threeWeekPrice: 100,
        images: []
    }
].map((service, index) => ({
    id: `initial-lash-service-${index}`,
    name: `${service.name} Full Set`,
    duration_minutes: null,
    price: service.fullSetPrice,
    description: '',
    image_urls: service.images.map((image) => `${lashPhotoPath}${image}`),
    refill_3_week_price: null,
    is_active: true,
    fill: {
        id: `initial-lash-fill-${index}`,
        name: `${service.name} Fill`,
        duration_minutes: null,
        price: service.twoWeekPrice,
        refill_3_week_price: service.threeWeekPrice,
        is_active: true
    }
}));

// Provide starter add-ons when shared Supabase data is not configured.
export const INITIAL_SERVICE_ADDONS = [
    { id: 'initial-addon-spikes', name: 'Spikes', description: '', price: 10, is_active: true },
    { id: 'initial-addon-color', name: 'Color', description: '', price: 10, is_active: true },
    { id: 'initial-addon-decal', name: 'Decal', description: '', price: 5, is_active: true },
    { id: 'initial-addon-remover', name: 'Remover', description: '', price: 25, is_active: true },
    { id: 'initial-addon-mini-fill', name: 'Mini Fill', description: '', price: 55, is_active: true }
];

// Accept only local or HTTP image URLs before rendering a service photo.
export function getServiceImageSource(image) {
    return typeof image === 'string' && (image.startsWith('/') || image.startsWith('http'))
        ? image
        : '';
}

// Format prices consistently while leaving unset prices clearly marked.
export function formatServicePrice(price) {
    if (price === null || price === undefined || price === '') return 'Price TBD';
    return `$${Number(price).toFixed(2).replace(/\.00$/, '')}`;
}

// Remove the full-set/fill suffix to group matching service variants.
export function getServiceBaseName(name) {
    return name.replace(/ (Full Set|Fill)$/, '');
}

// Identify whether a catalog entry is a full set, fill, or other service.
export function getServiceType(name) {
    if (name.endsWith(' Full Set')) return 'full';
    if (name.endsWith(' Fill')) return 'fill';
    return null;
}

// Preserve familiar public names while allowing custom catalog names.
export function getServiceDisplayName(name) {
    const baseName = getServiceBaseName(name);
    const establishedNames = {
        Classic: 'Classic Lashes',
        Wet: 'Wet Set',
        Hybrid: 'Hybrid Lashes',
        Volume: 'Volume Lashes',
        Anime: 'Anime Lashes',
        Wispy: 'Wispy Set',
        YY: 'YY Set'
    };
    return establishedNames[baseName] ?? baseName;
}
