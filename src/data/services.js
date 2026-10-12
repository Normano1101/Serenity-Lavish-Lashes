export const SERVICE_COLUMNS = 'id, name, duration_minutes, price, description, image_urls, refill_3_week_price, is_active';

const lashPhotoPath = '/assets/Pictures/LashSet/';

export const AVAILABLE_LASH_IMAGES = [
    'AnimeSet.JPG',
    'Classic1.jpg',
    'Classic2.jpg',
    'Hybrid1.jpg',
    'Hybrid2.jpg',
    'VolumeSet.JPG',
    'WetSet.JPG',
    'Wispy1.jpg',
    'Wispy2.jpg',
    'Wispy3.jpg',
    'YYset.jpg'
].map((name) => ({ name, url: `${lashPhotoPath}${name}` }));

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

export const INITIAL_SERVICE_ADDONS = [
    { id: 'initial-addon-spikes', name: 'Spikes', description: '', price: 10, is_active: true },
    { id: 'initial-addon-color', name: 'Color', description: '', price: 10, is_active: true },
    { id: 'initial-addon-decal', name: 'Decal', description: '', price: 5, is_active: true },
    { id: 'initial-addon-remover', name: 'Remover', description: '', price: 25, is_active: true },
    { id: 'initial-addon-mini-fill', name: 'Mini Fill', description: '', price: 55, is_active: true }
];

export function getServiceImageSource(image) {
    return typeof image === 'string' && (image.startsWith('/') || image.startsWith('http'))
        ? image
        : '';
}

export function formatServicePrice(price) {
    if (price === null || price === undefined || price === '') return 'Price TBD';
    return `$${Number(price).toFixed(2).replace(/\.00$/, '')}`;
}

export function getServiceBaseName(name) {
    return name.replace(/ (Full Set|Fill)$/, '');
}

export function getServiceType(name) {
    if (name.endsWith(' Full Set')) return 'full';
    if (name.endsWith(' Fill')) return 'fill';
    return null;
}

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
