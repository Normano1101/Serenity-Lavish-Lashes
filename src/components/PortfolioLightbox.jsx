import { useEffect, useRef } from 'react';

export default function PortfolioLightbox({ photos, selectedIndex, onSelect, onClose }) {
    const dialogRef = useRef(null);
    const touchStartX = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        const focusable = dialog?.querySelectorAll('button:not([disabled])');

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                onSelect((selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1) + photos.length) % photos.length);
            } else if (event.key === 'Tab' && focusable?.length) {
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, onSelect, photos.length, selectedIndex]);

    useEffect(() => {
        document.body.classList.add('portfolio-lightbox-open');
        dialogRef.current?.querySelector('.portfolio-lightbox-close')?.focus();
        return () => document.body.classList.remove('portfolio-lightbox-open');
    }, []);

    const showPhoto = (direction) => {
        onSelect((selectedIndex + direction + photos.length) % photos.length);
    };

    const handleTouchEnd = (event) => {
        if (touchStartX.current === null) return;
        const distance = event.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(distance) > 50) showPhoto(distance > 0 ? -1 : 1);
    };

    return (
        <div
            className="portfolio-lightbox"
            aria-hidden="false"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="portfolio-lightbox-dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Enlarged portfolio photo"
                tabIndex="-1"
                ref={dialogRef}
            >
                <button className="portfolio-lightbox-close" type="button" aria-label="Close enlarged photo" onClick={onClose}>
                    &times;
                </button>
                <button
                    className="portfolio-arrow portfolio-lightbox-previous"
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => showPhoto(-1)}
                >
                    &#10094;
                </button>
                <img
                    className="portfolio-lightbox-image"
                    src={photos[selectedIndex]}
                    alt={`Enlarged lash portfolio photo ${selectedIndex + 1}`}
                    onTouchStart={(event) => {
                        touchStartX.current = event.changedTouches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={handleTouchEnd}
                />
                <button
                    className="portfolio-arrow portfolio-lightbox-next"
                    type="button"
                    aria-label="Next photo"
                    onClick={() => showPhoto(1)}
                >
                    &#10095;
                </button>
            </div>
        </div>
    );
}
