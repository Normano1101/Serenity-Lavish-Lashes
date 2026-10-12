import { useCallback, useEffect, useState } from 'react';
import { getAppointments, subscribeToAppointments } from '../data/appointments.js';

export default function useAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState('');

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
