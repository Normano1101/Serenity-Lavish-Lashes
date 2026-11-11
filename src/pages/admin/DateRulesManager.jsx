// Time off and special hours: pick dates on a calendar, then add, edit or remove a rule for them.
// Date rules live in the database only, so saving needs Supabase. See data/dateRules.js.
import { useEffect, useState } from 'react';
import { ErrorMessage, SuccessMessage } from '../../components/Messages.jsx';
import { addDays, formatDate, getDateKeyInTimeZone } from '../../data/dates.js';
import { countAffectedAppointments, deleteDateRule, fetchDateRules, saveDateRules } from '../../data/dateRules.js';
import { isSupabaseConfigured, subscribeToTable } from '../../lib/supabase.js';
import { plural } from '../../lib/utils.js';
import DateRulesCalendar from './DateRulesCalendar.jsx';

const EMPTY_RULE = {
    type: 'closed',
    start: '12:00',
    end: '13:00',
    open: '09:00',
    close: '17:00',
    label: 'Unavailable'
};

// Fill in the form from a saved rule. A rule only has the times its type uses.
function ruleToForm(rule) {
    return {
        type: rule.type,
        start: rule.start || EMPTY_RULE.start,
        end: rule.end || EMPTY_RULE.end,
        open: rule.open || EMPTY_RULE.open,
        close: rule.close || EMPTY_RULE.close,
        label: rule.label || ''
    };
}

function describeRule(rule) {
    if (rule.type === 'closed') return 'Unavailable all day';
    if (rule.type === 'block') return `${rule.start}–${rule.end} blocked`;
    return `${rule.open}–${rule.close} special hours`;
}

// Every date key from one date to another, in either order.
function getDatesBetween(firstDate, secondDate) {
    const [start, end] = [firstDate, secondDate].sort();
    const dates = [];
    for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
    return dates;
}

// The first of the month containing dateKey, at noon.
function getMonthOf(dateKey) {
    const [year, month] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, 1, 12);
}

