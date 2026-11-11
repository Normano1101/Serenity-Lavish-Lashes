// The customer booking form: choose a service, date and time, enter contact details, submit.
// This page has three modes:
//   live, bookings on  - Supabase is connected and requests go to the business
//   live, bookings off - Supabase is connected; customers can look at times but not book
//   demo               - no Supabase; everything stays in this browser
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BookingAvailability from '../components/BookingAvailability.jsx';
import { ErrorMessage } from '../components/Messages.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { getActiveDemoServiceNames, getAvailableSlots, LASH_STYLES, saveAppointment } from '../data/appointments.js';
import { formatDate, formatDateKey, formatDuration, formatTime, getSundayMonthCells } from '../data/dates.js';
import { formatServicePrice, getServiceBaseName } from '../data/services.js';
import useAppointments from '../hooks/useAppointments.js';
import useBookingSettings from '../hooks/useBookingSettings.js';
import useMonthAvailability from '../hooks/useMonthAvailability.js';
import useServices from '../hooks/useServices.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

// Online booking must be switched on deliberately, even when Supabase is connected.
const bookingsEnabled = isSupabaseConfigured && import.meta.env.VITE_ENABLE_PUBLIC_BOOKINGS === 'true';

const INTRO_TEXT = bookingsEnabled
    ? 'Choose a service and available time. Appointment requests are securely validated and sent to the business.'
    : isSupabaseConfigured
        ? 'Current service prices are shown below. Online booking is disabled until the business schedule and booking workflow are configured and tested.'
        : 'Development demo only. Requests are saved in this browser, not sent to the business. Please use fictional contact details.';

// Group services by lash style, known styles first: [['Classic', [fullSet, fill]], ...].
function groupServicesByStyle(services) {
    const groups = new Map();
    services.forEach((item) => {
        const style = getServiceBaseName(item.name);
        groups.set(style, [...(groups.get(style) ?? []), item]);
    });

    const rank = (style) => {
        const index = LASH_STYLES.indexOf(style);
        return index === -1 ? Infinity : index;
    };
    return [...groups.entries()].sort(([first], [second]) =>
        rank(first) === rank(second) ? first.localeCompare(second) : rank(first) - rank(second)
    );
}

function getPriceLabel(service) {
    if (isSupabaseConfigured) return formatServicePrice(service.price);
    return service.price !== '' ? `$${service.price}` : 'Price TBD';
}

function ContactField({ id, label, type, placeholder }) {
    return (
        <div className="form-row">
            <label htmlFor={id}>{label}</label>
            <input type={type} id={id} name={id} placeholder={placeholder} required />
        </div>
    );
}

