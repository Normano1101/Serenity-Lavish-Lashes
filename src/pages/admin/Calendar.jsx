// The admin calendar: a day, week or month grid, with the selected day's appointments beside it.
import { useEffect, useMemo, useState } from 'react';
import { FiClock, FiEdit2, FiEye, FiPlus } from 'react-icons/fi';
import { ErrorMessage } from '../../components/Messages.jsx';
import { findConflicts, getCalendarSlots } from '../../data/appointments.js';
import {
    addDays,
    dateAfterDays,
    formatDate,
    formatDateKey,
    formatDuration,
    formatTime,
    getMondayMonthGrid,
    getWeekStart,
    parseDateKey
} from '../../data/dates.js';
import { fetchAvailableSlots } from '../../data/publicAvailability.js';
import useBookingSettings from '../../hooks/useBookingSettings.js';
import useServices from '../../hooks/useServices.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';
import { capitalize, classNames, plural } from '../../lib/utils.js';
import PanelHeading from './PanelHeading.jsx';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DATE = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

// The date keys to draw for the current view.
function getVisibleDates(view, selectedDate) {
    if (view === 'day') return [selectedDate];
    if (view === 'week') {
        const weekStart = getWeekStart(selectedDate);
        return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    }
    return getMondayMonthGrid(parseDateKey(selectedDate)).map(formatDateKey);
}

