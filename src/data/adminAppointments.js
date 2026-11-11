// Appointment data for the admin dashboard. Every function uses the Supabase database on
// the live site and falls back to browser storage in demo mode, so pages needn't care which.
import { getAppointments, saveAppointment, subscribeToAppointments, updateAppointment } from './appointments.js';
import { trimSeconds } from './dates.js';
import { isSupabaseConfigured, subscribeToTable, supabase } from '../lib/supabase.js';

const APPOINTMENT_COLUMNS = `
    id, customer_name, customer_email, customer_phone, service_id,
    appointment_date, starts_at_time, duration_minutes, status, source,
    private_notes, created_at, service:services(name)
`;

// Convert a database row into the simpler shape the pages use.
function mapDatabaseAppointment(row) {
    const service = Array.isArray(row.service) ? row.service[0] : row.service;
    return {
        id: row.id,
        name: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone,
        service: service?.name ?? 'Unknown service',
        serviceId: row.service_id,
        date: row.appointment_date,
        time: trimSeconds(row.starts_at_time),
        duration: row.duration_minutes,
        status: row.status,
        source: row.source,
        notes: row.private_notes,
        createdAt: row.created_at
    };
}

export async function loadAdminAppointments() {
    if (!isSupabaseConfigured) return getAppointments();

    const { data, error } = await supabase
        .from('appointments')
        .select(APPOINTMENT_COLUMNS)
        .order('appointment_date')
        .order('starts_at_time');
    if (error) throw error;
    return data.map(mapDatabaseAppointment);
}

// The database has the final say: it rejects double bookings and non-admin users.
export async function createAdminAppointment(appointment) {
    // The database creates ids by itself, but browser storage needs one given to it.
    if (!isSupabaseConfigured) return saveAppointment({ ...appointment, id: crypto.randomUUID() });

    const { error } = await supabase.from('appointments').insert({
        customer_name: appointment.name.trim(),
        customer_email: appointment.email.trim(),
        customer_phone: appointment.phone.trim(),
        service_id: appointment.serviceId,
        appointment_date: appointment.date,
        starts_at_time: appointment.time,
        duration_minutes: Number(appointment.duration),
        status: appointment.status ?? 'confirmed',
        source: 'manual',
        private_notes: appointment.notes?.trim() ?? ''
    });
    if (error) throw error;
}

// Which database column each editable field is saved to, and how to clean its value.
const trim = (value) => value.trim();
const unchanged = (value) => value;
const EDITABLE_FIELDS = {
    name: ['customer_name', trim],
    email: ['customer_email', trim],
    phone: ['customer_phone', trim],
    serviceId: ['service_id', unchanged],
    date: ['appointment_date', unchanged],
    time: ['starts_at_time', unchanged],
    duration: ['duration_minutes', Number],
    status: ['status', unchanged],
    notes: ['private_notes', trim]
};

// Save only the fields that were passed in.
export async function updateAdminAppointment(id, appointment) {
    if (!isSupabaseConfigured) return updateAppointment(id, appointment);

    const changes = {};
    Object.entries(EDITABLE_FIELDS).forEach(([field, [column, clean]]) => {
        if (appointment[field] !== undefined) changes[column] = clean(appointment[field]);
    });

    const { data, error } = await supabase
        .from('appointments')
        .update(changes)
        .eq('id', id)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Appointment could not be updated. Check your admin access and try again.');
}

// Run onChange when appointments change. Returns a function that stops listening.
export function subscribeToAdminAppointments(onChange, onError) {
    if (!isSupabaseConfigured) return subscribeToAppointments(onChange);

    return subscribeToTable({
        channel: 'admin-appointments',
        table: 'appointments',
        onChange,
        onUnavailable: () => onError('Live appointment updates are unavailable. Refresh to get the latest changes.')
    });
}
