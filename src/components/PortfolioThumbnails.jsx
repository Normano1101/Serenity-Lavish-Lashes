import { useEffect, useRef } from 'react';

export default function PortfolioThumbnails({ photos, selectedIndex, onSelect }) {
    const selectedThumbnail = useRef(null);

    useEffect(() => {
        selectedThumbnail.current?.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'smooth'
        });
    }, [selectedIndex]);

    return (
        <div className="portfolio-thumbnails" role="group" aria-label="Choose a portfolio photo">
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
