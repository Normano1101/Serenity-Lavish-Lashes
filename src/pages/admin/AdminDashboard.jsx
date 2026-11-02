import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider.jsx';
import Footer from '../../components/Footer.jsx';
import { getDateKeyInTimeZone } from '../../data/appointments.js';
import { supabase } from '../../lib/supabase.js';
import useAppointments from '../../hooks/useAppointments.js';
import Appointments from './Appointments.jsx';
import AdminAccounts from './AdminAccounts.jsx';
import Calendar from './Calendar.jsx';
import ManageSchedule from './ManageSchedule.jsx';
import ServicesManagement from './ServicesManagement.jsx';
import './admin.css';

// Combine appointment summaries, calendar, schedule, service tools, and admin accounts.
export default function AdminDashboard() {
    const { configured, profile, signOut } = useAuth();
    const { appointments, error } = useAppointments();
    const [authError, setAuthError] = useState('');
    const [businessTimezone, setBusinessTimezone] = useState(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    );
    const todayDateKey = getDateKeyInTimeZone(new Date(), businessTimezone);
    const [selectedDate, setSelectedDate] = useState(todayDateKey);
    const [timezoneError, setTimezoneError] = useState('');
    const todayCount = appointments.filter((appointment) => appointment.date === todayDateKey).length;
    const upcomingCount = appointments.filter((appointment) =>
        appointment.date > todayDateKey
        && appointment.status !== 'cancelled'
    ).length;
    const pendingCount = appointments.filter((appointment) => appointment.status === 'pending').length;
    const confirmedCount = appointments.filter((appointment) => appointment.status === 'confirmed').length;
    const cancelledCount = appointments.filter((appointment) => appointment.status === 'cancelled').length;

    // Use the saved business timezone so the dashboard's “today” matches the studio.
    useEffect(() => {
        if (!configured || !supabase) return undefined;

        let mounted = true;
        supabase
            .from('booking_settings')
            .select('business_timezone')
            .eq('id', true)
            .maybeSingle()
            .then(({ data, error: settingsError }) => {
                if (!mounted) return;
                if (settingsError) {
                    setTimezoneError(`Could not load the business timezone: ${settingsError.message}`);
                    return;
                }
                if (!data?.business_timezone) return;
                try {
                    const businessToday = getDateKeyInTimeZone(new Date(), data.business_timezone);
                    setBusinessTimezone(data.business_timezone);
                    setSelectedDate(businessToday);
                    setTimezoneError('');
                } catch (timezoneLoadError) {
                    setTimezoneError(`The configured business timezone is invalid: ${timezoneLoadError.message}`);
                }
            })
            .catch((settingsError) => {
                if (mounted) setTimezoneError(`Could not load the business timezone: ${settingsError.message}`);
            });

        return () => {
            mounted = false;
        };
    }, [configured]);
    // Sign out without hiding any authentication error from the admin.
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

                {/* Distinguish shared Supabase catalog data from local-only demo appointments. */}
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
                {timezoneError && <p className="form-message form-error" role="alert">{timezoneError}</p>}

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
                    todayDateKey={todayDateKey}
                />
                <ServicesManagement />
                <ManageSchedule />
                <Appointments appointments={appointments} />
                {profile?.role === 'super_admin' && <AdminAccounts />}
            </main>
            <Footer />
        </>
    );
}
