import { useEffect, useState } from 'react';
import {
    formatDuration,
    formatDate,
    formatDateKey,
    getDateKeyInTimeZone,
    getBookingSettings,
    saveBookingSettings,
    SERVICES,
    WEEKDAYS,
    toMinutes
} from '../../data/appointments.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';

// Keep the calendar's Monday-first labels aligned with its date grid.
const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Offer the booking intervals supported by the schedule editor.
const BOOKING_INTERVALS = [
    { minutes: 15, label: '15 minutes' },
    { minutes: 30, label: '30 minutes' },
    { minutes: 45, label: '45 minutes' },
    { minutes: 60, label: '1 hour' },
    { minutes: 90, label: '1.5 hours' },
    { minutes: 120, label: '2 hours' }
];

// Clone nested settings so edits do not mutate the currently saved state.
function copySettings(settings) {
    return {
        ...settings,
        schedule: Object.fromEntries(Object.entries(settings.schedule).map(([day, hours]) => [
            day,
            { ...hours, breaks: hours.breaks.map((breakTime) => ({ ...breakTime })) }
        ])),
        services: Object.fromEntries(Object.entries(settings.services).map(([service, details]) => [
            service,
            { ...details }
        ])),
        dateRules: settings.dateRules.map((rule) => ({ ...rule }))
    };
}

