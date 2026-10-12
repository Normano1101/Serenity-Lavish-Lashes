import { useEffect, useMemo, useState } from 'react';
import {
    dateAfterDays,
    findConflicts,
    formatDate,
    formatDateKey,
    formatTime,
    getBookingSettings,
    getCalendarSlots
} from '../../data/appointments.js';

function addDays(dateKey, count) {
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() + count);
    return formatDateKey(date);
}

function getWeekStart(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    return formatDateKey(date);
}

function getMonthDates(dateKey) {
    const selected = new Date(`${dateKey}T12:00:00`);
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return formatDateKey(day);
    });
}

export default function Calendar({ appointments, selectedDate, onDateChange }) {
    const [view, setView] = useState('day');
    const [, setSettingsVersion] = useState(0);
    const settings = getBookingSettings();
    const conflicts = findConflicts(appointments, settings);
    const monthDates = useMemo(() => getMonthDates(selectedDate), [selectedDate]);
    const dayAppointments = appointments.filter((appointment) => appointment.date === selectedDate);
    const daySlots = getCalendarSlots(appointments, selectedDate, settings);

    useEffect(() => {
        const refresh = () => setSettingsVersion((version) => version + 1);
        window.addEventListener('serenity-demo-appointments-changed', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('serenity-demo-appointments-changed', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const visibleDates = view === 'day'
        ? [selectedDate]
        : view === 'week'
            ? Array.from({ length: 7 }, (_, index) => addDays(getWeekStart(selectedDate), index))
            : monthDates;

    return (
        <section className="admin-panel calendar-panel">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Availability</p>
                    <h2>Appointment calendar</h2>
                </div>
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
                                {item.charAt(0).toUpperCase() + item.slice(1)}
                            </button>
                        ))}
                    </div>
                    <label className="admin-date-picker">
                        Choose a date
                        <input
                            type="date"
                            min={formatDateKey(new Date())}
                            value={selectedDate}
                            onChange={(event) => onDateChange(event.target.value)}
                        />
                    </label>
                </div>
            </div>

            <div className={`calendar-date-grid calendar-${view}`}>
                {visibleDates.map((date) => {
                    const dateItems = appointments.filter((appointment) =>
                        appointment.date === date && appointment.status !== 'cancelled'
                    );
                    const otherMonth = view === 'month'
                        && date.slice(0, 7) !== selectedDate.slice(0, 7);
                    return (
                        <button
                            type="button"
                            key={date}
                            className={`calendar-date-card${date === selectedDate ? ' selected-date' : ''}${otherMonth ? ' other-month' : ''}`}
                            onClick={() => onDateChange(date)}
                        >
                            <strong>{view === 'month' ? new Date(`${date}T12:00:00`).getDate() : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                            <span>{dateItems.length} appointment{dateItems.length === 1 ? '' : 's'}</span>
                        </button>
                    );
                })}
            </div>

            <h3 className="calendar-selected-heading">
                {formatDate(selectedDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>

            {!daySlots.length && (
                <p className="calendar-note">Closed on this date. Check schedule hours or add a working-hours override.</p>
            )}

            <ul className="calendar-slots">
                {daySlots.map((slot) => {
                    const conflict = slot.appointment && conflicts.has(slot.appointment.id);
                    return (
                        <li
                            className={`calendar-slot slot-${conflict ? 'conflict' : slot.status}${slot.appointmentStatus ? ` appointment-${slot.appointmentStatus}` : ''}`}
                            key={slot.time}
                        >
                            <strong>{formatTime(slot.time)}</strong>
                            <span>{conflict ? 'Conflict' : slot.status}</span>
                            {slot.label && <small>{slot.label}</small>}
                            {slot.appointment && (
                                <small>{slot.appointment.service} · {slot.appointment.status}</small>
                            )}
                        </li>
                    );
                })}
            </ul>

            {dayAppointments.some((appointment) => appointment.status === 'cancelled') && (
                <p className="calendar-note">
                    Cancelled appointments do not block availability:
                    {dayAppointments.filter((appointment) => appointment.status === 'cancelled').map((appointment) => (
                        <span key={appointment.id}> {appointment.name} — {formatTime(appointment.time)}.</span>
                    ))}
                </p>
            )}
        </section>
    );
}
