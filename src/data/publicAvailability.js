// Ask the database which appointment times are free. This returns times only,
// so no customer details are ever exposed.
import { supabase } from '../lib/supabase.js';
import { trimSeconds } from './dates.js';

// Returns a list like [{ date: '2026-11-06', time: '09:30' }, ...].
export async function fetchAvailableSlots(startDate, endDate, serviceId) {
    const { data, error } = await supabase.rpc('get_public_availability', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_service_id: serviceId
    });
    if (error) throw error;
    return data.map((slot) => ({ date: slot.available_date, time: trimSeconds(slot.starts_at_time) }));
}
