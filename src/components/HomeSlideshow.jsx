import { useEffect, useState } from 'react';
import homePhotos from '../data/homePhotos.js';

export default function HomeSlideshow() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setActiveIndex((index) => (index + 1) % homePhotos.length);
        }, 3000);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="slider">
            <div className="slides">
                {homePhotos.map((photo, index) => (
                    <img
                        key={photo}
                        src={photo}
                        className={`slide${index === activeIndex ? ' active' : ''}`}
                        alt={`Lash extension style ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
