// Read the demo-mode booking settings and keep them up to date when they change.
import { useEffect, useMemo, useState } from 'react';
import { getBookingSettings, subscribeToAppointments } from '../data/appointments.js';

export default function useBookingSettings() {
    const [version, setVersion] = useState(0);

    useEffect(() => subscribeToAppointments(() => setVersion((current) => current + 1)), []);

    // Re-read the settings only when `version` changes.
    return useMemo(() => getBookingSettings(), [version]);
}
