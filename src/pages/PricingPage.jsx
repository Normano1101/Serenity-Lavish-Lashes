import Footer from '../components/Footer.jsx';
import {
    formatServicePrice,
    getServiceBaseName,
    getServiceDisplayName,
    getServiceImageSource,
    getServiceType
} from '../data/services.js';
import useServices from '../hooks/useServices.js';
import useServiceAddons from '../hooks/useServiceAddons.js';

const knownServiceOrder = ['Classic', 'Wet', 'Hybrid', 'Volume', 'Anime', 'Wispy', 'YY'];

// Pair each full-set service with its matching fill and keep familiar styles ordered.
function makePriceOptions(services) {
    const fills = new Map(
        services
            .filter((service) => getServiceType(service.name) === 'fill')
            .map((service) => [getServiceBaseName(service.name), service])
    );

    return services
        .filter((service) => getServiceType(service.name) === 'full')
        .map((service) => ({
            name: getServiceDisplayName(service.name),
            description: service.description,
            images: service.image_urls ?? [],
            fullSetPrice: service.price,
            fillService: fills.get(getServiceBaseName(service.name))
        }))
        .sort((first, second) => {
            const firstIndex = knownServiceOrder.findIndex((name) => getServiceDisplayName(`${name} Full Set`) === first.name);
            const secondIndex = knownServiceOrder.findIndex((name) => getServiceDisplayName(`${name} Full Set`) === second.name);
            if (firstIndex === -1 && secondIndex === -1) return first.name.localeCompare(second.name);
            if (firstIndex === -1) return 1;
            if (secondIndex === -1) return -1;
            return firstIndex - secondIndex;
        });
}

// Show available service photos or a clear placeholder when none are configured.
function PricingImages({ option }) {
    return (
        <div className={`pricing-images${option.images.length === 1 ? ' pricing-images-single' : ''}`}>
            {option.images.length
                ? option.images.map((image) => (
                    <img
                        src={getServiceImageSource(image)}
                        alt={`${option.name} lash extensions`}
                        key={image}
                    />
                ))
                : <p className="pricing-images-placeholder">{option.name} photo coming soon</p>}
        </div>
    );
}

// Load and display the current service prices and add-on catalog.
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

    return (
        <>
            <main className="pricing-page">
                <header className="pricing-intro">
                    <div className="pricing-intro-text">
                        <h1>Price List</h1>
                        <p className="eyebrow">Eyelash Extensions</p>
                    </div>
                    <p className="pricing-intro-copy">
                        Explore my lash extension packages designed to suit your style and needs. Whether you&apos;re
                        looking for a natural, wispy look or bold, voluminous lashes, I have the perfect set for
                        you. Browse the options below and find the best fit for your desired look!
                    </p>
                </header>
                {(usingInitialServices || usingInitialAddons) && (
                    <p className="pricing-data-notice" role="status">
                        Showing the complete initial price list. In Supabase SQL Editor, apply migrations
                        {' '}20261012020000, 20261012030000, and 20261012040000 to enable saved admin-managed prices and live updates.
                    </p>
                )}
                {/* Refresh both catalogs together because they share the same page status. */}
                <div className="pricing-refresh">
                    <button
                        type="button"
                        className="small-button"
                        onClick={() => {
                            refresh();
                            refreshAddons();
                        }}
                        disabled={loading || addonsLoading}
                    >
                        {loading || addonsLoading ? 'Refreshing…' : 'Refresh prices'}
                    </button>
                </div>
                <section className="price-list" aria-label="Eyelash extension pricing">
                    {loading && <p role="status">Loading services…</p>}
                    {error && !usingInitialServices && <p className="form-message form-error" role="alert">{error}</p>}
                    {!loading && !error && !priceOptions.length && (
                        <p>No active lash services are available right now.</p>
                    )}
                    {priceOptions.map((option) => (
                        <article className="pricing-row" key={option.name}>
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
                    ))}
                </section>
                <section className="pricing-addons" aria-labelledby="pricing-addons-heading">
                    <div className="pricing-addons-heading">
                        <p className="eyebrow">Complete your look</p>
                        <h2 id="pricing-addons-heading">Add-Ons</h2>
                    </div>
                    {addonsError && !usingInitialAddons && <p className="form-message form-error" role="alert">{addonsError}</p>}
                    {!addonsLoading && !addonsError && !addons.length && (
                        <p>No active add-ons are available right now.</p>
                    )}
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
            <Footer />
        </>
    );
}
