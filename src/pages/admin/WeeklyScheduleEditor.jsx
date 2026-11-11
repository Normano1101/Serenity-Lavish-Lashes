// The form fields for weekly hours and breaks. In demo mode it also edits service durations and prices.
import { SERVICES, WEEKDAYS } from '../../data/appointments.js';
import { formatDuration } from '../../data/dates.js';
import { isSupabaseConfigured } from '../../lib/supabase.js';

// One day: a working checkbox, opening hours, and any number of breaks.
function DayEditor({ dayKey, label, day, onChange }) {
    const updateBreak = (index, updates) => onChange({
        breaks: day.breaks.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item))
    });

    return (
        <fieldset className="schedule-day">
            <legend>{label}</legend>
            <label className="schedule-open-toggle">
                <input type="checkbox" checked={day.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />
                Working
            </label>
            <label>Opens
                <input type="time" value={day.open} disabled={!day.enabled} onChange={(event) => onChange({ open: event.target.value })} />
            </label>
            <label>Closes
                <input type="time" value={day.close} disabled={!day.enabled} onChange={(event) => onChange({ close: event.target.value })} />
            </label>
            <div className="schedule-breaks">
                <strong>Breaks</strong>
                {day.breaks.map((breakTime, index) => (
                    <div className="schedule-break-row" key={`${dayKey}-${index}`}>
                        <label>From
                            <input type="time" value={breakTime.start} disabled={!day.enabled} onChange={(event) => updateBreak(index, { start: event.target.value })} />
                        </label>
                        <label>To
                            <input type="time" value={breakTime.end} disabled={!day.enabled} onChange={(event) => updateBreak(index, { end: event.target.value })} />
                        </label>
                        <button
                            type="button"
                            className="small-button danger-button"
                            onClick={() => onChange({ breaks: day.breaks.filter((_, itemIndex) => itemIndex !== index) })}
                        >
                            Remove
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="small-button"
                    disabled={!day.enabled}
                    onClick={() => onChange({ breaks: [...day.breaks, { start: '12:00', end: '13:00' }] })}
                >
                    Add break
                </button>
            </div>
        </fieldset>
    );
}

function DemoServiceEditor({ name, details, onChange }) {
    return (
        <fieldset className="service-setting">
            <legend>{name}</legend>
            <label className="schedule-open-toggle">
                <input type="checkbox" checked={details.active} onChange={(event) => onChange({ active: event.target.checked })} />
                Active
            </label>
            <label>Duration (minutes)
                <input
                    type="number"
                    min="15"
                    step="15"
                    placeholder={formatDuration(details.duration) || 'Set duration'}
                    value={details.duration}
                    onChange={(event) => onChange({ duration: event.target.value })}
                />
            </label>
            <label>Price (optional)
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="No price set"
                    value={details.price}
                    onChange={(event) => onChange({ price: event.target.value })}
                />
            </label>
        </fieldset>
    );
}

export default function WeeklyScheduleEditor({ settings, loading, hasOpenBusinessHours, onDayChange, onServiceChange }) {
    return (
        <>
            <h3>Weekly working hours and breaks</h3>
            <p className="schedule-help">
                {isSupabaseConfigured
                    ? 'Set the actual business hours and optional breaks for each day. Closed days stay unavailable. These shared settings determine dates and times shown on the Booking page.'
                    : 'These hours are browser-only demo settings. Break times are optional.'}
            </p>
            {loading && <p className="schedule-help" role="status">Loading shared business hours…</p>}
            {isSupabaseConfigured && !loading && !hasOpenBusinessHours && (
                <p className="form-message form-error" role="status">
                    No open business hours are saved in Supabase yet. Dates will remain unavailable on the Booking page until the owner enters and saves at least one open day.
                </p>
            )}
            <div className="schedule-day-list">
                {WEEKDAYS.map(({ key, label }) => (
                    <DayEditor
                        key={key}
                        dayKey={key}
                        label={label}
                        day={settings.schedule[key]}
                        onChange={(updates) => onDayChange(key, updates)}
                    />
                ))}
            </div>

            {!isSupabaseConfigured && (
                <>
                    <h3 className="schedule-subheading">Demo service durations and prices</h3>
                    <p className="schedule-help">
                        These browser-only settings are for the development demo. Configure shared services in Services &amp; Pricing.
                    </p>
                    <div className="service-settings-list">
                        {SERVICES.map((name) => (
                            <DemoServiceEditor
                                key={name}
                                name={name}
                                details={settings.services[name]}
                                onChange={(updates) => onServiceChange(name, updates)}
                            />
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