export default function BookingPage() {
    const { appointments, error: loadError } = useAppointments({ demoOnly: true });
    const {
        services: databaseServices,
        loading: servicesLoading,
        error: servicesError,
        refresh: refreshServices
    } = useServices();
    const settings = useBookingSettings();
    // `service` holds the chosen service's id on the live site and its name in demo mode.
    const [service, setService] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [month, setMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // The services customers can choose from.
    const activeServices = isSupabaseConfigured
        ? databaseServices
            .filter((item) => item.is_active && (!bookingsEnabled || Number(item.duration_minutes) > 0))
            .map((item) => ({ ...item, duration: item.duration_minutes }))
        : getActiveDemoServiceNames(settings).map((name) => ({ name, ...settings.services[name] }));
    const selectedService = activeServices.find((item) =>
        isSupabaseConfigured ? item.id === service : item.name === service
    );
    const serviceGroups = useMemo(() => groupServicesByStyle(activeServices), [activeServices]);

    const {
        slots: databaseSlots,
        loading: availabilityLoading,
        message: availabilityMessage
    } = useMonthAvailability(selectedService, month, setError);

    // Free times per date. The live site asks the database; demo mode calculates them here.
    const slotsByDate = useMemo(() => {
        if (isSupabaseConfigured) return databaseSlots;
        const slots = new Map();
        if (!service) return slots;

        getSundayMonthCells(month)
            .filter((cell) => cell.inMonth && cell.key >= formatDateKey(new Date()))
            .forEach((cell) => {
                slots.set(cell.key, getAvailableSlots(appointments, cell.key, { settings, service }));
            });
        return slots;
    }, [appointments, databaseSlots, month, service, settings]);
    const availableSlots = date ? slotsByDate.get(date) ?? [] : [];

    const clearDateAndTime = () => {
        setDate('');
        setTime('');
    };

    // The three effects below clear a choice that is no longer valid after data changes.
    useEffect(() => {
        if (isSupabaseConfigured && service && !selectedService) {
            setService('');
            clearDateAndTime();
        }
    }, [selectedService, service]);

    useEffect(() => {
        if (date && !slotsByDate.has(date)) clearDateAndTime();
    }, [date, slotsByDate]);

    useEffect(() => {
        if (time && !availableSlots.includes(time)) setTime('');
    }, [availableSlots, time]);

    const changeMonth = (offset) => {
        setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
        clearDateAndTime();
    };

    const submitBooking = async (event) => {
        event.preventDefault();
        setConfirmation('');
        setError('');

        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const contact = {
            name: String(form.get('name')).trim(),
            email: String(form.get('email')).trim(),
            phone: String(form.get('phone')).trim()
        };
        const serviceName = selectedService?.name ?? service;
        const summary = `${serviceName} on ${formatDate(date)} at ${formatTime(time)}.`;

        // The time may have been taken since it was shown.
        if (!availableSlots.includes(time)) {
            setError('That time is no longer available. Please choose another time.');
            return;
        }
        if (isSupabaseConfigured && !bookingsEnabled) {
            setError('Online booking is not enabled yet. Please contact the business directly.');
            return;
        }

        setSubmitting(true);
        try {
            if (bookingsEnabled) {
                const { error: bookingError } = await supabase.rpc('create_public_appointment', {
                    p_customer_name: contact.name,
                    p_customer_email: contact.email,
                    p_customer_phone: contact.phone,
                    p_service_id: selectedService.id,
                    p_appointment_date: date,
                    p_starts_at_time: time
                });
                if (bookingError) throw bookingError;
                setConfirmation(`Appointment request received for ${summary}`);
            } else {
                saveAppointment({
                    ...contact,
                    id: crypto.randomUUID(),
                    service: serviceName,
                    duration: Number(selectedService?.duration),
                    date,
                    time,
                    status: 'pending',
                    source: 'customer',
                    notes: ''
                });
                setConfirmation(`Demo request received for ${summary}`);
            }
            formElement.reset();
            setService('');
            clearDateAndTime();
        } catch (saveError) {
            setError(`Could not submit the appointment request: ${saveError.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="site-page">
            <PageHeader title="Book Your Appointment" />
            <section className="booking-card">
                <p className="demo-notice">{INTRO_TEXT}</p>
                {!isSupabaseConfigured && <ErrorMessage>{loadError}</ErrorMessage>}
                {isSupabaseConfigured && <ErrorMessage>{servicesError}</ErrorMessage>}
                {isSupabaseConfigured && (
                    <button type="button" className="small-button" onClick={refreshServices} disabled={servicesLoading}>
                        {servicesLoading ? 'Refreshing services…' : 'Refresh services'}
                    </button>
                )}
                <form className="booking-form" onSubmit={submitBooking}>
                    {/* Step 1: choose a service */}
                    <div className="form-row">
                        <label htmlFor="service">1. Choose your lash service</label>
                        <select
                            id="service"
                            name="service"
                            value={service}
                            onChange={(event) => {
                                setService(event.target.value);
                                clearDateAndTime();
                                setError('');
                            }}
                            required
                            disabled={servicesLoading}
                        >
                            <option value="" disabled>Select a service</option>
                            {serviceGroups.map(([style, styleServices]) => (
                                <optgroup label={style} key={style}>
                                    {styleServices.map((item) => (
                                        <option value={isSupabaseConfigured ? item.id : item.name} key={item.id ?? item.name}>
                                            {item.name.replace(`${style} `, '')}
                                            {Number(item.duration) > 0
                                                ? ` · ${formatDuration(item.duration)}`
                                                : isSupabaseConfigured ? ' · Duration not set' : ''}
                                            {` · ${getPriceLabel(item)}`}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        {isSupabaseConfigured && servicesLoading && <small role="status">Loading current services…</small>}
                        {!activeServices.length && (
                            <small>
                                {isSupabaseConfigured
                                    ? 'No active services with configured durations are available.'
                                    : 'Services will appear after the owner sets durations in the admin demo.'}
                            </small>
                        )}
                    </div>

                    {selectedService && (
                        <section className="booking-selection-summary" aria-live="polite">
                            <strong>{selectedService.name}</strong>
                            <span>{formatDuration(selectedService.duration) || 'Duration not configured'}</span>
                            <span>{getPriceLabel(selectedService)}</span>
                        </section>
                    )}

                    {/* Steps 2 and 3: choose a date and time */}
                    <BookingAvailability
                        service={service}
                        date={date}
                        time={time}
                        month={month}
                        slotsByDate={slotsByDate}
                        availableSlots={availableSlots}
                        availabilityLoading={availabilityLoading}
                        availabilityMessage={availabilityMessage}
                        bookingsDisabled={isSupabaseConfigured && !bookingsEnabled}
                        onMonthChange={changeMonth}
                        onDateChange={(selectedDate) => {
                            setDate(selectedDate);
                            setTime('');
                            setError('');
                        }}
                        onTimeChange={setTime}
                    />

                    {/* Step 4: contact details */}
                    <div className="booking-contact-section">
                        <h2>4. Your contact information</h2>
                        <ContactField id="name" label="Name" type="text" placeholder="Your name" />
                        <ContactField id="phone" label="Phone" type="tel" placeholder="Your phone number" />
                        <ContactField id="email" label="Email" type="email" placeholder="Your email" />
                    </div>

                    {/* Step 5: review, once everything is chosen */}
                    {service && date && time && (
                        <section className="booking-review" aria-label="Booking details">
                            <h2>5. Review your appointment</h2>
                            <p><strong>Service:</strong> {selectedService.name}</p>
                            <p><strong>Date:</strong> {formatDate(date)}</p>
                            <p><strong>Time:</strong> {formatTime(time)}</p>
                            <p><strong>Price:</strong> {getPriceLabel(selectedService)}</p>
                        </section>
                    )}

                    <button
                        type="submit"
                        className="btn booking-btn"
                        disabled={
                            !service || !date || !time || submitting || availabilityLoading
                            || (isSupabaseConfigured && !bookingsEnabled)
                        }
                    >
                        {submitting ? 'Submitting…' : bookingsEnabled ? 'Submit appointment request' : 'Submit demo request'}
                    </button>
                </form>
                <ErrorMessage>{error}</ErrorMessage>
                {confirmation && (
                    <div className="form-message form-success" role="status">
                        <p>{confirmation} Status: pending.</p>
                        {!isSupabaseConfigured && (
                            <>
                                <p>This test appointment is stored only in this browser.</p>
                                <Link to="/admin">View it in the development admin demo</Link>
                            </>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}
