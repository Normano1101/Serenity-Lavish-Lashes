import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import {
    formatDate,
    formatDateKey,
    formatDuration,
    formatTime,
    getAvailableSlots,
    getBookingSettings,
    LASH_STYLES,
    SERVICES,
    saveAppointment,
} from '../data/appointments.js';
import { formatServicePrice, getServiceBaseName } from '../data/services.js';
import useAppointments from '../hooks/useAppointments.js';
import useServices from '../hooks/useServices.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Require explicit opt-in as well as Supabase before accepting public bookings.
const productionBookingEnabled = isSupabaseConfigured
    && import.meta.env.VITE_ENABLE_PUBLIC_BOOKINGS === 'true';

// Build all calendar cells, including leading/trailing days needed for full weeks.
function getMonthCells(month) {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cellCount = Math.max(35, Math.ceil((startOffset + dayCount) / 7) * 7);

    return Array.from({ length: cellCount }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index - startOffset + 1);
        return {
            date,
            key: formatDateKey(date),
            inMonth: date.getMonth() === month.getMonth()
        };
    });
}

// Handle service selection, availability lookup, and secure appointment requests.
export default function BookingPage() {
    const { appointments, error: loadError } = useAppointments();
    const {
        services: databaseServices,
        loading: servicesLoading,
        error: servicesError,
        refresh: refreshServices
    } = useServices();
    const [settingsVersion, setSettingsVersion] = useState(0);
    const [service, setService] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [month, setMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [availabilityMessage, setAvailabilityMessage] = useState('');
    const [databaseSlots, setDatabaseSlots] = useState(new Map());
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    // Choose local demo data or the shared catalog, depending on configuration.
    const settings = useMemo(() => getBookingSettings(), [settingsVersion]);
    const demoServices = SERVICES
        .filter((name) => settings.services[name]?.active && Number(settings.services[name].duration) > 0)
        .map((name) => ({ name, ...settings.services[name], duration: settings.services[name].duration }));
    const activeServices = isSupabaseConfigured
        ? databaseServices
            .filter((item) => item.is_active
                && (!productionBookingEnabled || Number(item.duration_minutes) > 0))
            .map((item) => ({
                ...item,
                duration: item.duration_minutes,
                price: item.price
            }))
        : demoServices;
    // Calculate local demo availability; Supabase availability is loaded separately.
    const slotsByDate = useMemo(() => {
        if (isSupabaseConfigured) return databaseSlots;
        const slots = new Map();
        if (!service) return slots;

        getMonthCells(month)
            .filter((cell) => cell.inMonth && cell.key >= formatDateKey(new Date()))
            .forEach((cell) => {
                slots.set(cell.key, getAvailableSlots(appointments, cell.key, { settings, service }));
            });
        return slots;
    }, [appointments, databaseSlots, month, service, settingsVersion]);
    const availableSlots = date ? slotsByDate.get(date) ?? [] : [];
    const selectedService = activeServices.find((item) =>
        isSupabaseConfigured ? item.id === service : item.name === service
    );
    // Group full sets and fills by lash style and keep known styles in a stable order.
    const serviceGroups = useMemo(() => {
        const groups = new Map();
        activeServices.forEach((item) => {
            const style = isSupabaseConfigured
                ? getServiceBaseName(item.name)
                : item.name.replace(/ (Full Set|Fill)$/, '');
            groups.set(style, [...(groups.get(style) ?? []), item]);
        });
        return [...groups.entries()].sort(([first], [second]) => {
            const firstKnown = LASH_STYLES.indexOf(first);
            const secondKnown = LASH_STYLES.indexOf(second);
            if (firstKnown >= 0 && secondKnown >= 0) return firstKnown - secondKnown;
            if (firstKnown >= 0) return -1;
            if (secondKnown >= 0) return 1;
            return first.localeCompare(second);
        });
    }, [activeServices]);
    const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Keep demo schedule changes made elsewhere in this tab or another tab visible.
    useEffect(() => {
        const refresh = () => setSettingsVersion((version) => version + 1);
        window.addEventListener('serenity-demo-appointments-changed', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('serenity-demo-appointments-changed', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    // Ask Supabase for its authoritative slots for the selected service and month.
    useEffect(() => {
        if (!isSupabaseConfigured || !selectedService?.id) {
            setDatabaseSlots(new Map());
            setAvailabilityLoading(false);
            setAvailabilityMessage('');
            return undefined;
        }

        let mounted = true;
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 12);
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
        const todayKey = formatDateKey(new Date());
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 90);
        const maxDateKey = formatDateKey(maxDate);
        const startDate = formatDateKey(monthStart) < todayKey ? todayKey : formatDateKey(monthStart);
        const endDate = formatDateKey(monthEnd) > maxDateKey ? maxDateKey : formatDateKey(monthEnd);

        setDatabaseSlots(new Map());
        setError('');
        setAvailabilityMessage('');
        if (!Number.isFinite(Number(selectedService.duration_minutes)) || Number(selectedService.duration_minutes) <= 0) {
            setAvailabilityLoading(false);
            setAvailabilityMessage('The owner needs to configure this service’s appointment duration before available dates can be shown.');
            return undefined;
        }
        if (endDate < startDate) {
            setAvailabilityLoading(false);
            setAvailabilityMessage(`Availability can be checked through ${formatDate(maxDateKey)}.`);
            return undefined;
        }

        setAvailabilityLoading(true);
        supabase.rpc('get_public_availability', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_service_id: selectedService.id
        }).then(({ data, error: availabilityError }) => {
            if (!mounted) return;
            if (availabilityError) {
                setError(`Could not load available times: ${availabilityError.message}`);
                setDatabaseSlots(new Map());
            } else {
                const slots = new Map();
                data.forEach((slot) => {
                    const key = slot.available_date;
                    const time = String(slot.starts_at_time).slice(0, 5);
                    slots.set(key, [...(slots.get(key) ?? []), time]);
                });
                setDatabaseSlots(slots);
                setAvailabilityMessage(slots.size
                    ? ''
                    : 'No available appointment times are configured for this month. The owner may need to add business hours, service duration, or date availability.');
            }
            setAvailabilityLoading(false);
        }).catch((availabilityError) => {
            if (!mounted) return;
            setError(`Could not load available times: ${availabilityError.message}`);
            setAvailabilityLoading(false);
        });

        return () => {
            mounted = false;
        };
    }, [month, selectedService?.duration_minutes, selectedService?.id]);

    // Clear a selection if a catalog refresh removes the chosen service.
    useEffect(() => {
        if (isSupabaseConfigured && service && !selectedService) {
            setService('');
            setDate('');
            setTime('');
        }
    }, [selectedService, service]);

    // Clear stale dates and times whenever the available date list changes.
    useEffect(() => {
        if (date && !slotsByDate.has(date)) {
            setDate('');
            setTime('');
        }
    }, [date, slotsByDate]);

    // Clear a selected time if that slot is no longer available.
    useEffect(() => {
        if (time && !availableSlots.includes(time)) setTime('');
    }, [availableSlots, time]);

    // Move the calendar and clear selections that belonged to the old month.
    const changeMonth = (offset) => {
        setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
        setDate('');
        setTime('');
    };

    // Recheck the selected slot and send the request through the safe configured path.
    const submitBooking = async (event) => {
        event.preventDefault();
        setConfirmation('');
        setError('');

        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        const booking = {
            id: crypto.randomUUID(),
            name: String(form.get('name')).trim(),
            email: String(form.get('email')).trim(),
            phone: String(form.get('phone')).trim(),
            service: selectedService?.name ?? service,
            duration: Number(selectedService?.duration),
            date,
            time,
            status: 'pending',
            source: 'customer',
            notes: ''
        };

        if (!availableSlots.includes(booking.time)) {
            setError('That time is no longer available. Please choose another time.');
            return;
        }

        setSubmitting(true);
        try {
            if (productionBookingEnabled) {
                const { error: bookingError } = await supabase.rpc('create_public_appointment', {
                    p_customer_name: booking.name,
                    p_customer_email: booking.email,
                    p_customer_phone: booking.phone,
                    p_service_id: selectedService.id,
                    p_appointment_date: date,
                    p_starts_at_time: time
                });
                if (bookingError) throw bookingError;
                setConfirmation(
                    `Appointment request received for ${booking.service} on ${formatDate(date)} at ${formatTime(time)}.`
                );
            } else if (isSupabaseConfigured) {
                setError('Online booking is not enabled yet. Please contact the business directly.');
                return;
            } else {
                saveAppointment(booking);
                setConfirmation(
                    `Demo request received for ${booking.service} on ${formatDate(date)} at ${formatTime(time)}.`
                );
            }
            formElement.reset();
            setService('');
            setDate('');
            setTime('');
        } catch (saveError) {
            setError(`Could not submit the appointment request: ${saveError.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <main className="booking-page">
                <section className="booking-card">
                    <h1>Book Your Appointment</h1>
                    <p className="demo-notice">
                        {productionBookingEnabled
                            ? 'Choose a service and available time. Appointment requests are securely validated and sent to the business.'
                            : isSupabaseConfigured
                                ? 'Current service prices are shown below. Online booking is disabled until the business schedule and booking workflow are configured and tested.'
                            : 'Development demo only. Requests are saved in this browser, not sent to the business. Please use fictional contact details.'}
                    </p>
                    {!isSupabaseConfigured && loadError && <p className="form-message form-error" role="alert">{loadError}</p>}
                    {isSupabaseConfigured && servicesError && <p className="form-message form-error" role="alert">{servicesError}</p>}
                    {isSupabaseConfigured && (
                        <button
                            type="button"
                            className="small-button"
                            onClick={refreshServices}
                            disabled={servicesLoading}
                        >
                            {servicesLoading ? 'Refreshing services…' : 'Refresh services'}
                        </button>
                    )}
                    <form className="booking-form" onSubmit={submitBooking}>
                        <div className="form-row">
                            <label htmlFor="service">1. Choose your lash service</label>
                            <select
                                id="service"
                                name="service"
                                value={service}
                                onChange={(event) => {
                                    setService(event.target.value);
                                    setDate('');
                                    setTime('');
                                    setError('');
                                }}
                                required
                                disabled={servicesLoading}
                            >
                                <option value="" disabled>Select a service</option>
                                {serviceGroups.map(([style, styleServices]) => {
                                    return (
                                        <optgroup label={style} key={style}>
                                            {styleServices.map((item) => (
                                                <option value={isSupabaseConfigured ? item.id : item.name} key={item.id ?? item.name}>
                                                    {item.name.replace(`${style} `, '')}
                                                    {Number(item.duration) > 0
                                                        ? ` · ${formatDuration(item.duration)}`
                                                        : isSupabaseConfigured ? ' · Duration not set' : ''}
                                                    {isSupabaseConfigured
                                                        ? ` · ${formatServicePrice(item.price)}`
                                                        : item.price !== '' ? ` · $${item.price}` : ' · Price TBD'}
                                                </option>
                                            ))}
                                        </optgroup>
                                    );
                                })}
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
                                <span>{isSupabaseConfigured
                                    ? formatServicePrice(selectedService.price)
                                    : selectedService.price !== '' ? `$${selectedService.price}` : 'Price TBD'}</span>
                            </section>
                        )}

                        {/* Dates are enabled only when the chosen service has an open slot. */}
                        <section className="booking-calendar-section" aria-labelledby="calendar-heading">
                            <div className="booking-section-heading">
                                <h2 id="calendar-heading">2. Choose an available date</h2>
                                {!service && <span>Choose a lash service above first</span>}
                            </div>
                            <div className={`booking-calendar${service ? '' : ' calendar-needs-service'}`}>
                                {!service && (
                                    <p className="booking-calendar-prompt" role="status">
                                        {isSupabaseConfigured && !productionBookingEnabled
                                            ? 'Choose a lash service to check its available dates. Online appointment requests remain turned off.'
                                            : 'Choose a lash service in step 1 to load availability and select a date.'}
                                    </p>
                                )}
                                {availabilityLoading && <p role="status">Loading available times…</p>}
                                {service && !productionBookingEnabled && isSupabaseConfigured && (
                                    <p className="booking-calendar-prompt" role="status">
                                        You can check available dates and times, but online appointment requests are not enabled yet.
                                    </p>
                                )}
                                {availabilityMessage && <p className="booking-calendar-prompt" role="status">{availabilityMessage}</p>}
                                <div className="booking-calendar-header">
                                    <button
                                        type="button"
                                        className="calendar-month-button"
                                        aria-label="Previous month"
                                        onClick={() => changeMonth(-1)}
                                    >
                                        ‹
                                    </button>
                                    <h3 aria-live="polite">{monthLabel}</h3>
                                    <button
                                        type="button"
                                        className="calendar-month-button"
                                        aria-label="Next month"
                                        onClick={() => changeMonth(1)}
                                    >
                                        ›
                                    </button>
                                </div>
                                <div className="booking-calendar-grid" aria-label={monthLabel}>
                                    {WEEKDAY_LABELS.map((weekday) => (
                                        <span className="booking-weekday" key={weekday}>
                                            {weekday}
                                        </span>
                                    ))}
                                    {getMonthCells(month).map((cell) => {
                                        const slots = slotsByDate.get(cell.key) ?? [];
                                        const available = cell.inMonth && slots.length > 0;
                                        const isPast = cell.key < formatDateKey(new Date());
                                        const disabled = !service || !cell.inMonth || isPast || !available;

                                        return (
                                            <button
                                                type="button"
                                                className={[
                                                    'booking-calendar-day',
                                                    available ? 'day-available' : 'day-unavailable',
                                                    date === cell.key ? 'day-selected' : '',
                                                    !cell.inMonth ? 'day-outside-month' : ''
                                                ].filter(Boolean).join(' ')}
                                                key={cell.key}
                                                disabled={disabled}
                                                aria-pressed={date === cell.key}
                                                aria-label={`${cell.date.toLocaleDateString(undefined, {
                                                    weekday: 'long',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}${!service
                                                    ? ', choose a service first'
                                                    : availabilityLoading
                                                        ? ', checking availability'
                                                        : available ? ', available' : ', unavailable'}`}
                                                onClick={() => {
                                                    setDate(cell.key);
                                                    setTime('');
                                                    setError('');
                                                }}
                                            >
                                                {cell.date.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="booking-calendar-legend" aria-label="Calendar key">
                                    <span><i className="legend-available" /> Available</span>
                                    <span><i className="legend-unavailable" /> Unavailable</span>
                                    <span><i className="legend-selected" /> Selected</span>
                                </div>
                            </div>
                        </section>

                        {/* Display times only after a service and available date are selected. */}
                        <section className="booking-time-section" aria-labelledby="time-heading">
                            <h2 id="time-heading">3. Choose an available time</h2>
                            {!service ? (
                                <p className="booking-help">Choose a service first to see available times.</p>
                            ) : !date ? (
                                <p className="booking-help">Choose an available date on the calendar.</p>
                            ) : availableSlots.length ? (
                                <div className="booking-time-grid">
                                    {availableSlots.map((slot) => (
                                        <button
                                            type="button"
                                            className={`booking-time-button${time === slot ? ' time-selected' : ''}`}
                                            aria-pressed={time === slot}
                                            key={slot}
                                            onClick={() => setTime(slot)}
                                        >
                                            {formatTime(slot)}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="booking-help">There are no available times on this date. Please choose another day.</p>
                            )}
                        </section>

                        <div className="booking-contact-section">
                            <h2>4. Your contact information</h2>
                            <div className="form-row">
                                <label htmlFor="name">Name</label>
                                <input type="text" id="name" name="name" placeholder="Your name" required />
                            </div>
                            <div className="form-row">
                                <label htmlFor="phone">Phone</label>
                                <input type="tel" id="phone" name="phone" placeholder="Your phone number" required />
                            </div>
                            <div className="form-row">
                                <label htmlFor="email">Email</label>
                                <input type="email" id="email" name="email" placeholder="Your email" required />
                            </div>
                        </div>

                        {service && date && time && (
                            <section className="booking-review" aria-label="Booking details">
                                <h2>5. Review your appointment</h2>
                                <p><strong>Service:</strong> {selectedService.name}</p>
                                <p><strong>Date:</strong> {formatDate(date)}</p>
                                <p><strong>Time:</strong> {formatTime(time)}</p>
                                <p><strong>Price:</strong> {isSupabaseConfigured
                                    ? formatServicePrice(selectedService.price)
                                    : selectedService.price !== '' ? `$${selectedService.price}` : 'Price TBD'}</p>
                            </section>
                        )}

                        <button
                            type="submit"
                            className="btn booking-btn"
                            disabled={
                                !service || !date || !time || submitting || availabilityLoading
                                || (isSupabaseConfigured && !productionBookingEnabled)
                            }
                        >
                            {submitting
                                ? 'Submitting…'
                                : productionBookingEnabled ? 'Submit appointment request' : 'Submit demo request'}
                        </button>
                    </form>
                    {error && <p className="form-message form-error" role="alert">{error}</p>}
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
            <Footer />
        </>
    );
}
