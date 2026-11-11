// The admin appointments table, with buttons to view, edit, confirm, reschedule and cancel.
import { useEffect, useState } from 'react';
import { ErrorMessage, SuccessMessage } from '../../components/Messages.jsx';
import { createAdminAppointment, updateAdminAppointment } from '../../data/adminAppointments.js';
import { formatDate, formatTime } from '../../data/dates.js';
import { capitalize } from '../../lib/utils.js';
import AppointmentEditor from './AppointmentEditor.jsx';
import PanelHeading from './PanelHeading.jsx';

const FILTERS = ['all', 'today', 'upcoming', 'pending', 'confirmed', 'cancelled'];

export default function Appointments({
    appointments,
    selectedDate,
    todayDateKey,
    requestedAction,
    onActionHandled,
    refreshAppointments
}) {
    const [filter, setFilter] = useState('all');
    // The open pop-up, as { mode, appointment }, or null when it's closed.
    const [editor, setEditor] = useState(null);
    const [actionError, setActionError] = useState('');
    const [notice, setNotice] = useState('');

    const clearMessages = () => {
        setActionError('');
        setNotice('');
    };

    const changeStatus = async (appointment, status, successNotice, failureText) => {
        clearMessages();
        try {
            await updateAdminAppointment(appointment.id, { status });
            await refreshAppointments();
            setNotice(successNotice);
        } catch (error) {
            setActionError(`${failureText}: ${error.message}`);
        }
    };

    const cancelAppointment = (appointment) => {
        if (!window.confirm(`Cancel ${appointment.name}'s appointment on ${formatDate(appointment.date)}?`)) return;
        void changeStatus(
            appointment,
            'cancelled',
            'Appointment cancelled. Its time is available for new bookings.',
            'Could not cancel appointment'
        );
    };

    // Used by the editor's buttons and by requests from the calendar.
    const openAction = (appointment, action) => {
        if (action === 'cancel') {
            setEditor(null);
            cancelAppointment(appointment);
        } else {
            setEditor({ mode: action, appointment });
        }
    };

    // Handle a request sent from the calendar, such as "edit this appointment".
    useEffect(() => {
        if (!requestedAction) return;
        onActionHandled();
        if (requestedAction.action === 'add') {
            setEditor({ mode: 'add', appointment: null });
            return;
        }
        const appointment = appointments.find((item) => item.id === requestedAction.id);
        if (appointment) openAction(appointment, requestedAction.action);
        else setActionError('That appointment is no longer available. Refresh and try again.');
    }, [requestedAction, appointments]);

    // Called by the editor. Errors are thrown back so the editor can show them in its form.
    const saveAppointment = async (values, mode) => {
        clearMessages();
        if (mode === 'add') {
            await createAdminAppointment(values);
            setNotice('Appointment added successfully.');
        } else {
            const { id, source, ...changes } = values;
            if (!changes.serviceId) delete changes.serviceId;
            await updateAdminAppointment(id, changes);
            setNotice(mode === 'reschedule' ? 'Appointment rescheduled.' : 'Appointment updated.');
        }
        await refreshAppointments();
        setEditor(null);
    };

    const visibleAppointments = appointments.filter((appointment) => {
        if (filter === 'today') return appointment.date === todayDateKey;
        if (filter === 'upcoming') return appointment.date > todayDateKey && appointment.status !== 'cancelled';
        return filter === 'all' || appointment.status === filter;
    });

    return (
        <section className="admin-panel appointments-panel" id="clients">
            <PanelHeading eyebrow="Client bookings" title="Appointments">
                <div className="appointment-list-controls">
                    <label className="admin-filter">
                        Show
                        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                            {FILTERS.map((value) => <option value={value} key={value}>{capitalize(value)}</option>)}
                        </select>
                    </label>
                    <button type="button" className="small-button" onClick={() => refreshAppointments()}>
                        Refresh
                    </button>
                </div>
            </PanelHeading>

            <ErrorMessage>{actionError}</ErrorMessage>
            <SuccessMessage>{notice}</SuccessMessage>
            {editor && (
                <div
                    className="appointment-editor-backdrop"
                    onClick={(event) => {
                        // Clicking outside the pop-up closes it.
                        if (event.target === event.currentTarget) setEditor(null);
                    }}
                >
                    <AppointmentEditor
                        mode={editor.mode}
                        appointment={editor.appointment}
                        appointments={appointments}
                        onSave={saveAppointment}
                        onCancel={() => setEditor(null)}
                        onAction={openAction}
                    />
                </div>
            )}

            <div className="admin-table-wrap">
                <table className="appointments-table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Service</th>
                            <th>Date &amp; time</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleAppointments.map((appointment, index) => (
                            <tr key={`${appointment.id ?? 'appointment'}-${index}`}>
                                <td>
                                    <strong>{appointment.name}</strong>
                                    <span className="appointment-contact">{appointment.email}</span>
                                    <span className="appointment-contact">{appointment.phone}</span>
                                </td>
                                <td>{appointment.service}</td>
                                <td>{formatDate(appointment.date)}<span className="appointment-contact">{formatTime(appointment.time)}</span></td>
                                <td><span className={`status-tag status-${appointment.status}`}>{appointment.status}</span></td>
                                <td>
                                    <div className="appointment-actions">
                                        <button type="button" className="small-button" onClick={() => openAction(appointment, 'details')}>Details</button>
                                        <button type="button" className="small-button" onClick={() => openAction(appointment, 'edit')}>Edit</button>
                                        {appointment.status === 'pending' && (
                                            <button
                                                type="button"
                                                className="small-button"
                                                onClick={() => changeStatus(appointment, 'confirmed', 'Appointment confirmed.', 'Could not update appointment')}
                                            >
                                                Confirm
                                            </button>
                                        )}
                                        {appointment.status !== 'cancelled' && (
                                            <>
                                                <button type="button" className="small-button" onClick={() => openAction(appointment, 'reschedule')}>Reschedule</button>
                                                <button type="button" className="small-button danger-button" onClick={() => openAction(appointment, 'cancel')}>Cancel</button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!visibleAppointments.length && (
                            <tr><td colSpan="5">No appointments match this filter.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="appointments-date-context">Selected date: {formatDate(selectedDate)}</p>
        </section>
    );
}
