import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.jsx';
import Footer from '../../components/Footer.jsx';
import { formatDateKey } from '../../data/appointments.js';
import useAppointments from '../../hooks/useAppointments.js';
import Appointments from './Appointments.jsx';
import AdminAccounts from './AdminAccounts.jsx';
import Calendar from './Calendar.jsx';
import ManageSchedule from './ManageSchedule.jsx';
import ServicesManagement from './ServicesManagement.jsx';
import ServiceAddonsManagement from './ServiceAddonsManagement.jsx';
import './admin.css';

export default function AdminDashboard() {
    const { configured, profile, signOut } = useAuth();
    const { appointments, error } = useAppointments();
    const [authError, setAuthError] = useState('');
    const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
    const todayCount = appointments.filter((appointment) => appointment.date === formatDateKey(new Date())).length;
    const upcomingCount = appointments.filter((appointment) =>
        appointment.date > formatDateKey(new Date())
        && appointment.status !== 'cancelled'
    ).length;
    const pendingCount = appointments.filter((appointment) => appointment.status === 'pending').length;
    const confirmedCount = appointments.filter((appointment) => appointment.status === 'confirmed').length;
    const cancelledCount = appointments.filter((appointment) => appointment.status === 'cancelled').length;
    const logout = async () => {
        setAuthError('');
        try {
            await signOut();
        } catch (signOutError) {
            setAuthError(`Could not sign out: ${signOutError.message}`);
        }
    };

    return (
        <>
            <main className="admin-page">
                <header className="admin-header">
                    <div>
                        <p className="eyebrow">
                            {configured
                                ? `${profile?.role === 'super_admin' ? 'Super Admin' : 'Owner'} · Signed in`
                                : 'Owner tools · Development demo'}
                        </p>
                        <h1>Appointment Dashboard</h1>
                    </div>
                    <div className="admin-header-actions">
                        <Link className="admin-back-link" to="/booking">Customer booking page</Link>
                        {configured && <button type="button" className="admin-logout-button" onClick={logout}>Log out</button>}
                    </div>
                </header>

                <aside className="admin-security-notice" role="note">
                    <strong>
                        {configured
                            ? 'AUTHENTICATED ADMIN · APPOINTMENT DATA IS STILL DEMO-ONLY.'
                            : 'UNSECURED DEVELOPMENT DEMO — NOT PRIVATE.'}
                    </strong>
                    <span>
                        {configured
                            ? 'Supabase Auth verifies your account. Service and pricing changes are shared through PostgreSQL; appointment and schedule tools still use this browser’s localStorage.'
                            : 'Appointments live only in this browser’s local storage. There is no account, server, or database. Do not enter real customer information or deploy this dashboard.'}
                    </span>
                    {!configured && (
                        <span>Rows marked SAMPLE are fictional examples; website test requests and manual demo entries are stored separately.</span>
                    )}
                </aside>

                {error && <p className="form-message form-error" role="alert">{error}</p>}
                {authError && <p className="form-message form-error" role="alert">{authError}</p>}

                <section className="admin-summary" aria-label="Appointment totals">
                    <article><span>Today&apos;s appointments</span><strong>{todayCount}</strong></article>
                    <article><span>Upcoming</span><strong>{upcomingCount}</strong></article>
                    <article><span>Pending</span><strong>{pendingCount}</strong></article>
                    <article><span>Confirmed</span><strong>{confirmedCount}</strong></article>
                    <article><span>Cancelled</span><strong>{cancelledCount}</strong></article>
                </section>

                <Calendar
                    appointments={appointments}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                />
                <ServicesManagement />
                <ServiceAddonsManagement />
                <ManageSchedule />
                <Appointments appointments={appointments} />
                {profile?.role === 'super_admin' && <AdminAccounts />}
            </main>
            <Footer />
        </>
    );
}
