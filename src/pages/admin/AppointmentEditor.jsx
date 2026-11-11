// The appointment pop-up. `mode` decides what it shows:
//   'details'                  - read-only client information
//   'add', 'edit', 'reschedule' - a form for changing the appointment
import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage } from '../../components/Messages.jsx';
import { getActiveDemoServiceNames, getAvailableSlots, getBookingSettings } from '../../data/appointments.js';
import { dateAfterDays, formatDate, formatDuration, formatTime } from '../../data/dates.js';
import { fetchAvailableSlots } from '../../data/publicAvailability.js';
import useServices from '../../hooks/useServices.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';

const TITLES = {
    add: 'Add appointment',
    reschedule: 'Reschedule appointment',
    details: 'Client details',
    edit: 'Edit appointment'
};
const SAVE_LABELS = { add: 'Add appointment', reschedule: 'Save new time', edit: 'Save changes' };

function ClientDetails({ appointment, onAction }) {
    return (
        <>
            <dl className="client-details-list">
                <div><dt>Client</dt><dd>{appointment.name}</dd></div>
                <div><dt>Email</dt><dd>{appointment.email}</dd></div>
                <div><dt>Phone</dt><dd>{appointment.phone}</dd></div>
                <div><dt>Service</dt><dd>{appointment.service}</dd></div>
                <div><dt>Appointment</dt><dd>{formatDate(appointment.date)} at {formatTime(appointment.time)}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(appointment.duration)}</dd></div>
                <div><dt>Status</dt><dd>{appointment.status}</dd></div>
                {appointment.notes && <div><dt>Notes</dt><dd>{appointment.notes}</dd></div>}
            </dl>
            <div className="appointment-editor-actions">
                <button type="button" className="small-button" onClick={() => onAction(appointment, 'edit')}>Edit</button>
                <button type="button" className="small-button" onClick={() => onAction(appointment, 'reschedule')}>Reschedule</button>
                {appointment.status !== 'cancelled' && (
                    <button type="button" className="small-button danger-button" onClick={() => onAction(appointment, 'cancel')}>Cancel</button>
                )}
            </div>
        </>
    );
}

