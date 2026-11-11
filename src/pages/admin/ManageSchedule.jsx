// The "Manage Schedule" panel: weekly hours and breaks, plus one-off date rules.
import { useEffect, useState } from 'react';
import { ErrorMessage, SuccessMessage } from '../../components/Messages.jsx';
import { getBookingSettings, saveBookingSettings, subscribeToAppointments } from '../../data/appointments.js';
import { loadBusinessSchedule, saveBusinessSchedule, validateSchedule } from '../../data/businessSchedule.js';
import { getBrowserTimezone } from '../../data/dates.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';
import DateRulesManager from './DateRulesManager.jsx';
import PanelHeading from './PanelHeading.jsx';
import WeeklyScheduleEditor from './WeeklyScheduleEditor.jsx';

const BOOKING_INTERVALS = [
    { minutes: 15, label: '15 minutes' },
    { minutes: 30, label: '30 minutes' },
    { minutes: 45, label: '45 minutes' },
    { minutes: 60, label: '1 hour' },
    { minutes: 90, label: '1.5 hours' },
    { minutes: 120, label: '2 hours' }
];

// Make a full copy, so editing the form can't change the saved settings by accident.
function copySettings(settings) {
    return {
        ...settings,
        schedule: Object.fromEntries(Object.entries(settings.schedule).map(([day, hours]) => [
            day,
            { ...hours, breaks: hours.breaks.map((item) => ({ ...item })) }
        ])),
        services: Object.fromEntries(Object.entries(settings.services).map(([service, details]) => [
            service,
            { ...details }
        ])),
        dateRules: settings.dateRules.map((rule) => ({ ...rule }))
    };
}

export default function ManageSchedule() {
    const [settings, setSettings] = useState(() => copySettings(getBookingSettings()));
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [saving, setSaving] = useState(false);
    const [hasOpenBusinessHours, setHasOpenBusinessHours] = useState(!isSupabaseConfigured);
    const [businessTimezone, setBusinessTimezone] = useState(getBrowserTimezone);

    // Demo mode: pick up changes saved elsewhere.
    useEffect(() => subscribeToAppointments(() => {
        try {
            setSettings(copySettings(getBookingSettings()));
        } catch (loadError) {
            setError(loadError.message);
        }
    }), []);

    // Live site: load the shared schedule from the database.
    useEffect(() => {
        if (!isSupabaseConfigured) return undefined;

        let active = true;
        loadBusinessSchedule()
            .then(({ timezone, interval, schedule, hasOpenHours }) => {
                if (!active) return;
                setBusinessTimezone(timezone);
                setHasOpenBusinessHours(hasOpenHours);
                setSettings((current) => ({ ...current, interval, schedule }));
                setError('');
            })
            .catch((loadError) => {
                if (active) setError(`Could not load shared business hours: ${loadError.message}`);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    // Change some fields of one day, leaving its other fields alone.
    const updateDay = (day, updates) => {
        setSettings((current) => ({
            ...current,
            schedule: { ...current.schedule, [day]: { ...current.schedule[day], ...updates } }
        }));
        setMessage('');
    };

    const updateService = (service, updates) => {
        setSettings((current) => ({
            ...current,
            services: { ...current.services, [service]: { ...current.services[service], ...updates } }
        }));
        setMessage('');
    };

    const saveSchedule = async (event) => {
        event.preventDefault();
        setMessage('');

        const problem = validateSchedule(settings);
        setError(problem);
        if (problem) return;

        try {
            if (isSupabaseConfigured) {
                setSaving(true);
                setHasOpenBusinessHours(await saveBusinessSchedule(settings));
                setMessage('Business hours and breaks saved to Supabase. Public availability now uses this schedule.');
            } else {
                saveBookingSettings(settings);
                setMessage('Demo hours saved in this browser. Shared date rules are saved separately to Supabase.');
            }
        } catch (saveError) {
            setError(`Could not save schedule: ${saveError.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="admin-panel schedule-panel" id="availability">
            <PanelHeading
                eyebrow={isSupabaseConfigured ? 'Shared scheduling settings' : 'Owner settings · Demo only'}
                title="Manage Schedule"
            >
                <label className="schedule-interval">
                    Booking interval
                    <select
                        value={settings.interval}
                        onChange={(event) => setSettings((current) => ({ ...current, interval: Number(event.target.value) }))}
                    >
                        {BOOKING_INTERVALS.map(({ minutes, label }) => (
                            <option value={minutes} key={minutes}>{label}</option>
                        ))}
                    </select>
                </label>
            </PanelHeading>

            <ErrorMessage>{error}</ErrorMessage>
            <SuccessMessage>{message}</SuccessMessage>

            <form onSubmit={saveSchedule}>
                <WeeklyScheduleEditor
                    settings={settings}
                    loading={loading}
                    hasOpenBusinessHours={hasOpenBusinessHours}
                    onDayChange={updateDay}
                    onServiceChange={updateService}
                />

                <DateRulesManager businessTimezone={businessTimezone} />

                <button type="submit" className="btn booking-btn save-schedule-button" disabled={loading || saving}>
                    {saving ? 'Saving schedule…' : 'Save Schedule'}
                </button>
            </form>
        </section>
    );
}