export default function DateRulesManager({ businessTimezone }) {
    const [dateRules, setDateRules] = useState([]);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [loadError, setLoadError] = useState('');
    const [formError, setFormError] = useState('');
    const [message, setMessage] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedDates, setSelectedDates] = useState([]);
    // In range mode, the first click sets rangeAnchor and the second click fills in the range.
    const [rangeSelection, setRangeSelection] = useState(false);
    const [rangeAnchor, setRangeAnchor] = useState('');
    const [editingRuleId, setEditingRuleId] = useState('');
    const [saving, setSaving] = useState(false);
    const [todayDateKey, setTodayDateKey] = useState(() => getDateKeyInTimeZone(new Date(), businessTimezone));
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1, 12);
    });
    const [ruleForm, setRuleForm] = useState(EMPTY_RULE);

    // Connects an input to a field of the rule form: <input {...field('label')} />
    const field = (key) => ({
        value: ruleForm[key],
        onChange: (event) => setRuleForm({ ...ruleForm, [key]: event.target.value })
    });

    // Keep the calendar on the studio's "today", which depends on its timezone.
    useEffect(() => {
        const today = getDateKeyInTimeZone(new Date(), businessTimezone);
        setTodayDateKey(today);
        setCalendarMonth(getMonthOf(today));
    }, [businessTimezone]);

    // Load saved rules, and reload whenever another admin changes them.
    useEffect(() => {
        if (!isSupabaseConfigured) {
            setLoading(false);
            return undefined;
        }

        let active = true;
        const loadDateRules = async () => {
            setLoading(true);
            try {
                const rules = await fetchDateRules();
                if (!active) return;
                setDateRules(rules);
                setLoadError('');
            } catch (queryError) {
                if (active) setLoadError(`Could not load saved date rules: ${queryError.message}`);
            } finally {
                if (active) setLoading(false);
            }
        };

        loadDateRules();
        const stopListening = subscribeToTable({
            channel: 'admin-date-rules',
            table: 'date_rules',
            onChange: loadDateRules,
            onUnavailable: () => setLoadError('Live date-rule updates are unavailable. Refresh the schedule to get the latest changes.')
        });

        return () => {
            active = false;
            stopListening();
        };
    }, [refreshKey]);

    const resetRuleEditor = () => {
        setSelectedDates([]);
        setRangeAnchor('');
        setRangeSelection(false);
        setEditingRuleId('');
        setRuleForm(EMPTY_RULE);
    };

    const editDateRule = (rule) => {
        setSelectedDates([rule.date]);
        setEditingRuleId(rule.id);
        setRangeAnchor('');
        setRuleForm(ruleToForm(rule));
    };

    const handleRangeClick = (dateKey) => {
        setEditingRuleId('');
        if (rangeAnchor) {
            setSelectedDates(getDatesBetween(rangeAnchor, dateKey));
            setRangeAnchor('');
        } else {
            setRangeAnchor(dateKey);
            setSelectedDates([dateKey]);
        }
    };

    const handleCalendarDateClick = (dateKey) => {
        const wasSelected = selectedDates.includes(dateKey);
        const existingRule = dateRules.find((rule) => rule.date === dateKey);

        // While editing a rule, clicking another date moves the editor to that date.
        if (editingRuleId && !wasSelected) {
            if (existingRule) {
                editDateRule(existingRule);
            } else {
                setSelectedDates([dateKey]);
                setRangeAnchor('');
                setEditingRuleId('');
                setRuleForm(EMPTY_RULE);
            }
            return;
        }
        if (rangeSelection) {
            handleRangeClick(dateKey);
            return;
        }

        // Otherwise a click selects or unselects the date.
        setSelectedDates((current) => (wasSelected
            ? current.filter((item) => item !== dateKey)
            : [...current, dateKey].sort()));
        setRangeAnchor('');
        setEditingRuleId('');

        // The first date picked opens its existing rule, if it has one.
        if (!wasSelected && existingRule && selectedDates.length === 0) editDateRule(existingRule);
    };

    const handleSave = async () => {
        setFormError('');
        setLoadError('');
        setMessage('');
        if (!isSupabaseConfigured) {
            setFormError('Configure Supabase to save shared date rules.');
            return;
        }
        if (!selectedDates.length) {
            setFormError('Select at least one date on the calendar.');
            return;
        }

        const rule = { ...ruleForm, label: ruleForm.label.trim() || 'Unavailable' };
        if (rule.type === 'block' && rule.end <= rule.start) {
            setFormError('A blocked time range must end after it starts.');
            return;
        }
        if (rule.type === 'hours' && rule.close <= rule.open) {
            setFormError('Override closing time must be later than opening time.');
            return;
        }

        const dates = [...selectedDates].sort();
        setSaving(true);
        try {
            // Warn the admin if existing bookings fall inside the newly closed time.
            const affected = await countAffectedAppointments(dates, rule);
            if (affected && !window.confirm(
                `This change affects ${affected} existing pending or confirmed ${plural(affected, 'appointment')}. They will not be changed, but the affected time may no longer be bookable. Continue?`
            )) return;

            await saveDateRules(rule, dates, editingRuleId);
            setDateRules(await fetchDateRules());
            resetRuleEditor();
            setMessage('Date rules saved. Existing appointments were not changed.');
        } catch (saveError) {
            setLoadError(`Could not save date rules: ${saveError.message}`);
        } finally {
            setSaving(false);
        }
    };

    const removeDateRule = async (rule) => {
        if (!window.confirm(`Remove the ${rule.label || 'date'} rule for ${formatDate(rule.date)}?`)) return;
        setMessage('');
        try {
            await deleteDateRule(rule.id);
            setDateRules((current) => current.filter((item) => item.id !== rule.id));
            if (editingRuleId === rule.id) resetRuleEditor();
            setMessage('Date rule removed. Existing appointments were not changed.');
            setLoadError('');
        } catch (deleteError) {
            setLoadError(`Could not remove date rule: ${deleteError.message}`);
        }
    };

    const selectedRules = dateRules.filter((rule) => selectedDates.includes(rule.date));
    const selectionLabel = selectedDates.length
        ? `${selectedDates.length} ${plural(selectedDates.length, 'date')} selected`
        : 'Select dates on the calendar';

    return (
        <div id="block-time">
            <h3 className="schedule-subheading">Time off, blocked dates, and overrides</h3>
            <p className="schedule-help">
                Choose one or more dates, or select a range for time off. Closed dates block all day, blocked ranges close only those times, and special hours replace the weekly hours. Dates use the {businessTimezone} business timezone.
            </p>
            <div className="schedule-calendar-layout">
                <DateRulesCalendar
                    month={calendarMonth}
                    todayDateKey={todayDateKey}
                    dateRules={dateRules}
                    selectedDates={selectedDates}
                    onDateClick={handleCalendarDateClick}
                    onMonthChange={(offset) => setCalendarMonth((current) =>
                        new Date(current.getFullYear(), current.getMonth() + offset, 1, 12)
                    )}
                    onToday={() => setCalendarMonth(getMonthOf(todayDateKey))}
                />

                <section className="schedule-date-editor" aria-label="Selected date rules">
                    <div className="schedule-selection-actions">
                        <strong>{selectionLabel}</strong>
                        <div className="schedule-selection-buttons">
                            <button
                                type="button"
                                className="small-button"
                                onClick={() => setRefreshKey((key) => key + 1)}
                                disabled={loading || !isSupabaseConfigured}
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
                    {loading && <p className="schedule-help" role="status">Loading saved date rules…</p>}
                    {!isSupabaseConfigured && <ErrorMessage>Supabase is not configured. Date rules cannot be loaded or saved.</ErrorMessage>}
                    <ErrorMessage>{loadError}</ErrorMessage>
                    <ErrorMessage>{formError}</ErrorMessage>
                    <SuccessMessage>{message}</SuccessMessage>
                    {selectedRules.length > 0 && (
                        <div className="date-rule-list">
                            <h4>Existing rules for selected dates</h4>
                            {selectedRules.map((rule) => (
                                <div className="date-rule-item" key={rule.id}>
                                    <span>
                                        <strong>{formatDate(rule.date)}</strong> · {rule.label} · {describeRule(rule)}
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
                            <select {...field('type')}>
                                <option value="closed">Unavailable all day / holiday / vacation</option>
                                <option value="block">Block specific hours</option>
                                <option value="hours">Override business hours</option>
                            </select>
                        </label>
                        <label>Label
                            <input {...field('label')} placeholder="Holiday, vacation, appointment..." />
                        </label>
                        {ruleForm.type === 'block' && (
                            <>
                                <label>From<input type="time" {...field('start')} required /></label>
                                <label>To<input type="time" {...field('end')} required /></label>
                            </>
                        )}
                        {ruleForm.type === 'hours' && (
                            <>
                                <label>Opens<input type="time" {...field('open')} required /></label>
                                <label>Closes<input type="time" {...field('close')} required /></label>
                            </>
                        )}
                    </div>
                    <div className="schedule-rule-buttons">
                        <button
                            type="button"
                            className="btn booking-btn"
                            onClick={handleSave}
                            disabled={saving || loading || selectedDates.length === 0}
                        >
                            {saving ? 'Saving…' : editingRuleId ? 'Save Rule Changes' : 'Add Date Rule'}
                        </button>
                        <button type="button" className="small-button" onClick={resetRuleEditor}>Cancel Selection</button>
                    </div>
                </section>
            </div>
        </div>
    );
}