function getPeriodLabel(view, selectedDate, visibleDates) {
    if (view === 'month') return parseDateKey(selectedDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (view === 'week') return `${formatDate(visibleDates[0])} – ${formatDate(visibleDates[6])}`;
    return formatDate(selectedDate, FULL_DATE);
}

function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// One date in the grid. Month view also previews up to two appointments.
function DateCard({ date, view, appointments, selectedDate, todayDateKey, onSelect }) {
    const isMonthView = view === 'month';
    const isToday = date === todayDateKey;
    const count = appointments.length;
    const countLabel = count ? `, ${count} ${plural(count, 'appointment')}` : '';

    return (
        <button
            type="button"
            className={classNames(
                'calendar-date-card',
                date === selectedDate && 'selected-date',
                isToday && 'today-date',
                isMonthView && date.slice(0, 7) !== selectedDate.slice(0, 7) && 'other-month'
            )}
            aria-pressed={date === selectedDate}
            aria-label={`${formatDate(date, FULL_DATE)}${countLabel}${isToday ? ', today' : ''}`}
            onClick={() => onSelect(date)}
        >
            <strong>{isMonthView
                ? parseDateKey(date).getDate()
                : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
            </strong>
            {count > 0 && (
                <span className="calendar-appointment-count">
                    <i aria-hidden="true" />
                    {count} {isMonthView ? 'appt' : plural(count, 'appointment')}
                </span>
            )}
            {isMonthView && appointments.slice(0, 2).map((appointment) => (
                <span className={`calendar-mini-appointment service-${appointment.service.toLowerCase().split(' ')[0]}`} key={appointment.id}>
                    {formatTime(appointment.time)} {appointment.service}
                </span>
            ))}
            {isMonthView && count > 2 && <span className="calendar-more-appointments">+{count - 2} more</span>}
        </button>
    );
}

// Day and week views: the open times on the selected date.
function DayAvailability({ slots, conflicts, loading }) {
    if (loading) return <p className="calendar-note" role="status">Checking availability…</p>;
    if (!slots.length) return <p className="calendar-note">No open times on this date. Check business hours or date blocks.</p>;

    return (
        <ul className={`calendar-open-slots${isSupabaseConfigured ? '' : ' is-demo-slots'}`}>
            {isSupabaseConfigured
                ? slots.map((slot, index) => (
                    <li key={`${slot.time}-${slot.service}-${index}`}>
                        <strong>{formatTime(slot.time)}</strong>
                        <span>Available · {slot.service}</span>
                    </li>
                ))
                : slots.map((slot) => {
                    const conflict = slot.appointment && conflicts.has(slot.appointment.id);
                    return (
                        <li className={`slot-${conflict ? 'conflict' : slot.status}`} key={slot.time}>
                            <strong>{formatTime(slot.time)}</strong>
                            <span>{conflict ? 'Conflict' : slot.status}</span>
                            {slot.label && <small>{slot.label}</small>}
                        </li>
                    );
                })}
        </ul>
    );
}

// The side panel: the selected day's appointments and shortcut buttons.
function DayDetailPanel({ selectedDate, appointments, conflicts, onAppointmentAction, onAddAppointment }) {
    const activeCount = appointments.filter((item) => item.status !== 'cancelled').length;

    return (
        <aside className="calendar-detail-panel" aria-label={`Appointments on ${formatDate(selectedDate)}`}>
            <header className="calendar-detail-heading">
                <h3>{formatDate(selectedDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                <span>{activeCount} {plural(activeCount, 'Appointment')}</span>
            </header>
            {appointments.length === 0 ? (
                <div className="calendar-empty-state">
                    <strong>A little breathing room.</strong>
                    <p>No appointments scheduled.</p>
                </div>
            ) : (
                <div className="calendar-appointment-list">
                    {appointments.map((appointment, index) => (
                        <article className={`calendar-appointment-card${conflicts.has(appointment.id) ? ' has-conflict' : ''}`} key={`${appointment.id ?? 'appointment'}-${index}`}>
                            <time>{formatTime(appointment.time)}</time>
                            <div className="calendar-appointment-info">
                                <strong>{appointment.name}</strong>
                                <span>{appointment.service}</span>
                                <small>{formatDuration(appointment.duration)} · {appointment.status}</small>
                            </div>
                            <button
                                type="button"
                                className="calendar-icon-action"
                                aria-label={`Edit ${appointment.name}'s appointment`}
                                onClick={() => onAppointmentAction(appointment.id, 'edit')}
                            >
                                <FiEdit2 aria-hidden="true" />
                            </button>
                        </article>
                    ))}
                </div>
            )}
            <button type="button" className="calendar-side-primary" onClick={onAddAppointment}>
                <FiPlus aria-hidden="true" />
                Add Appointment
            </button>
            <button type="button" className="calendar-side-action" onClick={() => scrollToSection('availability')}>
                <FiEdit2 aria-hidden="true" />
                Edit Availability
            </button>
            <button type="button" className="calendar-side-action" onClick={() => scrollToSection('block-time')}>
                <FiClock aria-hidden="true" />
                Block Time
            </button>
            {appointments[0] && (
                <button type="button" className="calendar-side-action" onClick={() => onAppointmentAction(appointments[0].id, 'details')}>
                    <FiEye aria-hidden="true" />
                    View Client
                </button>
            )}
            <div className="calendar-legend">
                <strong>Legend</strong>
                <span><i className="legend-classic" />Classic Set</span>
                <span><i className="legend-hybrid" />Hybrid Set</span>
                <span><i className="legend-volume" />Volume Set</span>
                <span><i className="legend-blocked" />Blocked / Unavailable</span>
            </div>
        </aside>
    );
}

export default function Calendar({
    appointments,
    selectedDate,
    onDateChange,
    todayDateKey,
    onAppointmentAction,
    onAddAppointment
}) {
    const [view, setView] = useState('month');
    const [availability, setAvailability] = useState([]);
    const [availabilityError, setAvailabilityError] = useState('');
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const settings = useBookingSettings();
    const { services } = useServices();

    const conflicts = findConflicts(appointments, settings);
    const visibleDates = useMemo(() => getVisibleDates(view, selectedDate), [view, selectedDate]);
    const activeAppointments = appointments.filter((item) => item.status !== 'cancelled');
    const dayAppointments = appointments
        .filter((item) => item.date === selectedDate)
        .sort((first, second) => first.time.localeCompare(second.time));
    const daySlots = isSupabaseConfigured ? availability : getCalendarSlots(appointments, selectedDate, settings);

    // Live site: ask the database for the selected day's free times, for every bookable service.
    useEffect(() => {
        if (!isSupabaseConfigured || selectedDate < todayDateKey) {
            setAvailability([]);
            setAvailabilityError('');
            setAvailabilityLoading(false);
            return undefined;
        }

        const bookableServices = services.filter((service) =>
            service.id && service.is_active && Number(service.duration_minutes) > 0
        );
        if (!bookableServices.length) {
            setAvailability([]);
            setAvailabilityLoading(false);
            return undefined;
        }

        let active = true;
        setAvailabilityLoading(true);
        setAvailabilityError('');
        Promise.all(bookableServices.map(async (service) => {
            const slots = await fetchAvailableSlots(selectedDate, selectedDate, service.id);
            return slots.map((slot) => ({ time: slot.time, service: service.name }));
        })).then((serviceSlots) => {
            if (active) {
                setAvailability(serviceSlots.flat().sort((first, second) =>
                    first.time.localeCompare(second.time) || first.service.localeCompare(second.service)
                ));
            }
        }).catch((error) => {
            if (active) {
                setAvailability([]);
                setAvailabilityError(`Could not load available times: ${error.message}`);
            }
        }).finally(() => {
            if (active) setAvailabilityLoading(false);
        });

        return () => {
            active = false;
        };
    }, [selectedDate, services, todayDateKey]);

    // The arrow buttons move by one month, week or day. direction is -1 or 1.
    const movePeriod = (direction) => {
        if (view === 'month') {
            const date = parseDateKey(selectedDate);
            date.setDate(1);
            date.setMonth(date.getMonth() + direction);
            onDateChange(formatDateKey(date));
            return;
        }
        onDateChange(addDays(selectedDate, (view === 'week' ? 7 : 1) * direction));
    };

    return (
        <section className="admin-panel calendar-panel" id="appointments-calendar">
            <PanelHeading eyebrow="Studio schedule" title="Appointment calendar">
                <div className="calendar-controls">
                    <div className="calendar-view-toggle" role="group" aria-label="Calendar view">
                        {['day', 'week', 'month'].map((item) => (
                            <button
                                className={view === item ? 'calendar-view-active' : ''}
                                type="button"
                                key={item}
                                aria-pressed={view === item}
                                onClick={() => setView(item)}
                            >
                                {capitalize(item)}
                            </button>
                        ))}
                    </div>
                    <div className="calendar-period-controls">
                        <button type="button" className="small-button" aria-label="Previous period" onClick={() => movePeriod(-1)}>‹</button>
                        <button type="button" className="small-button" onClick={() => onDateChange(todayDateKey || dateAfterDays(0))}>Today</button>
                        <button type="button" className="small-button" aria-label="Next period" onClick={() => movePeriod(1)}>›</button>
                    </div>
                    <label className="admin-date-picker">
                        Choose a date
                        <input type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
                    </label>
                </div>
            </PanelHeading>

            <div className="calendar-workspace">
                <div className="calendar-month-area">
                    <div className="calendar-period-label" aria-live="polite">{getPeriodLabel(view, selectedDate, visibleDates)}</div>
                    {view === 'month' && (
                        <div className="calendar-weekday-headings" aria-hidden="true">
                            {WEEKDAY_LABELS.map((weekday) => <span key={weekday}>{weekday}</span>)}
                        </div>
                    )}
                    <div className={`calendar-date-grid calendar-${view}`}>
                        {visibleDates.map((date) => (
                            <DateCard
                                key={date}
                                date={date}
                                view={view}
                                appointments={activeAppointments.filter((item) => item.date === date)}
                                selectedDate={selectedDate}
                                todayDateKey={todayDateKey}
                                onSelect={onDateChange}
                            />
                        ))}
                    </div>

                    {view !== 'month' && (
                        <>
                            <ErrorMessage>{availabilityError}</ErrorMessage>
                            <section className="calendar-availability" aria-label="Available appointment times">
                                <h3>{isSupabaseConfigured ? 'Open appointment times' : 'Day schedule & open times'}</h3>
                                <DayAvailability slots={daySlots} conflicts={conflicts} loading={availabilityLoading} />
                            </section>
                        </>
                    )}
                </div>

                <DayDetailPanel
                    selectedDate={selectedDate}
                    appointments={dayAppointments}
                    conflicts={conflicts}
                    onAppointmentAction={onAppointmentAction}
                    onAddAppointment={onAddAppointment}
                />
            </div>
        </section>
    );
}
