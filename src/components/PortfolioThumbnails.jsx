import { useEffect, useRef } from 'react';

// Display photo choices and keep the currently selected thumbnail in view.
export default function PortfolioThumbnails({ photos, selectedIndex, onSelect }) {
    const strip = useRef(null);
    const selectedThumbnail = useRef(null);

    // Scroll only the strip sideways; scrollIntoView would also move the whole page.
    useEffect(() => {
        if (!strip.current || !selectedThumbnail.current) return;
        const stripBox = strip.current.getBoundingClientRect();
        const thumbnailBox = selectedThumbnail.current.getBoundingClientRect();
        const offset = thumbnailBox.left < stripBox.left
            ? thumbnailBox.left - stripBox.left
            : Math.max(thumbnailBox.right - stripBox.right, 0);
        if (offset) strip.current.scrollBy({ left: offset, behavior: 'smooth' });
    }, [selectedIndex]);

    return (
        <div className="portfolio-thumbnails" role="group" aria-label="Choose a portfolio photo" ref={strip}>
            {photos.map((photo, index) => (
                <button
                    className="portfolio-thumbnail"
                    type="button"
                    key={photo}
                    aria-label={`Show portfolio photo ${index + 1}`}
                    aria-current={index === selectedIndex}
                    ref={index === selectedIndex ? selectedThumbnail : null}
                    onClick={() => onSelect(index)}
                >
                    <img src={photo} alt="" loading="lazy" />
                </button>
            ))}
        </div>
    );
}
