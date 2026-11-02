import { useCallback, useEffect, useState } from 'react';
import { getAppointments, subscribeToAppointments } from '../data/appointments.js';

// Keep the appointment list in sync with local demo storage and surface read errors.
export default function useAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState('');

    // Reload when storage changes and expose failures instead of hiding them.
    const refresh = useCallback(() => {
        try {
            setAppointments(getAppointments());
            setError('');
        } catch (loadError) {
            setError(loadError.message);
        }
    }, []);

    useEffect(() => {
        refresh();
        return subscribeToAppointments(refresh);
    }, [refresh]);

    return { appointments, error, refresh };
}
