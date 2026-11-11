// The lash services: starter prices and photos, plus helpers for working with service names.
// In the database each style is two rows: 'Classic Full Set' and 'Classic Fill'.

// The columns to fetch whenever services are loaded from the database.
export const SERVICE_COLUMNS = 'id, name, duration_minutes, price, description, image_urls, refill_3_week_price, is_active';

const PHOTO_FOLDER = '/assets/Pictures/LashSet/';

// The photos already on the site, grouped by style, for the admin photo picker.
export const LASH_PHOTO_CATEGORIES = [
    { name: 'Anime Set', images: ['AnimeSet.JPG'] },
    { name: 'Classic Set', images: ['Classic1.jpg', 'Classic2.jpg'] },
    { name: 'Hybrid Set', images: ['Hybrid1.jpg', 'Hybrid2.jpg'] },
    { name: 'Volume Set', images: ['VolumeSet.JPG'] },
    { name: 'Wet Set', images: ['WetSet.JPG'] },
    { name: 'Wispy Set', images: ['Wispy1.jpg', 'Wispy2.jpg', 'Wispy3.jpg'] },
    { name: 'YY Set', images: ['YYset.jpg'] },
    { name: 'Brown Lashes', images: [] }
].map((category) => ({
    ...category,
    images: category.images.map((file, index) => ({ label: `Photo ${index + 1}`, url: `${PHOTO_FOLDER}${file}` }))
}));

// Pick the photo category for a service: 'Classic Lashes' goes with 'Classic Set'.
export function getLashPhotoCategory(serviceName = '') {
    const name = serviceName.toLowerCase();
    const match = LASH_PHOTO_CATEGORIES.find((category) => name.includes(category.name.split(' ')[0].toLowerCase()));
    return match?.name ?? 'Brown Lashes';
}

// Starter price list, shown when the database has no services yet.
// Columns: name, full set price, 2-week fill price, 3-week fill price, photos.
const STARTER_CATALOG = [
    ['Classic Lashes', 105, 75, 85, ['Classic1.jpg', 'Classic2.jpg']],
    ['Wet Set', 115, 80, 90, ['WetSet.JPG']],
    ['Hybrid Lashes', 120, 85, 90, ['Hybrid1.jpg', 'Hybrid2.jpg']],
    ['Volume Lashes', 130, 90, 95, ['VolumeSet.JPG']],
    ['Anime Lashes', 115, 80, 90, ['AnimeSet.JPG']],
    ['Wispy Set', null, null, null, ['Wispy1.jpg', 'Wispy2.jpg', 'Wispy3.jpg']],
    ['YY Set', 100, 75, 80, ['YYset.jpg']],
    ['Brown Lashes', 135, 95, 100, []]
];

// The starter list in the same shape as database rows: a full set row and a fill row per style.
export const INITIAL_SERVICES = STARTER_CATALOG.flatMap(([name, fullSetPrice, twoWeekPrice, threeWeekPrice, images], index) => [
    {
        id: `initial-lash-service-${index}`,
        name: `${name} Full Set`,
        duration_minutes: null,
        price: fullSetPrice,
        description: '',
        image_urls: images.map((image) => `${PHOTO_FOLDER}${image}`),
        refill_3_week_price: null,
        is_active: true
    },
    {
        id: `initial-lash-fill-${index}`,
        name: `${name} Fill`,
        duration_minutes: null,
        price: twoWeekPrice,
        refill_3_week_price: threeWeekPrice,
        is_active: true
    }
]);

export const INITIAL_SERVICE_ADDONS = [
    { id: 'initial-addon-spikes', name: 'Spikes', description: '', price: 10, is_active: true },
    { id: 'initial-addon-color', name: 'Color', description: '', price: 10, is_active: true },
    { id: 'initial-addon-decal', name: 'Decal', description: '', price: 5, is_active: true },
    { id: 'initial-addon-remover', name: 'Remover', description: '', price: 25, is_active: true },
    { id: 'initial-addon-mini-fill', name: 'Mini Fill', description: '', price: 55, is_active: true }
];

// Only show images from this site or a web address.
export function getServiceImageSource(image) {
    return typeof image === 'string' && (image.startsWith('/') || image.startsWith('http')) ? image : '';
}

// 105 becomes '$105', 10.5 becomes '$10.50', and a missing price becomes 'Price TBD'.
export function formatServicePrice(price) {
    if (price === null || price === undefined || price === '') return 'Price TBD';
    return `$${Number(price).toFixed(2).replace(/\.00$/, '')}`;
}

// The highest price the admin forms accept. It catches typos (an extra digit) before customers see them.
export const MAX_SERVICE_PRICE = 5000;

// Read a price typed into a form. Blank means "no price yet"; anything invalid is an error.
// The database also rejects negative prices, but it would silently round 10.555 to 10.56,
// so cents are checked here where the admin can see and fix the message.
export function parseOptionalPrice(value, label) {
    const text = String(value ?? '').trim();
    if (text === '') return null;
    const price = Number(text);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error(`${label} must be a non-negative amount or left blank.`);
    }
    if (!/^\d*(\.\d{1,2})?$/.test(text)) {
        throw new Error(`${label} can have at most two decimal places (for example 85 or 85.50).`);
    }
    if (price > MAX_SERVICE_PRICE) {
        throw new Error(`${label} must be $${MAX_SERVICE_PRICE.toLocaleString('en-US')} or less. Check for an extra digit.`);
    }
    return price;
}

// 'Classic Full Set' and 'Classic Fill' both become 'Classic'.
export function getServiceBaseName(name) {
    return name.replace(/ (Full Set|Fill)$/, '');
}

// Returns 'full', 'fill', or null for anything else.
function getServiceType(name) {
    if (name.endsWith(' Full Set')) return 'full';
    if (name.endsWith(' Fill')) return 'fill';
    return null;
}

// Friendly names for the established styles. New styles just use their own name.
const DISPLAY_NAMES = {
    Classic: 'Classic Lashes',
    Wet: 'Wet Set',
    Hybrid: 'Hybrid Lashes',
    Volume: 'Volume Lashes',
    Anime: 'Anime Lashes',
    Wispy: 'Wispy Set',
    YY: 'YY Set'
};

export function getServiceDisplayName(name) {
    const baseName = getServiceBaseName(name);
    return DISPLAY_NAMES[baseName] ?? baseName;
}

// Match each full set row with the fill row of the same style: [{ full, fill }, ...].
export function pairFullSetsWithFills(services) {
    const fills = new Map(
        services
            .filter((service) => getServiceType(service.name) === 'fill')
            .map((service) => [getServiceBaseName(service.name), service])
    );
    return services
        .filter((service) => getServiceType(service.name) === 'full')
        .map((full) => ({ full, fill: fills.get(getServiceBaseName(full.name)) }));
}
