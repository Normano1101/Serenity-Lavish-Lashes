import { useCallback, useEffect, useRef, useState } from 'react';
import portfolioPhotos from '../data/portfolioPhotos.js';
import PortfolioLightbox from './PortfolioLightbox.jsx';
import PortfolioThumbnails from './PortfolioThumbnails.jsx';

// Keep autoplay and thumbnail-pause timing consistent across effects.
const AUTOPLAY_DELAY = 5000;
const THUMBNAIL_PAUSE = 10000;

// Coordinate slideshow navigation, autoplay, thumbnail selection, and the lightbox.
export default function PortfolioSlideshow() {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [displayedIndex, setDisplayedIndex] = useState(0);
    const [isChanging, setIsChanging] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [pauseUntil, setPauseUntil] = useState(0);
    const [pageVisible, setPageVisible] = useState(!document.hidden);
    const [background, setBackground] = useState({
        photos: [portfolioPhotos[0], portfolioPhotos[0]],
        active: 0
    });
    const featuredButtonRef = useRef(null);
    const swipeStartX = useRef(null);
    const suppressClick = useRef(false);
    const suppressClickTimer = useRef(null);

    // Normalize any requested index so navigation wraps through the photo list.
    const showPhoto = useCallback((index) => {
        setSelectedIndex((index + portfolioPhotos.length) % portfolioPhotos.length);
    }, []);

    const navigate = useCallback((direction) => {
        setPauseUntil(0);
        showPhoto(selectedIndex + direction);
    }, [selectedIndex, showPhoto]);

    // Delay the foreground image swap so its fade transition can run.
    useEffect(() => {
        if (selectedIndex === displayedIndex) return undefined;
        setIsChanging(true);
        const timer = window.setTimeout(() => {
            setDisplayedIndex(selectedIndex);
            setIsChanging(false);
        }, 120);
        return () => window.clearTimeout(timer);
    }, [selectedIndex, displayedIndex]);

    // Cross-fade two background layers without flashing the viewer.
    useEffect(() => {
        setBackground((current) => {
            const nextBackground = 1 - current.active;
            const photos = [...current.photos];
            photos[nextBackground] = portfolioPhotos[selectedIndex];
            return { photos, active: nextBackground };
        });
    }, [selectedIndex]);

    // Stop autoplay timing while the visitor has switched to another browser tab.
    useEffect(() => {
        const updateVisibility = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', updateVisibility);
        return () => document.removeEventListener('visibilitychange', updateVisibility);
    }, []);

    // Autoplay only when the lightbox is closed and the page is visible.
    useEffect(() => {
        if (lightboxOpen || !pageVisible) return undefined;
        const delay = Math.max(AUTOPLAY_DELAY, pauseUntil - Date.now());
        const timer = window.setTimeout(() => {
            showPhoto(selectedIndex + 1);
            setPauseUntil(0);
        }, delay);
        return () => window.clearTimeout(timer);
    }, [lightboxOpen, pageVisible, pauseUntil, selectedIndex, showPhoto]);

    // Return keyboard focus to the photo button after closing the dialog.
    const closeLightbox = useCallback(() => {
        setLightboxOpen(false);
        featuredButtonRef.current?.focus();
    }, []);

    useEffect(() => () => window.clearTimeout(suppressClickTimer.current), []);
    // Pause automatic changes briefly after a visitor chooses a thumbnail.
    const chooseThumbnail = (index) => {
        setPauseUntil(Date.now() + THUMBNAIL_PAUSE);
        showPhoto(index);
    };

    const handleTouchStart = (event) => {
        swipeStartX.current = event.changedTouches[0]?.clientX ?? null;
    };

    // Navigate on a swipe and suppress the synthetic tap that follows it.
    const handleTouchEnd = (event) => {
        if (swipeStartX.current === null) return;
        const distance = event.changedTouches[0].clientX - swipeStartX.current;
        swipeStartX.current = null;
        if (Math.abs(distance) <= 50) return;
        suppressClick.current = true;
        window.clearTimeout(suppressClickTimer.current);
        suppressClickTimer.current = window.setTimeout(() => {
            suppressClick.current = false;
        }, 400);
        navigate(distance > 0 ? -1 : 1);
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
                    <button
                        className="portfolio-arrow portfolio-previous"
                        type="button"
                        aria-label="Previous photo"
                        onClick={() => navigate(-1)}
                    >
                        &#10094;
                    </button>
                    <button
                        className="portfolio-featured"
                        type="button"
                        aria-label="Open enlarged portfolio photo"
                        ref={featuredButtonRef}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onClick={() => {
                            if (suppressClick.current) {
                                suppressClick.current = false;
                                return;
                            }
                            setPauseUntil(0);
                            setLightboxOpen(true);
                        }}
                    >
                        <img
                            className={`portfolio-featured-image${isChanging ? ' is-changing' : ''}`}
                            src={portfolioPhotos[displayedIndex]}
                            alt={`Lash portfolio photo ${selectedIndex + 1}`}
                        />
                    </button>
                    <button
                        className="portfolio-arrow portfolio-next"
                        type="button"
                        aria-label="Next photo"
                        onClick={() => navigate(1)}
                    >
                        &#10095;
                    </button>
                </div>
                <PortfolioThumbnails
                    photos={portfolioPhotos}
                    selectedIndex={selectedIndex}
                    onSelect={chooseThumbnail}
                />
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