// The form is its own component so its data only loads when the form is actually open.
function AppointmentForm({ mode, appointment, appointments, onSave }) {
    const settings = useMemo(() => getBookingSettings(), []);
    const { services: databaseServices } = useServices({ includeInactive: true });
    const demoServices = useMemo(() => getActiveDemoServiceNames(settings).map((name) => ({
        id: name,
        name,
        duration_minutes: Number(settings.services[name].duration),
        is_active: true
    })), [settings]);
    const services = isSupabaseConfigured ? databaseServices : demoServices;

    const [form, setForm] = useState({
        name: appointment?.name ?? '',
        email: appointment?.email ?? '',
        phone: appointment?.phone ?? '',
        serviceId: appointment?.serviceId ?? appointment?.service ?? '',
        date: appointment?.date ?? dateAfterDays(1),
        time: appointment?.time ?? '',
        notes: appointment?.notes ?? ''
    });
    const { serviceId, date, time } = form;
    const [slots, setSlots] = useState([]);
    const [availabilityError, setAvailabilityError] = useState('');
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Connects an input to a form field: <input {...field('name')} />
    const field = (key) => ({
        value: form[key],
        onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
    });
    // Changing the service or date means the chosen time may no longer fit, so clear it.
    const fieldClearingTime = (key) => ({
        value: form[key],
        onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value, time: '' }))
    });

    const selectedService = services.find((service) => service.id === serviceId || service.name === serviceId);

    // An appointment's own current time must stay selectable, even though it counts as taken.
    const availableOptions = useMemo(() => {
        const keepsCurrentTime = appointment?.time
            && appointment.date === date
            && (appointment.serviceId ?? appointment.service) === serviceId;
        const options = [...slots];
        if (keepsCurrentTime && !options.includes(appointment.time)) options.push(appointment.time);
        return options.sort();
    }, [appointment, date, serviceId, slots]);

    // Load the free times for the chosen service and date.
    useEffect(() => {
        if (!date || !selectedService || (!selectedService.is_active && mode === 'add')) {
            setSlots([]);
            return undefined;
        }
        if (!isSupabaseConfigured) {
            setSlots(getAvailableSlots(appointments, date, {
                settings,
                service: selectedService.name,
                duration: selectedService.duration_minutes,
                excludeId: appointment?.id
            }));
            return undefined;
        }
        if (date < dateAfterDays(0) || !selectedService.id) {
            setSlots([]);
            return undefined;
        }

        let active = true;
        setLoadingSlots(true);
        setAvailabilityError('');
        fetchAvailableSlots(date, date, selectedService.id)
            .then((available) => {
                if (active) setSlots(available.map((slot) => slot.time));
            })
            .catch((queryError) => {
                if (!active) return;
                setSlots([]);
                setAvailabilityError(`Could not load available times: ${queryError.message}`);
            })
            .finally(() => {
                if (active) setLoadingSlots(false);
            });

        return () => {
            active = false;
        };
    }, [appointment, appointments, date, mode, selectedService, settings]);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!availableOptions.includes(time)) {
            setError('That time is no longer available. Choose an available time.');
            return;
        }

        setSaving(true);
        try {
            await onSave({
                id: appointment?.id,
                name: form.name,
                email: form.email,
                phone: form.phone,
                service: selectedService?.name ?? '',
                serviceId: isSupabaseConfigured ? selectedService?.id : undefined,
                duration: Number(selectedService?.duration_minutes),
                date,
                time,
                // New appointments are confirmed; a rescheduled one needs confirming again.
                status: mode === 'add' ? 'confirmed' : mode === 'reschedule' ? 'pending' : appointment?.status,
                source: mode === 'add' ? 'manual' : appointment?.source,
                notes: form.notes
            }, mode);
        } catch (saveError) {
            setError(`Could not save appointment: ${saveError.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="admin-form-grid appointment-editor-form" onSubmit={submit}>
            <label>Client name
                <input {...field('name')} required maxLength={160} />
            </label>
            <label>Email
                <input type="email" {...field('email')} required maxLength={320} />
            </label>
            <label>Phone
                <input type="tel" {...field('phone')} required maxLength={50} />
            </label>
            <label>Service
                <select {...fieldClearingTime('serviceId')} required>
                    <option value="" disabled>Choose a service</option>
                    {services.map((service) => (
                        <option value={service.id} key={service.id} disabled={!service.is_active}>
                            {service.name} · {formatDuration(service.duration_minutes)}
                            {!service.is_active ? ' · inactive' : ''}
                        </option>
                    ))}
                </select>
            </label>
            <label>Date
                {/* Admins may edit older appointments, but new times must be within the next 90 days. */}
                <input
                    type="date"
                    min={mode === 'edit' ? undefined : dateAfterDays(0)}
                    max={mode === 'edit' ? undefined : dateAfterDays(90)}
                    {...fieldClearingTime('date')}
                    required
                />
            </label>
            <label>Available time
                <select {...field('time')} required>
                    <option value="" disabled>{loadingSlots ? 'Checking availability…' : 'Choose a time'}</option>
                    {availableOptions.map((slot) => <option value={slot} key={slot}>{formatTime(slot)}</option>)}
                </select>
            </label>
            <label className="admin-notes-field">Private notes
                <input {...field('notes')} maxLength={2000} />
            </label>
            <ErrorMessage className="admin-notes-field">{availabilityError}</ErrorMessage>
            <ErrorMessage className="admin-notes-field">{error}</ErrorMessage>
            <button className="btn booking-btn" type="submit" disabled={saving || loadingSlots}>
                {saving ? 'Saving…' : SAVE_LABELS[mode]}
            </button>
        </form>
    );
}

export default function AppointmentEditor({ mode, appointment, appointments, onSave, onCancel, onAction }) {
    return (
        <section className="appointment-editor" role="dialog" aria-modal="true" aria-label={TITLES[mode]}>
            <div className="appointment-editor-heading">
                <h3>{TITLES[mode]}</h3>
                <button type="button" className="small-button" onClick={onCancel}>Close</button>
            </div>
            {mode === 'details'
                ? <ClientDetails appointment={appointment} onAction={onAction} />
                : <AppointmentForm key={`${mode}-${appointment?.id}`} mode={mode} appointment={appointment} appointments={appointments} onSave={onSave} />}
        </section>
    );
}