// Move the calendar to the first day of a neighboring month.
function shiftMonth(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

// Build the six-week Monday-first grid shown by the date-rule calendar.
function getMonthDates(month) {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
}

// Convert database column names and times into the editor's rule shape.
function mapDatabaseRule(rule) {
    return {
        id: rule.id,
        date: rule.rule_date,
        type: rule.rule_type,
        start: rule.starts_at?.slice(0, 5) ?? '',
        end: rule.ends_at?.slice(0, 5) ?? '',
        open: rule.opens_at?.slice(0, 5) ?? '',
        close: rule.closes_at?.slice(0, 5) ?? '',
        label: rule.label
    };
}

// Convert an editor rule into the database columns for its selected date.
function toDatabaseRule(rule, date) {
    return {
        rule_date: date,
        rule_type: rule.type,
        starts_at: rule.type === 'block' ? rule.start : null,
        ends_at: rule.type === 'block' ? rule.end : null,
        opens_at: rule.type === 'hours' ? rule.open : null,
        closes_at: rule.type === 'hours' ? rule.close : null,
        label: rule.label.trim() || 'Unavailable'
    };
}

// Edit weekly hours, breaks, service durations, and date-specific exceptions.
export default function ManageSchedule() {
    const [settings, setSettings] = useState(() => copySettings(getBookingSettings()));
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [scheduleLoading, setScheduleLoading] = useState(isSupabaseConfigured);
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [hasOpenBusinessHours, setHasOpenBusinessHours] = useState(!isSupabaseConfigured);
    const [dateRules, setDateRules] = useState([]);
    const [dateRulesLoading, setDateRulesLoading] = useState(isSupabaseConfigured);
    const [dateRulesError, setDateRulesError] = useState('');
    const [dateRulesRefreshKey, setDateRulesRefreshKey] = useState(0);
    const [selectedDates, setSelectedDates] = useState([]);
    const [rangeSelection, setRangeSelection] = useState(false);
    const [rangeAnchor, setRangeAnchor] = useState('');
    const [editingRuleId, setEditingRuleId] = useState('');
    const [businessTimezone, setBusinessTimezone] = useState(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    );
    const [todayDateKey, setTodayDateKey] = useState(() => formatDateKey(new Date()));
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1, 12);
    });
    const [savingDateRules, setSavingDateRules] = useState(false);
    const [ruleForm, setRuleForm] = useState({
        type: 'closed',
        start: '12:00',
        end: '13:00',
        open: '09:00',
        close: '17:00',
        label: 'Unavailable'
    });

    // Keep local demo settings synchronized with other schedule tools.
    useEffect(() => {
        const refresh = () => {
            try {
                setSettings(copySettings(getBookingSettings()));
            } catch (loadError) {
                setError(loadError.message);
            }
        };
        window.addEventListener('serenity-demo-appointments-changed', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('serenity-demo-appointments-changed', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    // Load shared date rules, timezone, weekly hours, and breaks from Supabase.
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase) {
            setDateRulesLoading(false);
            return undefined;
        }

        let mounted = true;
        const loadDateRules = async () => {
            setDateRulesLoading(true);
            try {
                const [
                    { data: rules, error: rulesError },
                    { data: bookingSettings, error: timezoneError },
                    { data: weeklySchedule, error: scheduleError },
                    { data: scheduleBreaks, error: breaksError }
                ] = await Promise.all([
                    supabase.from('date_rules')
                        .select('id, rule_date, rule_type, starts_at, ends_at, opens_at, closes_at, label, created_at')
                        .order('rule_date')
                        .order('created_at'),
                    supabase.from('booking_settings')
                        .select('business_timezone, booking_interval_minutes')
                        .eq('id', true)
                        .maybeSingle(),
                    supabase.from('weekly_schedule')
                        .select('day_of_week, is_open, opens_at, closes_at'),
                    supabase.from('schedule_breaks')
                        .select('id, day_of_week, starts_at, ends_at, label')
                ]);
                if (rulesError) throw rulesError;
                if (timezoneError) throw timezoneError;
                if (scheduleError) throw scheduleError;
                if (breaksError) throw breaksError;
                if (!mounted) return;

                const timezone = bookingSettings?.business_timezone || 'UTC';
                const today = getDateKeyInTimeZone(new Date(), timezone);
                setBusinessTimezone(timezone);
                setTodayDateKey(today);
                setCalendarMonth((current) => {
                    if (current.getFullYear() === new Date(`${today}T12:00:00`).getFullYear()
                        && current.getMonth() === new Date(`${today}T12:00:00`).getMonth()) {
                        return current;
                    }
                    const [year, month] = today.split('-').map(Number);
                    return new Date(year, month - 1, 1, 12);
                });
                setDateRules((rules ?? []).map(mapDatabaseRule));
                // Join normalized schedule and break rows into the editor's weekday shape.
                const dayRows = new Map((weeklySchedule ?? []).map((day) => [String(day.day_of_week), day]));
                setHasOpenBusinessHours((weeklySchedule ?? []).some((day) => day.is_open));
                const breaksByDay = new Map();
                (scheduleBreaks ?? []).forEach((breakItem) => {
                    const key = String(breakItem.day_of_week);
                    breaksByDay.set(key, [
                        ...(breaksByDay.get(key) ?? []),
                        {
                            start: breakItem.starts_at.slice(0, 5),
                            end: breakItem.ends_at.slice(0, 5),
                            label: breakItem.label
                        }
                    ]);
                });
                setSettings((current) => ({
                    ...current,
                    interval: Number(bookingSettings?.booking_interval_minutes) || 30,
                    schedule: Object.fromEntries(WEEKDAYS.map(({ key }) => {
                        const day = dayRows.get(key);
                        return [key, {
                            enabled: Boolean(day?.is_open),
                            open: day?.opens_at?.slice(0, 5) || '09:00',
                            close: day?.closes_at?.slice(0, 5) || '17:00',
                            breaks: breaksByDay.get(key) ?? []
                        }];
                    }))
                }));
                setDateRulesError('');
                setError('');
            } catch (loadError) {
                if (mounted) {
                    setDateRulesError(`Could not load saved schedule data: ${loadError.message}`);
                    setError(`Could not load shared business hours: ${loadError.message}`);
                }
            } finally {
                if (mounted) {
                    setDateRulesLoading(false);
                    setScheduleLoading(false);
                }
            }
        };

        loadDateRules();
        // Refresh date rules when another admin updates shared availability.
        const channel = supabase.channel('admin-date-rules')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'date_rules'
            }, loadDateRules)
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setDateRulesError('Live date-rule updates are unavailable. Refresh the schedule to get the latest changes.');
                }
            });

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [dateRulesRefreshKey]);

    // Apply a partial edit to one weekday without replacing its other settings.
    const updateDay = (day, updates) => {
        setSettings((current) => ({
            ...current,
            schedule: { ...current.schedule, [day]: { ...current.schedule[day], ...updates } }
        }));
        setMessage('');
    };

    // Apply a partial edit to one service's demo duration/price settings.
    const updateService = (service, updates) => {
        setSettings((current) => ({
            ...current,
            services: { ...current.services, [service]: { ...current.services[service], ...updates } }
        }));
        setMessage('');
    };

    // Validate weekly settings before saving them locally or to Supabase.
    const saveSchedule = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');

        for (const { key, label } of WEEKDAYS) {
            const day = settings.schedule[key];
            if (day.enabled && day.close <= day.open) {
                setError(`${label}: closing time must be later than opening time.`);
                return;
            }
            if (day.breaks.some((item) => item.end <= item.start)) {
                setError(`${label}: each break must end after it starts.`);
                return;
            }
            if (day.enabled && day.breaks.some((item) =>
                toMinutes(item.start) < toMinutes(day.open)
                || toMinutes(item.end) > toMinutes(day.close)
            )) {
                setError(`${label}: breaks must fall within working hours.`);
                return;
            }
        }

        for (const [service, details] of Object.entries(settings.services)) {
            if (details.duration && (!Number.isFinite(Number(details.duration)) || Number(details.duration) <= 0)) {
                setError(`${service}: duration must be a positive number of minutes.`);
                return;
            }
            if (details.price && (!Number.isFinite(Number(details.price)) || Number(details.price) < 0)) {
                setError(`${service}: price must be a non-negative number.`);
                return;
            }
        }

        try {
            if (isSupabaseConfigured && supabase) {
                setScheduleSaving(true);
                const weeklySchedule = WEEKDAYS.map(({ key }) => {
                    const day = settings.schedule[key];
                    return {
                        day_of_week: Number(key),
                        is_open: day.enabled,
                        opens_at: day.enabled ? day.open : null,
                        closes_at: day.enabled ? day.close : null
                    };
                });
                const scheduleBreaks = WEEKDAYS.flatMap(({ key }) =>
                    settings.schedule[key].breaks.map((breakTime) => ({
                        day_of_week: Number(key),
                        starts_at: breakTime.start,
                        ends_at: breakTime.end,
                        label: breakTime.label || 'Break'
                    }))
                );
                const { error: saveError } = await supabase.rpc('save_business_schedule', {
                    p_booking_interval_minutes: Number(settings.interval),
                    p_weekly_schedule: weeklySchedule,
                    p_schedule_breaks: scheduleBreaks
                });
                if (saveError) throw saveError;
                setHasOpenBusinessHours(weeklySchedule.some((day) => day.is_open));
                setMessage('Business hours and breaks saved to Supabase. Public availability now uses this schedule.');
            } else {
                saveBookingSettings(settings);
                setMessage('Demo hours saved in this browser. Shared date rules are saved separately to Supabase.');
            }
        } catch (saveError) {
            setError(`Could not save schedule: ${saveError.message}`);
        } finally {
            setScheduleSaving(false);
        }
    };

    // Clear the date selection and restore the default new-rule form.
    const resetRuleEditor = () => {
        setSelectedDates([]);
        setRangeAnchor('');
        setRangeSelection(false);
        setEditingRuleId('');
        setRuleForm({
            type: 'closed',
            start: '12:00',
            end: '13:00',
            open: '09:00',
            close: '17:00',
            label: 'Unavailable'
        });
    };

    // Select individual days or create a continuous date range.
    const selectCalendarDate = (dateKey) => {
        if (rangeSelection) {
            if (!rangeAnchor) {
                setRangeAnchor(dateKey);
                setSelectedDates([dateKey]);
                setEditingRuleId('');
                return;
            }
            const first = new Date(`${rangeAnchor}T12:00:00`);
            const last = new Date(`${dateKey}T12:00:00`);
            const direction = first <= last ? 1 : -1;
            const dates = [];
            for (const current = new Date(first); direction > 0 ? current <= last : current >= last; current.setDate(current.getDate() + direction)) {
                dates.push(formatDateKey(current));
            }
            setSelectedDates(dates);
            setRangeAnchor('');
            setEditingRuleId('');
            return;
        }

        setSelectedDates((current) => current.includes(dateKey)
            ? current.filter((item) => item !== dateKey)
            : [...current, dateKey].sort());
        setRangeAnchor('');
        setEditingRuleId('');
    };

    // Load an existing exception into the editor for an in-place update.
    const editDateRule = (rule) => {
        setSelectedDates([rule.date]);
        setEditingRuleId(rule.id);
        setRangeAnchor('');
        setRuleForm({
            type: rule.type,
            start: rule.start || '12:00',
            end: rule.end || '13:00',
            open: rule.open || '09:00',
            close: rule.close || '17:00',
            label: rule.label || ''
        });
    };

    // Validate and save selected date exceptions after warning about affected bookings.
    const saveDateRules = async () => {
        setError('');
        setDateRulesError('');
        if (!isSupabaseConfigured || !supabase) {
            setDateRulesError('Configure Supabase to save shared date rules.');
            return;
        }
        if (!selectedDates.length) {
            setDateRulesError('Select at least one date on the calendar.');
            return;
        }

        const rule = {
            ...ruleForm,
            label: ruleForm.label.trim() || 'Unavailable'
        };

        if (rule.type === 'block' && rule.end <= rule.start) {
            setError('A blocked time range must end after it starts.');
            return;
        }
        if (rule.type === 'hours' && rule.close <= rule.open) {
            setError('Override closing time must be later than opening time.');
            return;
        }

        const dates = [...selectedDates].sort();
        try {
            const { data: appointments, error: appointmentsError } = await supabase
                .from('appointments')
                .select('appointment_date, starts_at_time, duration_minutes, status')
                .in('appointment_date', dates)
                .in('status', ['pending', 'confirmed']);
            if (appointmentsError) throw appointmentsError;

            const affected = appointments.filter((appointment) => {
                if (rule.type === 'closed') return true;
                const startMinutes = toMinutes(appointment.starts_at_time);
                const endMinutes = startMinutes + appointment.duration_minutes;
                if (rule.type === 'hours') {
                    return startMinutes < toMinutes(rule.open) || endMinutes > toMinutes(rule.close);
                }
                return startMinutes < toMinutes(rule.end) && endMinutes > toMinutes(rule.start);
            });
            if (affected.length && !window.confirm(
                `This change affects ${affected.length} existing pending or confirmed appointment${affected.length === 1 ? '' : 's'}. They will not be changed, but the affected time may no longer be bookable. Continue?`
            )) return;

            setSavingDateRules(true);
            if (editingRuleId) {
                const [firstDate, ...remainingDates] = dates;
                const { data: updatedRule, error: updateError } = await supabase
                    .from('date_rules')
                    .update(toDatabaseRule(rule, firstDate))
                    .eq('id', editingRuleId)
                    .select('id')
                    .maybeSingle();
                if (updateError) throw updateError;
                if (!updatedRule) throw new Error('This rule could not be updated. Check your admin access and try again.');
                if (remainingDates.length) {
                    const { error: insertError } = await supabase
                        .from('date_rules')
                        .insert(remainingDates.map((date) => toDatabaseRule(rule, date)));
                    if (insertError) throw insertError;
                }
            } else {
                const { error: insertError } = await supabase
                    .from('date_rules')
                    .insert(dates.map((date) => toDatabaseRule(rule, date)));
                if (insertError) throw insertError;
            }

            const { data: savedRules, error: reloadError } = await supabase
                .from('date_rules')
                .select('id, rule_date, rule_type, starts_at, ends_at, opens_at, closes_at, label, created_at')
                .order('rule_date')
                .order('created_at');
            if (reloadError) throw reloadError;
            setDateRules(savedRules.map(mapDatabaseRule));
            resetRuleEditor();
            setMessage('Date rules saved. Existing appointments were not changed.');
        } catch (saveError) {
            setDateRulesError(`Could not save date rules: ${saveError.message}`);
        } finally {
            setSavingDateRules(false);
        }
    };

    // Delete a shared date exception and refresh the editor's saved rules.
    const removeDateRule = async (rule) => {
        if (!window.confirm(`Remove the ${rule.label || 'date'} rule for ${formatDate(rule.date)}?`)) return;
        try {
            const { data: deletedRule, error: deleteError } = await supabase
                .from('date_rules')
                .delete()
                .eq('id', rule.id)
                .select('id')
                .maybeSingle();
            if (deleteError) throw deleteError;
            if (!deletedRule) throw new Error('This rule could not be removed. Check your admin access and try again.');
            setDateRules((current) => current.filter((item) => item.id !== rule.id));
            if (editingRuleId === rule.id) resetRuleEditor();
            setMessage('Date rule removed. Existing appointments were not changed.');
            setDateRulesError('');
        } catch (deleteError) {
            setDateRulesError(`Could not remove date rule: ${deleteError.message}`);
        }
    };

    const monthDates = getMonthDates(calendarMonth);
    const monthTitle = calendarMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
    });
    const selectedRules = dateRules.filter((rule) => selectedDates.includes(rule.date));

    // Summarize the rules attached to a date for its calendar badge.
    const getDateStatus = (dateKey) => {
        const rules = dateRules.filter((rule) => rule.date === dateKey);
        if (rules.some((rule) => rule.type === 'closed')) return 'closed';
        if (rules.some((rule) => rule.type === 'block')) return 'block';
        if (rules.some((rule) => rule.type === 'hours')) return 'hours';
        return '';
    };

    // Open an existing date rule or add the clicked date to the current selection.
    const handleCalendarDateClick = (dateKey) => {
        const wasSelected = selectedDates.includes(dateKey);
        if (editingRuleId && !wasSelected) {
            const existingRule = dateRules.find((rule) => rule.date === dateKey);
            setSelectedDates([dateKey]);
            setRangeAnchor('');
            setEditingRuleId('');
            if (existingRule) {
                editDateRule(existingRule);
            } else {
                setRuleForm({
                    type: 'closed',
                    start: '12:00',
                    end: '13:00',
                    open: '09:00',
                    close: '17:00',
                    label: 'Unavailable'
                });
            }
            return;
        }
        selectCalendarDate(dateKey);
        if (rangeSelection) return;
        if (wasSelected) {
            setEditingRuleId('');
            return;
        }
        const dateRule = dateRules.find((rule) => rule.date === dateKey);
        if (dateRule && selectedDates.length === 0) editDateRule(dateRule);
    };

    return (
        <section className="admin-panel schedule-panel">
            {/* Weekly hours and breaks define the repeating business schedule. */}
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">{isSupabaseConfigured ? 'Shared scheduling settings' : 'Owner settings · Demo only'}</p>
                    <h2>Manage Schedule</h2>
                </div>
                <label className="schedule-interval">
                    Booking interval
                    <select
                        value={settings.interval}
                        onChange={(event) => setSettings((current) => ({
                            ...current,
                            interval: Number(event.target.value)
                        }))}
                    >
                        {BOOKING_INTERVALS.map(({ minutes, label }) => (
                            <option value={minutes} key={minutes}>{label}</option>
                        ))}
                    </select>
                </label>
            </div>

            {error && <p className="form-message form-error" role="alert">{error}</p>}
            {message && <p className="form-message form-success" role="status">{message}</p>}

            <form onSubmit={saveSchedule}>
                <h3>Weekly working hours and breaks</h3>
                <p className="schedule-help">
                    {isSupabaseConfigured
                        ? 'Set the actual business hours and optional breaks for each day. Closed days stay unavailable. These shared settings determine dates and times shown on the Booking page.'
                        : 'These hours are browser-only demo settings. Break times are optional.'}
                </p>
                {scheduleLoading && <p className="schedule-help" role="status">Loading shared business hours…</p>}
                {isSupabaseConfigured && !scheduleLoading && !hasOpenBusinessHours && (
                    <p className="form-message form-error" role="status">
                        No open business hours are saved in Supabase yet. Dates will remain unavailable on the Booking page until the owner enters and saves at least one open day.
                    </p>
                )}
                <div className="schedule-day-list">
                    {WEEKDAYS.map(({ key, label }) => {
                        const day = settings.schedule[key];
                        return (
                            <fieldset className="schedule-day" key={key}>
                                <legend>{label}</legend>
                                <label className="schedule-open-toggle">
                                    <input
                                        type="checkbox"
                                        checked={day.enabled}
                                        onChange={(event) => updateDay(key, { enabled: event.target.checked })}
                                    />
                                    Working
                                </label>
                                <label>Opens
                                    <input
                                        type="time"
                                        value={day.open}
                                        disabled={!day.enabled}
                                        onChange={(event) => updateDay(key, { open: event.target.value })}
                                    />
                                </label>
                                <label>Closes
                                    <input
                                        type="time"
                                        value={day.close}
                                        disabled={!day.enabled}
                                        onChange={(event) => updateDay(key, { close: event.target.value })}
                                    />
                                </label>
                                <div className="schedule-breaks">
                                    <strong>Breaks</strong>
                                    {day.breaks.map((breakTime, index) => (
                                        <div className="schedule-break-row" key={`${key}-${index}`}>
                                            <label>From
                                                <input
                                                    type="time"
                                                    value={breakTime.start}
                                                    disabled={!day.enabled}
                                                    onChange={(event) => updateDay(key, {
                                                        breaks: day.breaks.map((item, itemIndex) =>
                                                            itemIndex === index ? { ...item, start: event.target.value } : item
                                                        )
                                                    })}
                                                />
                                            </label>
                                            <label>To
                                                <input
                                                    type="time"
                                                    value={breakTime.end}
                                                    disabled={!day.enabled}
                                                    onChange={(event) => updateDay(key, {
                                                        breaks: day.breaks.map((item, itemIndex) =>
                                                            itemIndex === index ? { ...item, end: event.target.value } : item
                                                        )
                                                    })}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                className="small-button danger-button"
                                                onClick={() => updateDay(key, {
                                                    breaks: day.breaks.filter((_, itemIndex) => itemIndex !== index)
                                                })}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="small-button"
                                        disabled={!day.enabled}
                                        onClick={() => updateDay(key, {
                                            breaks: [...day.breaks, { start: '12:00', end: '13:00' }]
                                        })}
                                    >
                                        Add break
                                    </button>
                                </div>
                            </fieldset>
                        );
                    })}
                </div>

                {!isSupabaseConfigured && (
                    <>
                        <h3 className="schedule-subheading">Demo service durations and prices</h3>
                        <p className="schedule-help">
                            These browser-only settings are for the development demo. Configure shared services in Services &amp; Pricing.
                        </p>
                        <div className="service-settings-list">
                            {SERVICES.map((service) => {
                                const details = settings.services[service];
                                return (
                                    <fieldset className="service-setting" key={service}>
                                        <legend>{service}</legend>
                                        <label className="schedule-open-toggle">
                                            <input
                                                type="checkbox"
                                                checked={details.active}
                                                onChange={(event) => updateService(service, { active: event.target.checked })}
                                            />
                                            Active
                                        </label>
                                        <label>Duration (minutes)
                                            <input
                                                type="number"
                                                min="15"
                                                step="15"
                                                placeholder={formatDuration(details.duration) || 'Set duration'}
                                                value={details.duration}
                                                onChange={(event) => updateService(service, { duration: event.target.value })}
                                            />
                                        </label>
                                        <label>Price (optional)
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="No price set"
                                                value={details.price}
                                                onChange={(event) => updateService(service, { price: event.target.value })}
                                            />
                                        </label>
                                    </fieldset>
                                );
                            })}
                        </div>
                    </>
                )}

                <h3 className="schedule-subheading">Time off, blocked dates, and overrides</h3>
                <p className="schedule-help">
                    Choose one or more dates, or select a range for time off. Closed dates block all day, blocked ranges close only those times, and special hours replace the weekly hours. Dates use the {businessTimezone} business timezone.
                </p>
                {/* Date-specific rules override the recurring weekly hours above. */}
                <div className="schedule-calendar-layout">
                    <section className="schedule-month-calendar" aria-label="Date rule calendar">
                        <div className="schedule-calendar-heading">
                            <button type="button" className="small-button" aria-label="Previous month" onClick={() => setCalendarMonth((month) => shiftMonth(month, -1))}>
                                ‹
                            </button>
                            <h4>{monthTitle}</h4>
                            <button type="button" className="small-button" aria-label="Next month" onClick={() => setCalendarMonth((month) => shiftMonth(month, 1))}>
                                ›
                            </button>
                            <button
                                type="button"
                                className="small-button schedule-today-button"
                                onClick={() => {
                                    const [year, month] = todayDateKey.split('-').map(Number);
                                    setCalendarMonth(new Date(year, month - 1, 1, 12));
                                }}
                            >
                                Today
                            </button>
                        </div>
                        <div className="schedule-calendar-grid schedule-calendar-weekdays" aria-hidden="true">
                            {WEEKDAY_HEADERS.map((weekday) => <span key={weekday}>{weekday}</span>)}
                        </div>
                        <div className="schedule-calendar-grid">
                            {monthDates.map((date) => {
                                const dateKey = formatDateKey(date);
                                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                                const status = getDateStatus(dateKey);
                                const selected = selectedDates.includes(dateKey);
                                const dayRules = dateRules.filter((rule) => rule.date === dateKey);
                                return (
                                    <button
                                        type="button"
                                        key={dateKey}
                                        className={[
                                            'schedule-calendar-day',
                                            !isCurrentMonth && 'is-outside-month',
                                            dateKey === todayDateKey && 'is-today',
                                            selected && 'is-selected',
                                            status && `has-${status}-rule`
                                        ].filter(Boolean).join(' ')}
                                        aria-pressed={selected}
                                        aria-label={`${formatDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${dayRules.length ? `, ${dayRules.length} saved rule${dayRules.length === 1 ? '' : 's'}` : ''}`}
                                        onClick={() => handleCalendarDateClick(dateKey)}
                                    >
                                        <span>{date.getDate()}</span>
                                        {status && <i className={`schedule-rule-dot is-${status}`} aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="schedule-calendar-legend" aria-label="Calendar legend">
                            <span><i className="legend-dot is-available" />Available</span>
                            <span><i className="legend-dot is-selected" />Selected</span>
                            <span><i className="legend-dot is-closed" />Unavailable</span>
                            <span><i className="legend-dot is-block" />Partially blocked</span>
                            <span><i className="legend-dot is-hours" />Special hours</span>
                        </div>
                    </section>

                    <section className="schedule-date-editor" aria-label="Selected date rules">
                        <div className="schedule-selection-actions">
                            <strong>{selectedDates.length ? `${selectedDates.length} date${selectedDates.length === 1 ? '' : 's'} selected` : 'Select dates on the calendar'}</strong>
                            <div className="schedule-selection-buttons">
                                <button
                                    type="button"
                                    className="small-button"
                                    onClick={() => setDateRulesRefreshKey((key) => key + 1)}
                                    disabled={dateRulesLoading || !isSupabaseConfigured}
                                >
                                    Refresh saved dates
                                </button>
                                <button
                                    type="button"
                                    className={`small-button ${rangeSelection ? 'is-active' : ''}`}
                                    aria-pressed={rangeSelection}
                                    onClick={() => {
                                        setRangeSelection((enabled) => !enabled);
                                        setRangeAnchor('');
                                        setSelectedDates([]);
                                        setEditingRuleId('');
                                    }}
                                >
                                    {rangeSelection ? 'Range mode: choose start' : 'Select date range'}
                                </button>
                            </div>
                        </div>
                        {rangeSelection && (
                            <p className="schedule-help">
                                {rangeAnchor ? `Start: ${formatDate(rangeAnchor)}. Choose the end date.` : 'Choose the first date, then choose the last date.'}
                            </p>
                        )}
                        {dateRulesLoading && <p className="schedule-help" role="status">Loading saved date rules…</p>}
                        {!isSupabaseConfigured && <p className="form-message form-error" role="alert">Supabase is not configured. Date rules cannot be loaded or saved.</p>}
                        {dateRulesError && <p className="form-message form-error" role="alert">{dateRulesError}</p>}
                        {selectedRules.length > 0 && (
                            <div className="date-rule-list">
                                <h4>Existing rules for selected dates</h4>
                                {selectedRules.map((rule) => (
                                    <div className="date-rule-item" key={rule.id}>
                                        <span>
                                            <strong>{formatDate(rule.date)}</strong> · {rule.label} · {
                                                rule.type === 'closed' ? 'Unavailable all day'
                                                    : rule.type === 'block' ? `${rule.start}–${rule.end} blocked`
                                                        : `${rule.open}–${rule.close} special hours`
                                            }
                                        </span>
                                        <div className="date-rule-actions">
                                            <button type="button" className="small-button" onClick={() => editDateRule(rule)}>Edit</button>
                                            <button type="button" className="small-button danger-button" onClick={() => removeDateRule(rule)}>Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="date-rule-form">
                            <label>Rule
                                <select
                                    value={ruleForm.type}
                                    onChange={(event) => setRuleForm({ ...ruleForm, type: event.target.value })}
                                >
                                    <option value="closed">Unavailable all day / holiday / vacation</option>
                                    <option value="block">Block specific hours</option>
                                    <option value="hours">Override business hours</option>
                                </select>
                            </label>
                            <label>Label
                                <input
                                    value={ruleForm.label}
                                    onChange={(event) => setRuleForm({ ...ruleForm, label: event.target.value })}
                                    placeholder="Holiday, vacation, appointment..."
                                />
                            </label>
                            {ruleForm.type === 'block' && (
                                <>
                                    <label>From<input type="time" value={ruleForm.start} onChange={(event) => setRuleForm({ ...ruleForm, start: event.target.value })} required /></label>
                                    <label>To<input type="time" value={ruleForm.end} onChange={(event) => setRuleForm({ ...ruleForm, end: event.target.value })} required /></label>
                                </>
                            )}
                            {ruleForm.type === 'hours' && (
                                <>
                                    <label>Opens<input type="time" value={ruleForm.open} onChange={(event) => setRuleForm({ ...ruleForm, open: event.target.value })} required /></label>
                                    <label>Closes<input type="time" value={ruleForm.close} onChange={(event) => setRuleForm({ ...ruleForm, close: event.target.value })} required /></label>
                                </>
                            )}
                        </div>
                        <div className="schedule-rule-buttons">
                            <button
                                type="button"
                                className="btn booking-btn"
                                onClick={saveDateRules}
                                disabled={savingDateRules || dateRulesLoading || selectedDates.length === 0}
                            >
                                {savingDateRules ? 'Saving…' : editingRuleId ? 'Save Rule Changes' : 'Add Date Rule'}
                            </button>
                            <button type="button" className="small-button" onClick={resetRuleEditor}>Cancel Selection</button>
                        </div>
                    </section>
                </div>

                <button type="submit" className="btn booking-btn save-schedule-button" disabled={scheduleLoading || scheduleSaving}>
                    {scheduleSaving ? 'Saving schedule…' : 'Save Schedule'}
                </button>
            </form>
        </section>
    );
}
