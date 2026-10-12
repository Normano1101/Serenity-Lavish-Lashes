import { useState } from 'react';
import {
    dateAfterDays,
    findConflicts,
    formatDate,
    formatDuration,
    formatTime,
    getBookingSettings,
    getAvailableSlots,
    saveAppointment,
    SERVICES,
    updateAppointment
} from '../../data/appointments.js';

const FILTERS = ['all', 'today', 'upcoming', 'pending', 'confirmed', 'cancelled'];

function isToday(appointment) {
    return appointment.date === dateAfterDays(0);
}

function isUpcoming(appointment) {
    return appointment.date > dateAfterDays(0) && appointment.status !== 'cancelled';
}

export default function Appointments({ appointments }) {
    const [filter, setFilter] = useState('all');
    const [detailsId, setDetailsId] = useState(null);
    const [rescheduleId, setRescheduleId] = useState(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('');
    const [manualDate, setManualDate] = useState(dateAfterDays(1));
    const [manualService, setManualService] = useState('');
    const [manualError, setManualError] = useState('');
    const [actionError, setActionError] = useState('');
    const settings = getBookingSettings();
    const conflicts = findConflicts(appointments, settings);
    const activeServices = SERVICES
        .filter((name) => settings.services[name]?.active && Number(settings.services[name].duration) > 0)
        .map((name) => ({ name, ...settings.services[name] }));

    const visibleAppointments = appointments.filter((appointment) => {
        if (filter === 'today') return isToday(appointment);
        if (filter === 'upcoming') return isUpcoming(appointment);
        return filter === 'all' || appointment.status === filter;
    });

    const changeStatus = (appointment, status) => {
        setActionError('');
        try {
            updateAppointment(appointment.id, { status });
        } catch (error) {
            setActionError(error.message);
        }
    };

    const reschedule = (event, appointment) => {
        event.preventDefault();
        setActionError('');
        const available = getAvailableSlots(appointments, rescheduleDate, {
            settings,
            service: appointment.service,
            duration: appointment.duration,
            excludeId: appointment.id
        });
        if (!available.includes(rescheduleTime)) {
            setActionError('That date and time is occupied. Choose an available time.');
            return;
        }
        try {
            updateAppointment(appointment.id, {
                date: rescheduleDate,
                time: rescheduleTime,
                status: 'pending'
            });
            setRescheduleId(null);
        } catch (error) {
            setActionError(error.message);
        }
    };

    const addManualAppointment = (event) => {
        event.preventDefault();
        setManualError('');
        const form = new FormData(event.currentTarget);
        const appointment = {
            id: crypto.randomUUID(),
            name: String(form.get('manual-name')).trim(),
            email: String(form.get('manual-email')).trim(),
            phone: String(form.get('manual-phone')).trim(),
            service: manualService,
            duration: Number(settings.services[manualService]?.duration),
            date: manualDate,
            time: String(form.get('manual-time')),
            status: 'confirmed',
            source: 'manual',
            notes: String(form.get('manual-notes')).trim()
        };

        const manualSlots = getAvailableSlots(appointments, manualDate, {
            settings,
            service: manualService
        });
        if (!manualSlots.includes(appointment.time)) {
            setManualError('That date and time is occupied. Choose an available time.');
            return;
        }

        try {
            saveAppointment(appointment);
            event.currentTarget.reset();
            setManualDate(dateAfterDays(1));
            setManualService('');
        } catch (error) {
            setManualError(`Could not add the demo appointment: ${error.message}`);
        }
    };

    return (
        <section className="admin-panel">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Schedule</p>
                    <h2>Appointments</h2>
                </div>
                <label className="admin-filter">
                    Show
                    <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                        {FILTERS.map((value) => (
                            <option value={value} key={value}>
                                {value.charAt(0).toUpperCase() + value.slice(1)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {actionError && <p className="form-message form-error" role="alert">{actionError}</p>}

            <div className="admin-table-wrap">
                <table className="appointments-table">
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th>Service</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleAppointments.map((appointment) => (
                            <tr key={appointment.id} className={conflicts.has(appointment.id) ? 'has-conflict' : ''}>
                                <td>
                                    <strong>{appointment.name}</strong>
                                    {appointment.source === 'sample' && <span className="sample-tag">SAMPLE</span>}
                                    {appointment.source === 'manual' && <span className="source-tag">MANUAL DEMO</span>}
                                    {appointment.source === 'customer' && <span className="source-tag">WEBSITE DEMO</span>}
                                    {conflicts.has(appointment.id) && <span className="conflict-tag">CONFLICT</span>}
                                </td>
                                <td>{appointment.service}</td>
                                <td>{formatDate(appointment.date)}</td>
                                <td>{formatTime(appointment.time)}</td>
                                <td><span className={`status-tag status-${appointment.status}`}>{appointment.status}</span></td>
                                <td>
                                    <div className="appointment-actions">
                                        <button
                                            type="button"
                                            className="small-button"
                                            aria-expanded={detailsId === appointment.id}
                                            onClick={() => setDetailsId(detailsId === appointment.id ? null : appointment.id)}
                                        >
                                            {detailsId === appointment.id ? 'Hide details' : 'Details'}
                                        </button>
                                        {appointment.status !== 'cancelled' && (
                                            <>
                                                {appointment.status === 'pending' && (
                                                    <button type="button" className="small-button" onClick={() => changeStatus(appointment, 'confirmed')}>
                                                        Confirm
                                                    </button>
                                                )}
                                                <button type="button" className="small-button danger-button" onClick={() => changeStatus(appointment, 'cancelled')}>
                                                    Cancel
                                                </button>
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            className="small-button"
                                            onClick={() => {
                                                setRescheduleId(rescheduleId === appointment.id ? null : appointment.id);
                                                setRescheduleDate(appointment.date);
                                                setRescheduleTime(appointment.time);
                                            }}
                                        >
                                            Reschedule
                                        </button>
                                    </div>
                                    {detailsId === appointment.id && (
                                        <div className="appointment-details">
                                            <span>Email: {appointment.email}</span>
                                            <span>Phone: {appointment.phone}</span>
                                            <span>Source: {appointment.source}</span>
                                            {appointment.notes && <span>Notes: {appointment.notes}</span>}
                                        </div>
                                    )}
                                    {rescheduleId === appointment.id && (
                                        <form className="reschedule-form" onSubmit={(event) => reschedule(event, appointment)}>
                                            <label>
                                                New date
                                                <input
                                                    type="date"
                                                    min={dateAfterDays(0)}
                                                    value={rescheduleDate}
                                                    onChange={(event) => {
                                                        setRescheduleDate(event.target.value);
                                                        setRescheduleTime('');
                                                    }}
                                                    required
                                                />
                                            </label>
                                            <label>
                                                Available time
                                                <select value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} required>
                                                    <option value="">Choose a time</option>
                                                    {getAvailableSlots(appointments, rescheduleDate, {
                                                        settings,
                                                        service: appointment.service,
                                                        duration: appointment.duration,
                                                        excludeId: appointment.id
                                                    }).map((time) => (
                                                        <option value={time} key={time}>{formatTime(time)}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button className="small-button" type="submit">Save new time</button>
                                        </form>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!visibleAppointments.length && (
                            <tr><td colSpan="6">No appointments match this filter.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <details className="manual-appointment">
                <summary>Add a manual appointment (development demo)</summary>
                <p>Use this for a fictional appointment received by phone, text, or Instagram.</p>
                {manualError && <p className="form-message form-error" role="alert">{manualError}</p>}
                <form className="admin-form-grid" onSubmit={addManualAppointment}>
                    <label>Customer name<input name="manual-name" required /></label>
                    <label>Email<input type="email" name="manual-email" required /></label>
                    <label>Phone<input type="tel" name="manual-phone" required /></label>
                    <label>Service
                        <select
                            name="manual-service"
                            value={manualService}
                            onChange={(event) => setManualService(event.target.value)}
                            required
                        >
                            <option value="" disabled>Select service</option>
                            {activeServices.map((service) => (
                                <option value={service.name} key={service.name}>
                                    {service.name} · {formatDuration(service.duration)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>Date
                        <input
                            type="date"
                            min={dateAfterDays(0)}
                            value={manualDate}
                            onChange={(event) => setManualDate(event.target.value)}
                            required
                        />
                    </label>
                    <label>Available time
                        <select name="manual-time" defaultValue="" required>
                            <option value="" disabled>Choose a time</option>
                        {getAvailableSlots(appointments, manualDate, {
                            settings,
                            service: manualService
                        }).map((time) => (
                            <option value={time} key={time}>{formatTime(time)}</option>
                        ))}
                        </select>
                    </label>
                    <label className="admin-notes-field">Notes<input name="manual-notes" placeholder="Optional note" /></label>
                    <button type="submit" className="btn booking-btn">Add confirmed demo appointment</button>
                </form>
            </details>
        </section>
    );
}
