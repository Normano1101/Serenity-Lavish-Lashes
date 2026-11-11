// Live site only: load the free appointment times for a service across the visible month.
import { useEffect, useState } from 'react';
import { dateAfterDays, formatDate, formatDateKey } from '../data/dates.js';
import { fetchAvailableSlots } from '../data/publicAvailability.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

const BOOKING_WINDOW_DAYS = 90;

// Returns slots as a Map of date key to times, e.g. '2026-11-06' -> ['09:00', '09:30'].
export default function useMonthAvailability(service, month, onError) {
    const [slots, setSlots] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!isSupabaseConfigured || !service?.id) {
            setSlots(new Map());
            setLoading(false);
            setMessage('');
            return undefined;
        }

        setSlots(new Map());
        onError('');
        setMessage('');

        // A service without a duration can't be placed on the calendar.
        if (!(Number(service.duration_minutes) > 0)) {
            setLoading(false);
            setMessage('The owner needs to configure this service’s appointment duration before available dates can be shown.');
            return undefined;
        }

        // Only look at dates in this month that are from today up to the booking window's end.
        const monthStart = formatDateKey(new Date(month.getFullYear(), month.getMonth(), 1, 12));
        const monthEnd = formatDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0, 12));
        const today = dateAfterDays(0);
        const lastBookableDay = dateAfterDays(BOOKING_WINDOW_DAYS);
        const startDate = monthStart < today ? today : monthStart;
        const endDate = monthEnd > lastBookableDay ? lastBookableDay : monthEnd;
        if (endDate < startDate) {
            setLoading(false);
            setMessage(`Availability can be checked through ${formatDate(lastBookableDay)}.`);
            return undefined;
        }

        // `active` stops an old, slow request from overwriting a newer one.
        let active = true;
        setLoading(true);
        fetchAvailableSlots(startDate, endDate, service.id)
            .then((available) => {
                if (!active) return;
                const byDate = new Map();
                available.forEach(({ date, time }) => byDate.set(date, [...(byDate.get(date) ?? []), time]));
                setSlots(byDate);
                setMessage(byDate.size
                    ? ''
                    : 'No available appointment times are configured for this month. The owner may need to add business hours, service duration, or date availability.');
                setLoading(false);
            })
            .catch((error) => {
                if (!active) return;
                onError(`Could not load available times: ${error.message}`);
                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [month, service?.duration_minutes, service?.id]);

    return { slots, loading, message };
}
