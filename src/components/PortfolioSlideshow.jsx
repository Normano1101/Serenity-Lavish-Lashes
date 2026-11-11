// The portfolio gallery: one large photo that changes by itself, arrows, thumbnails, and a full-screen view.
import { useCallback, useEffect, useRef, useState } from 'react';
import portfolioPhotos from '../data/portfolioPhotos.js';
import useSwipe from '../hooks/useSwipe.js';
import PortfolioLightbox from './PortfolioLightbox.jsx';
import PortfolioThumbnails from './PortfolioThumbnails.jsx';

const AUTOPLAY_DELAY = 5000; // Time between automatic photo changes.
const THUMBNAIL_PAUSE = 10000; // Longer wait after a visitor picks a thumbnail.
const FADE_TIME = 120; // Time for the old photo to fade before the new one appears.

export default function PortfolioSlideshow() {
    // selectedIndex is the photo chosen; displayedIndex catches up once the fade finishes.
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [displayedIndex, setDisplayedIndex] = useState(0);
    const [isChanging, setIsChanging] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [pauseUntil, setPauseUntil] = useState(0);
    const [pageVisible, setPageVisible] = useState(!document.hidden);
    // Two blurred background layers take turns, so they can cross-fade smoothly.
    const [background, setBackground] = useState({
        photos: [portfolioPhotos[0], portfolioPhotos[0]],
        active: 0
    });
    const featuredButtonRef = useRef(null);
    const ignoreNextClick = useRef(false);
    const ignoreClickTimer = useRef(null);

    // The remainder (%) wraps around, so going past the last photo returns to the first.
    const showPhoto = useCallback((index) => {
        setSelectedIndex((index + portfolioPhotos.length) % portfolioPhotos.length);
    }, []);

    const navigate = (direction) => {
        setPauseUntil(0);
        showPhoto(selectedIndex + direction);
    };

    // Fade out the old photo, then swap in the new one.
    useEffect(() => {
        if (selectedIndex === displayedIndex) return undefined;
        setIsChanging(true);
        const timer = window.setTimeout(() => {
            setDisplayedIndex(selectedIndex);
            setIsChanging(false);
        }, FADE_TIME);
        return () => window.clearTimeout(timer);
    }, [selectedIndex, displayedIndex]);

    // Load the new photo into the hidden background layer, then make that layer the active one.
    useEffect(() => {
        setBackground((current) => {
            const nextLayer = 1 - current.active;
            const photos = [...current.photos];
            photos[nextLayer] = portfolioPhotos[selectedIndex];
            return { photos, active: nextLayer };
        });
    }, [selectedIndex]);

    // Notice when the visitor switches to another browser tab.
    useEffect(() => {
        const updateVisibility = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', updateVisibility);
        return () => document.removeEventListener('visibilitychange', updateVisibility);
    }, []);

    // Change photos automatically, unless the full-screen view is open or the tab is hidden.
    useEffect(() => {
        if (lightboxOpen || !pageVisible) return undefined;
        const delay = Math.max(AUTOPLAY_DELAY, pauseUntil - Date.now());
        const timer = window.setTimeout(() => {
            showPhoto(selectedIndex + 1);
            setPauseUntil(0);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [lightboxOpen, pageVisible, pauseUntil, selectedIndex, showPhoto]);

    useEffect(() => () => window.clearTimeout(ignoreClickTimer.current), []);

    // Put keyboard focus back on the photo after closing the full-screen view.
    const closeLightbox = useCallback(() => {
        setLightboxOpen(false);
        featuredButtonRef.current?.focus();
    }, []);

    const chooseThumbnail = (index) => {
        setPauseUntil(Date.now() + THUMBNAIL_PAUSE);
        showPhoto(index);
    };

    // Phones also send a "click" after a swipe. Ignore it so a swipe doesn't open the full-screen view.
    const swipe = useSwipe((direction) => {
        ignoreNextClick.current = true;
        window.clearTimeout(ignoreClickTimer.current);
        ignoreClickTimer.current = window.setTimeout(() => {
            ignoreNextClick.current = false;
        }, 400);
        navigate(direction);
    });

    const openLightbox = () => {
        if (ignoreNextClick.current) {
            ignoreNextClick.current = false;
            return;
        }
        setPauseUntil(0);
        setLightboxOpen(true);
    };

    return (
        <>
            <section className="portfolio-showcase" aria-label="Lash portfolio slideshow">
                <div className="portfolio-viewer">
                    {background.photos.map((photo, index) => (
                        <div
                            className={`portfolio-blurred-background${index === background.active ? ' is-active' : ''}`}
                            style={{ backgroundImage: `url("${photo}")` }}
                            key={index}
                            aria-hidden="true"
                        />
                    ))}
                    <button className="portfolio-arrow portfolio-previous" type="button" aria-label="Previous photo" onClick={() => navigate(-1)}>
                        &#10094;
                    </button>
                    <button
                        className="portfolio-featured"
                        type="button"
                        aria-label="Open enlarged portfolio photo"
                        ref={featuredButtonRef}
                        onClick={openLightbox}
                        {...swipe}
                    >
                        <img
                            className={`portfolio-featured-image${isChanging ? ' is-changing' : ''}`}
                            src={portfolioPhotos[displayedIndex]}
                            alt={`Lash portfolio photo ${selectedIndex + 1}`}
                        />
                    </button>
                    <button className="portfolio-arrow portfolio-next" type="button" aria-label="Next photo" onClick={() => navigate(1)}>
                        &#10095;
                    </button>
                </div>
                <PortfolioThumbnails photos={portfolioPhotos} selectedIndex={selectedIndex} onSelect={chooseThumbnail} />
            </section>
            {lightboxOpen && (
                <PortfolioLightbox
                    photos={portfolioPhotos}
                    selectedIndex={selectedIndex}
                    onSelect={showPhoto}
                    onClose={closeLightbox}
                />
            )}
        </>
    );
}
