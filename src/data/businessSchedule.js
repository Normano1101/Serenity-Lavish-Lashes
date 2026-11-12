// Weekly opening hours: checking them and saving/loading them from the database.
import { toMinutes, trimSeconds } from './dates.js';
import { BOOKING_INTERVAL_MINUTES, WEEKDAYS } from './appointments.js';
import { supabase } from '../lib/supabase.js';

// Returns a message describing the first problem, or '' when everything is valid.
export function validateSchedule(settings) {
    for (const { key, label } of WEEKDAYS) {
        const day = settings.schedule[key];
        if (day.enabled && day.close <= day.open) {
            return `${label}: closing time must be later than opening time.`;
        }
        if (day.breaks.some((item) => item.end <= item.start)) {
            return `${label}: each break must end after it starts.`;
        }
        const breakOutsideHours = day.breaks.some((item) =>
            toMinutes(item.start) < toMinutes(day.open) || toMinutes(item.end) > toMinutes(day.close)
        );
        if (day.enabled && breakOutsideHours) return `${label}: breaks must fall within working hours.`;
    }

    for (const [service, details] of Object.entries(settings.services)) {
        const duration = Number(details.duration);
        const price = Number(details.price);
        if (details.duration && (!Number.isFinite(duration) || duration <= 0)) {
            return `${service}: duration must be a positive number of minutes.`;
        }
        if (details.price && (!Number.isFinite(price) || price < 0)) {
            return `${service}: price must be a non-negative number.`;
        }
    }
    return '';
}

// Load the timezone, hours and breaks, combined into one schedule per weekday.
export async function loadBusinessSchedule() {
    const [settingsResult, hoursResult, breaksResult] = await Promise.all([
        supabase.from('booking_settings').select('business_timezone').eq('id', true).maybeSingle(),
        supabase.from('weekly_schedule').select('day_of_week, is_open, opens_at, closes_at'),
        supabase.from('schedule_breaks').select('id, day_of_week, starts_at, ends_at, label')
    ]);
    const firstError = settingsResult.error ?? hoursResult.error ?? breaksResult.error;
    if (firstError) throw firstError;

    const hours = hoursResult.data ?? [];
    const breaks = breaksResult.data ?? [];
    const schedule = Object.fromEntries(WEEKDAYS.map(({ key }) => {
        const day = hours.find((row) => String(row.day_of_week) === key);
        return [key, {
            enabled: Boolean(day?.is_open),
            open: day?.opens_at?.slice(0, 5) || '09:00',
            close: day?.closes_at?.slice(0, 5) || '17:00',
            breaks: breaks
                .filter((row) => String(row.day_of_week) === key)
                .map((row) => ({ start: trimSeconds(row.starts_at), end: trimSeconds(row.ends_at), label: row.label }))
        }];
    }));

    return {
        timezone: settingsResult.data?.business_timezone || 'UTC',
        interval: BOOKING_INTERVAL_MINUTES,
        hasOpenHours: hours.some((day) => day.is_open),
        schedule
    };
}

// Save the whole weekly schedule in one go.
export async function saveBusinessSchedule(settings) {
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
        settings.schedule[key].breaks.map((item) => ({
            day_of_week: Number(key),
            starts_at: item.start,
            ends_at: item.end,
            label: item.label || 'Break'
        }))
    );

    const { error } = await supabase.rpc('save_business_schedule', {
        // Always save the fixed 2-hour interval, which also corrects any older saved value.
        p_booking_interval_minutes: BOOKING_INTERVAL_MINUTES,
        p_weekly_schedule: weeklySchedule,
        p_schedule_breaks: scheduleBreaks
    });
    if (error) throw error;
    return weeklySchedule.some((day) => day.is_open);
}
