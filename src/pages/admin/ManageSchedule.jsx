// The "Manage Schedule" panel: weekly hours and breaks, plus one-off date rules.
import { useEffect, useState } from 'react';
import { ErrorMessage, SuccessMessage } from '../../components/Messages.jsx';
import {
    BOOKING_INTERVAL_MINUTES,
    getBookingSettings,
    saveBookingSettings,
    subscribeToAppointments
} from '../../data/appointments.js';
import { loadBusinessSchedule, saveBusinessSchedule, validateSchedule } from '../../data/businessSchedule.js';
import { formatDuration, getBrowserTimezone } from '../../data/dates.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';
import DateRulesManager from './DateRulesManager.jsx';
import PanelHeading from './PanelHeading.jsx';
import WeeklyScheduleEditor from './WeeklyScheduleEditor.jsx';

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
            />

            <p className="schedule-interval-note">
                Appointments start every <strong>{formatDuration(BOOKING_INTERVAL_MINUTES)}</strong> from opening time.
            </p>

            {/* The Save button sits right under the hours it saves. Date rules below save on their own. */}
            <form onSubmit={saveSchedule}>
                <WeeklyScheduleEditor
                    settings={settings}
                    loading={loading}
                    hasOpenBusinessHours={hasOpenBusinessHours}
                    onDayChange={updateDay}
                    onServiceChange={updateService}
                />

                <div className="save-schedule-actions">
                    <button type="submit" className="btn booking-btn save-schedule-button" disabled={loading || saving}>
                        {saving ? 'Saving schedule…' : 'Save Schedule'}
                    </button>
                    <ErrorMessage>{error}</ErrorMessage>
                    <SuccessMessage>{message}</SuccessMessage>
                </div>
            </form>

            <DateRulesManager businessTimezone={businessTimezone} />
        </section>
    );
}
