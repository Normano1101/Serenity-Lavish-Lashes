// The public price list: one card per lash style, followed by the add-ons.
import { ErrorMessage } from '../components/Messages.jsx';
import PageHeader from '../components/PageHeader.jsx';
import {
    formatServicePrice,
    getServiceDisplayName,
    getServiceImageSource,
    pairFullSetsWithFills
} from '../data/services.js';
import useServiceAddons from '../hooks/useServiceAddons.js';
import useServices from '../hooks/useServices.js';

// These styles always come first, in this order. Any others follow alphabetically.
const STYLE_ORDER = ['Classic', 'Wet', 'Hybrid', 'Volume', 'Anime', 'Wispy', 'YY']
    .map((style) => getServiceDisplayName(style));

// A style's place in the order. Unknown styles count as last.
function getStyleRank(name) {
    const index = STYLE_ORDER.indexOf(name);
    return index === -1 ? Infinity : index;
}

function makePriceOptions(services) {
    return pairFullSetsWithFills(services)
        .map(({ full, fill }) => ({
            name: getServiceDisplayName(full.name),
            description: full.description,
            images: full.image_urls ?? [],
            fullSetPrice: full.price,
            fillService: fill
        }))
        .sort((first, second) => {
            const firstRank = getStyleRank(first.name);
            const secondRank = getStyleRank(second.name);
            return firstRank === secondRank ? first.name.localeCompare(second.name) : firstRank - secondRank;
        });
}

function PricingImages({ option }) {
    return (
        <div className={`pricing-images${option.images.length === 1 ? ' pricing-images-single' : ''}`}>
            {option.images.length
                ? option.images.map((image) => (
                    <img src={getServiceImageSource(image)} alt={`${option.name} lash extensions`} key={image} />
                ))
                : <p className="pricing-images-placeholder">{option.name} photo coming soon</p>}
        </div>
    );
}

function PricingCard({ option }) {
    return (
        <article className="pricing-row">
            <PricingImages option={option} />
            <div className="pricing-card">
                <h2>{option.name}</h2>
                {option.description && <p className="pricing-description">{option.description}</p>}
                <div className="price-items">
                    <p>2 Weeks Fill <span>{formatServicePrice(option.fillService?.price)}</span></p>
                    <p>3 Weeks Fill <span>{formatServicePrice(option.fillService?.refill_3_week_price)}</span></p>
                </div>
                <p className="full-price">Full Set <span>{formatServicePrice(option.fullSetPrice)}</span></p>
            </div>
        </article>
    );
}

export default function PricingPage() {
    const { services, loading, error, refresh, usingInitialCatalog: usingInitialServices } = useServices();
    const {
        addons,
        loading: addonsLoading,
        error: addonsError,
        refresh: refreshAddons,
        usingInitialCatalog: usingInitialAddons
    } = useServiceAddons();
    const priceOptions = makePriceOptions(services);
    const refreshing = loading || addonsLoading;

    return (
        <main className="site-page pricing-page">
            <PageHeader
                eyebrow="Eyelash Extensions"
                title="Price List"
                subtitle="Explore my lash extension packages designed to suit your style and needs. Whether you're looking for a natural, wispy look or bold, voluminous lashes, I have the perfect set for you. Browse the options below and find the best fit for your desired look!"
            />
            {(usingInitialServices || usingInitialAddons) && (
                <p className="pricing-data-notice" role="status">
                    Showing the complete initial price list. In Supabase SQL Editor, apply migrations
                    {' '}20261012020000, 20261012030000, and 20261012040000 to enable saved admin-managed prices and live updates.
                </p>
            )}
            <div className="pricing-refresh">
                <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                        refresh();
                        refreshAddons();
                    }}
                    disabled={refreshing}
                >
                    {refreshing ? 'Refreshing…' : 'Refresh prices'}
                </button>
            </div>
            <section className="price-list" aria-label="Eyelash extension pricing">
                {loading && <p role="status">Loading services…</p>}
                {!usingInitialServices && <ErrorMessage>{error}</ErrorMessage>}
                {!loading && !error && !priceOptions.length && <p>No active lash services are available right now.</p>}
                {priceOptions.map((option) => <PricingCard option={option} key={option.name} />)}
            </section>
            <section className="pricing-addons" aria-labelledby="pricing-addons-heading">
                <div className="pricing-addons-heading">
                    <p className="eyebrow">Complete your look</p>
                    <h2 id="pricing-addons-heading">Add-Ons</h2>
                </div>
                {!usingInitialAddons && <ErrorMessage>{addonsError}</ErrorMessage>}
                {!addonsLoading && !addonsError && !addons.length && <p>No active add-ons are available right now.</p>}
                {addonsLoading && <p role="status">Loading add-ons…</p>}
                <ul className="pricing-addons-list">
                    {addons.map((addon) => (
                        <li key={addon.id}>
                            <span>{addon.name}</span>
                            {addon.description && <small>{addon.description}</small>}
                            <strong>{formatServicePrice(addon.price)}</strong>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
}
