import { useEffect, useState } from 'react';
import {
    dateAfterDays,
    formatDuration,
    getBookingSettings,
    saveBookingSettings,
    SERVICES,
    WEEKDAYS,
    toMinutes
} from '../../data/appointments.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';

const BOOKING_INTERVALS = [
    { minutes: 15, label: '15 minutes' },
    { minutes: 30, label: '30 minutes' },
    { minutes: 45, label: '45 minutes' },
    { minutes: 60, label: '1 hour' },
    { minutes: 90, label: '1.5 hours' },
    { minutes: 120, label: '2 hours' }
];

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

export default function ManageSchedule() {
    const [settings, setSettings] = useState(() => copySettings(getBookingSettings()));
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [ruleForm, setRuleForm] = useState({
        date: dateAfterDays(1),
        type: 'closed',
        start: '12:00',
        end: '13:00',
        open: '09:00',
        close: '17:00',
        label: 'Unavailable'
    });

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

    const saveSchedule = (event) => {
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
            saveBookingSettings(settings);
            setMessage('Schedule, services, and availability rules saved in this browser.');
        } catch (saveError) {
            setError(`Could not save schedule: ${saveError.message}`);
        }
    };

    const addDateRule = (event) => {
        event.preventDefault();
        setError('');
        const rule = {
            ...ruleForm,
            id: crypto.randomUUID(),
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

        setSettings((current) => ({
            ...current,
            dateRules: [...current.dateRules, rule]
        }));
        setMessage('');
    };

    const removeDateRule = (id) => {
        setSettings((current) => ({
            ...current,
            dateRules: current.dateRules.filter((rule) => rule.id !== id)
        }));
        setMessage('');
    };

    return (
        <section className="admin-panel schedule-panel">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Owner settings · Demo only</p>
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
                    These example hours are editable demo defaults. Break times are optional.
                </p>
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
                    A closed date blocks all day. A blocked range closes only that time. Hours overrides replace that date&apos;s weekly hours.
                </p>
                <div className="date-rule-form">
                    <label>Date
                        <input
                            type="date"
                            min={dateAfterDays(0)}
                            value={ruleForm.date}
                            onChange={(event) => setRuleForm({ ...ruleForm, date: event.target.value })}
                            required
                        />
                    </label>
                    <label>Rule
                        <select
                            value={ruleForm.type}
                            onChange={(event) => setRuleForm({ ...ruleForm, type: event.target.value })}
                        >
                            <option value="closed">Unavailable all day / holiday / vacation</option>
                            <option value="block">Block a time range</option>
                            <option value="hours">Override working hours</option>
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
                    <button type="button" className="small-button" onClick={addDateRule}>Add date rule</button>
                </div>

                {settings.dateRules.length > 0 && (
                    <ul className="date-rule-list">
                        {settings.dateRules.map((rule) => (
                            <li key={rule.id}>
                                <span>
                                    <strong>{rule.date}</strong> · {rule.label} · {
                                        rule.type === 'closed' ? 'Closed all day'
                                            : rule.type === 'block' ? `${rule.start}–${rule.end} blocked`
                                                : `${rule.open}–${rule.close} hours override`
                                    }
                                </span>
                                <button type="button" className="small-button danger-button" onClick={() => removeDateRule(rule.id)}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <button type="submit" className="btn booking-btn save-schedule-button">Save Schedule</button>
            </form>
        </section>
    );
}
