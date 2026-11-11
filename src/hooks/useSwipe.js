// Detect left and right finger swipes. Spread the result onto an element: <img {...swipe} />
import { useRef } from 'react';

const MIN_SWIPE_DISTANCE = 50;

// onSwipe receives -1 for "previous photo" (a swipe right) or 1 for "next photo" (a swipe left).
export default function useSwipe(onSwipe) {
    const startX = useRef(null);

    return {
        onTouchStart: (event) => {
            startX.current = event.changedTouches[0]?.clientX ?? null;
        },
        onTouchEnd: (event) => {
            if (startX.current === null) return;
            const distance = event.changedTouches[0].clientX - startX.current;
            startX.current = null;
            if (Math.abs(distance) > MIN_SWIPE_DISTANCE) onSwipe(distance > 0 ? -1 : 1);
        }
    };
}
