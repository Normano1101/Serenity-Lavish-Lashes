// The admin dashboard page. It holds the sidebar and summary cards, then places the panels:
// calendar, appointments, services, schedule, and (for super admins) accounts.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBarChart2, FiCalendar, FiClock, FiGrid, FiLogOut, FiPlus, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../auth/AuthProvider.jsx';
import AppShell from '../../components/AppShell.jsx';
import { ErrorMessage } from '../../components/Messages.jsx';
import { addDays, getBrowserTimezone, getDateKeyInTimeZone, getWeekStart } from '../../data/dates.js';
import useAppointments from '../../hooks/useAppointments.js';
import { supabase } from '../../lib/supabase.js';
import AdminAccounts from './AdminAccounts.jsx';
import Appointments from './Appointments.jsx';
import Calendar from './Calendar.jsx';
import ManageSchedule from './ManageSchedule.jsx';
import ServicesManagement from './ServicesManagement.jsx';
import './admin.css';
import './admin-calendar.css';
import './admin-schedule.css';
import './admin-appointments.css';
import './admin-responsive.css';

// Each sidebar link jumps to a section further down this page.
const NAVIGATION_ITEMS = [
    { label: 'Appointments', href: '#appointments-calendar', icon: FiCalendar },
    { label: 'Clients', href: '#clients', icon: FiUsers },
    { label: 'Services', href: '#services', icon: FiGrid },
    { label: 'Availability', href: '#availability', icon: FiClock },
    { label: 'Reports', href: '#reports', icon: FiBarChart2 }
];

const SUMMARY_CARDS = [
    { key: 'today', label: 'Today', unit: 'appointments', icon: FiCalendar },
    { key: 'week', label: 'This Week', unit: 'appointments', icon: FiCalendar },
    { key: 'month', label: 'This Month', unit: 'appointments', icon: FiCalendar },
    { key: 'clients', label: 'Total Clients', unit: 'clients', icon: FiUsers }
];

// Count the numbers on the summary cards. Cancelled appointments don't count; clients are unique emails.
function getSummary(appointments, today) {
    const weekStart = getWeekStart(today);
    const weekEnd = addDays(weekStart, 6);
    const active = appointments.filter((item) => item.status !== 'cancelled');

    return {
        today: active.filter((item) => item.date === today).length,
        week: active.filter((item) => item.date >= weekStart && item.date <= weekEnd).length,
        month: active.filter((item) => item.date.startsWith(today.slice(0, 7))).length,
        clients: new Set(appointments.map((item) => item.email.trim().toLowerCase()).filter(Boolean)).size
    };
}

export default function AdminDashboard() {
    const { configured, profile, signOut } = useAuth();
    const { appointments, error, loading, refresh } = useAppointments();
    const [authError, setAuthError] = useState('');
    const [businessTimezone, setBusinessTimezone] = useState(getBrowserTimezone);
    const todayDateKey = getDateKeyInTimeZone(new Date(), businessTimezone);
    const [selectedDate, setSelectedDate] = useState(todayDateKey);
    // Lets the calendar ask the appointments panel to open or cancel something: { id, action }.
    const [requestedAction, setRequestedAction] = useState(null);
    const [timezoneError, setTimezoneError] = useState('');
    const [activeNavigation, setActiveNavigation] = useState('Appointments');
    const summary = useMemo(() => getSummary(appointments, todayDateKey), [appointments, todayDateKey]);
    const isSuperAdmin = profile?.role === 'super_admin';

    // Use the studio's saved timezone, so "today" on the dashboard is the studio's today.
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

    const logout = async () => {
        setAuthError('');
        try {
            await signOut();
        } catch (signOutError) {
            setAuthError(`Could not sign out: ${signOutError.message}`);
        }
    };

    return (
        <AppShell
            role={isSuperAdmin ? 'Super Admin' : configured ? 'Admin' : 'Admin · Demo'}
            navLabel="Admin dashboard"
            nav={NAVIGATION_ITEMS.map(({ label, href, icon: Icon }) => (
                <a
                    className={activeNavigation === label ? 'is-active' : ''}
                    href={href}
                    key={label}
                    aria-current={activeNavigation === label ? 'page' : undefined}
                    onClick={() => setActiveNavigation(label)}
                >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                </a>
            ))}
            footer={(
                <>
                    <Link to="/booking">Customer booking page</Link>
                    {configured && (
                        <button type="button" onClick={logout}>
                            <FiLogOut aria-hidden="true" />
                            Sign out
                        </button>
                    )}
                </>
            )}
        >
            <main>
                <div className="admin-page">
                    <header className="admin-header">
                        <div>
                            <p className="eyebrow">
                                {configured
                                    ? `${isSuperAdmin ? 'Super Admin' : 'Owner'} · Signed in`
                                    : 'Owner tools · Development demo'}
                            </p>
                            <h1>Appointment Calendar</h1>
                            <p className="admin-header-subtitle">Manage, view, and edit your appointments</p>
                        </div>
                        <div className="admin-header-actions">
                            <button
                                type="button"
                                className="admin-new-appointment"
                                onClick={() => setRequestedAction({ action: 'add' })}
                            >
                                <FiPlus aria-hidden="true" />
                                New Appointment
                            </button>
                        </div>
                    </header>

                    <aside className="admin-security-notice" role="note">
                        <strong>{configured
                            ? 'Authenticated admin · private appointment data is protected by database policies.'
                            : 'Unsecured development demo · do not enter real client information.'}
                        </strong>
                    </aside>

                    <ErrorMessage>{error}</ErrorMessage>
                    <ErrorMessage>{authError}</ErrorMessage>
                    <ErrorMessage>{timezoneError}</ErrorMessage>

                    <section className="admin-summary" id="reports" aria-label="Appointment overview">
                        {SUMMARY_CARDS.map(({ key, label, unit, icon: Icon }) => (
                            <article className={`summary-${key}`} key={key}>
                                <Icon aria-hidden="true" />
                                <div>
                                    <span>{label}</span>
                                    <strong>{loading ? '—' : summary[key]}</strong>
                                    <small>{unit}</small>
                                </div>
                            </article>
                        ))}
                    </section>

                    <Calendar
                        appointments={appointments}
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        todayDateKey={todayDateKey}
                        onAppointmentAction={(id, action) => setRequestedAction({ id, action })}
                        onAddAppointment={() => setRequestedAction({ action: 'add' })}
                    />
                    <div className="admin-secondary-sections">
                        <Appointments
                            appointments={appointments}
                            selectedDate={selectedDate}
                            todayDateKey={todayDateKey}
                            requestedAction={requestedAction}
                            onActionHandled={() => setRequestedAction(null)}
                            refreshAppointments={refresh}
                        />
                        <ServicesManagement />
                        <ManageSchedule />
                        {isSuperAdmin && <AdminAccounts />}
                    </div>
                </div>
            </main>
        </AppShell>
    );
}
