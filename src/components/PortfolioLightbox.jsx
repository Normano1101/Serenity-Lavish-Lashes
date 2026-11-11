// The full-screen photo view. Works with the mouse, arrow keys, Escape and finger swipes.
import { useEffect, useRef } from 'react';
import useSwipe from '../hooks/useSwipe.js';

export default function PortfolioLightbox({ photos, selectedIndex, onSelect, onClose }) {
    const dialogRef = useRef(null);

    // direction is -1 for previous or 1 for next. onSelect wraps around at the ends of the list.
    const showPhoto = (direction) => onSelect(selectedIndex + direction);
    const swipe = useSwipe(showPhoto);

    // Keyboard controls. Tab stays inside the dialog so focus can't reach the page behind it.
    useEffect(() => {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])');

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                onSelect(selectedIndex + (event.key === 'ArrowLeft' ? -1 : 1));
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
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onSelect, selectedIndex]);

    // Stop the page behind from scrolling while this is open.
    useEffect(() => {
        document.body.classList.add('portfolio-lightbox-open');
        dialogRef.current?.querySelector('.portfolio-lightbox-close')?.focus();
        return () => document.body.classList.remove('portfolio-lightbox-open');
    }, []);

    return (
        <div
            className="portfolio-lightbox"
            aria-hidden="false"
            onClick={(event) => {
                // Clicking the dark area around the photo closes it.
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
                <button className="portfolio-arrow portfolio-lightbox-previous" type="button" aria-label="Previous photo" onClick={() => showPhoto(-1)}>
                    &#10094;
                </button>
                <img
                    className="portfolio-lightbox-image"
                    src={photos[selectedIndex]}
                    alt={`Enlarged lash portfolio photo ${selectedIndex + 1}`}
                    {...swipe}
                />
                <button className="portfolio-arrow portfolio-lightbox-next" type="button" aria-label="Next photo" onClick={() => showPhoto(1)}>
                    &#10095;
                </button>
            </div>
        </div>
    );
}
