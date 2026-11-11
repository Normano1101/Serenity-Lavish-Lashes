// Demo-mode appointment system: appointments and settings saved in the browser's
// localStorage, plus the rules that work out which times are free. The live site uses
// Supabase for its data (see adminAppointments.js).
import { dateAfterDays, minutesToTime, toMinutes } from './dates.js';

const STORAGE_KEYS = {
    samples: 'serenity-demo-sample-appointments-v1',
    customer: 'serenity-demo-customer-appointments-v1',
    manual: 'serenity-demo-manual-appointments-v1',
    settings: 'serenity-demo-booking-settings-v1'
};
const APPOINTMENT_LISTS = [STORAGE_KEYS.samples, STORAGE_KEYS.customer, STORAGE_KEYS.manual];
const CHANGED_EVENT = 'serenity-demo-appointments-changed';

export const LASH_STYLES = ['Classic', 'Wet', 'Hybrid', 'Volume', 'Wispy', 'Anime'];
// Every style comes as a full set and a fill: 'Classic Full Set', 'Classic Fill', ...
export const SERVICES = LASH_STYLES.flatMap((style) => [`${style} Full Set`, `${style} Fill`]);
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .map((label, index) => ({ key: String(index), label }));

// Starting opening hours for demo mode. Keys are days of the week; '0' is Sunday.
const DEFAULT_SCHEDULE = {
    '0': { enabled: false, open: '09:00', close: '17:00', breaks: [] },
    '1': { enabled: true, open: '09:00', close: '17:00', breaks: [] },
    '2': { enabled: true, open: '10:00', close: '18:00', breaks: [] },
    '3': { enabled: false, open: '09:00', close: '17:00', breaks: [] },
    '4': { enabled: true, open: '09:00', close: '17:00', breaks: [] },
    '5': { enabled: true, open: '09:00', close: '16:00', breaks: [] },
    '6': { enabled: true, open: '10:00', close: '15:00', breaks: [] }
};

function createDefaultServices() {
    const services = {};
    // Old appointments used the plain style name, so keep those entries (switched off).
    LASH_STYLES.forEach((name) => {
        services[name] = { active: false, duration: '', price: '' };
    });
    SERVICES.forEach((name) => {
        services[name] = { active: true, duration: name.endsWith('Full Set') ? '210' : '150', price: '' };
    });
    return services;
}

function createDefaultSettings() {
    return { schedule: DEFAULT_SCHEDULE, interval: 30, services: createDefaultServices(), dateRules: [] };
}

// --- Reading and writing localStorage ---

function readList(key) {
    const value = window.localStorage.getItem(key);
    if (value === null) return [];

    try {
        const list = JSON.parse(value);
        if (!Array.isArray(list)) throw new Error('Stored appointment data must be a list.');
        return list;
    } catch (error) {
        throw new Error(`Could not read appointment demo data: ${error.message}`);
    }
}

// Save a value and tell the rest of the page that the data changed.
function writeValue(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGED_EVENT));
}

// Saved settings go on top of the defaults, so any newly added option still has a value.
export function getBookingSettings() {
    const value = window.localStorage.getItem(STORAGE_KEYS.settings);
    if (value === null) return createDefaultSettings();

    try {
        const saved = JSON.parse(value);
        return {
            ...createDefaultSettings(),
            ...saved,
            schedule: { ...DEFAULT_SCHEDULE, ...saved.schedule },
            services: { ...createDefaultServices(), ...saved.services },
            dateRules: Array.isArray(saved.dateRules) ? saved.dateRules : []
        };
    } catch (error) {
        throw new Error(`Could not read schedule demo data: ${error.message}`);
    }
}

export function saveBookingSettings(settings) {
    writeValue(STORAGE_KEYS.settings, settings);
}

// The demo services that are switched on and have a duration.
export function getActiveDemoServiceNames(settings) {
    return SERVICES.filter((name) => settings.services[name]?.active && Number(settings.services[name].duration) > 0);
}

// Run onChange when demo data changes in this tab or another one. Returns a function that stops listening.
export function subscribeToAppointments(onChange) {
    const refresh = () => onChange();
    window.addEventListener(CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
        window.removeEventListener(CHANGED_EVENT, refresh);
        window.removeEventListener('storage', refresh);
    };
}

// --- Demo appointments ---

// Clearly fake records, so the demo dashboard isn't empty on first use.
function createSampleAppointments() {
    const sample = (id, letter, phone, service, daysAhead, time, status, notes) => ({
        id,
        name: `SAMPLE — Demo Client ${letter}`,
        email: `demo-${letter.toLowerCase()}@example.invalid`,
        phone,
        service,
        duration: 60,
        date: dateAfterDays(daysAhead),
        time,
        status,
        source: 'sample',
        notes
    });

    return [
        sample('sample-today', 'A', '555-0100', 'Classic', 0, '17:00', 'confirmed', 'Fictional sample appointment.'),
        sample('sample-upcoming', 'B', '555-0101', 'Volume', 1, '11:00', 'pending', 'Fictional sample appointment.'),
        sample('sample-cancelled', 'C', '555-0102', 'Wet', 3, '14:00', 'cancelled', 'Fictional cancelled sample.')
    ];
}

// Add the starter data once, without ever replacing anything already saved.
function initializeDemoData() {
    if (window.localStorage.getItem(STORAGE_KEYS.samples) === null) {
        writeValue(STORAGE_KEYS.samples, createSampleAppointments());
    }
    if (window.localStorage.getItem(STORAGE_KEYS.settings) === null) {
        writeValue(STORAGE_KEYS.settings, createDefaultSettings());
    }
}

// All demo appointments, earliest first.
export function getAppointments() {
    initializeDemoData();
    return APPOINTMENT_LISTS.flatMap(readList).sort((first, second) =>
        `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`)
    );
}

function storageKeyForSource(source) {
    if (source === 'sample') return STORAGE_KEYS.samples;
    if (source === 'manual') return STORAGE_KEYS.manual;
    return STORAGE_KEYS.customer;
}

// Save a new appointment, after checking its time is still free.
export function saveAppointment(appointment) {
    const settings = getBookingSettings();
    const service = settings.services[appointment.service];
    const duration = Number(appointment.duration || service?.duration);
    if (!service?.active || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('Choose an active service with a configured duration.');
    }
    const available = getAvailableSlots(getAppointments(), appointment.date, {
        settings,
        service: appointment.service,
        duration
    });
    if (!available.includes(appointment.time)) {
        throw new Error('That appointment time is no longer available.');
    }

    const key = storageKeyForSource(appointment.source);
    writeValue(key, [...readList(key), { ...appointment, duration }]);
}

export function updateAppointment(id, updates) {
    const key = APPOINTMENT_LISTS.find((listKey) => readList(listKey).some((item) => item.id === id));
    if (!key) throw new Error('Appointment could not be found.');

    writeValue(key, readList(key).map((item) => (item.id === id ? { ...item, ...updates } : item)));
}

// --- Working out which times are free ---

function getRulesForDate(settings, date) {
    return settings.dateRules.filter((rule) => rule.date === date);
}

// One day's opening hours, or null if closed. Date-specific rules beat the weekly schedule.
function getDayHours(settings, date) {
    const rules = getRulesForDate(settings, date);
    if (rules.some((rule) => rule.type === 'closed')) return null;

    const weeklyHours = settings.schedule[String(new Date(`${date}T12:00:00`).getDay())];
    const override = [...rules].reverse().find((rule) => rule.type === 'hours');
    if (override) return { open: override.open, close: override.close, breaks: weeklyHours?.breaks ?? [] };

    return weeklyHours?.enabled ? weeklyHours : null;
}

// Do two time ranges overlap? One ending exactly when the other starts doesn't count.
function overlaps(start, end, otherStart, otherEnd) {
    return start < otherEnd && otherStart < end;
}

function isStartInPast(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime() <= Date.now();
}

// An appointment's start and end, in minutes after midnight.
function getAppointmentRange(appointment, settings) {
    const start = toMinutes(appointment.time);
    const duration = Number(
        appointment.duration
        || settings.services[appointment.service]?.duration
        || settings.interval
    );
    return [start, start + duration];
}

// Does this time range touch a break ({ start, end }) or a blocked-time rule?
function overlapsPeriod(start, end, period) {
    return overlaps(start, end, toMinutes(period.start), toMinutes(period.end));
}

// Start times on `date` where the service fits inside opening hours and clashes with nothing.
// options: settings, service (name), duration (minutes), excludeId (an appointment to ignore).
export function getAvailableSlots(appointments, date, options = {}) {
    const settings = options.settings ?? getBookingSettings();
    const service = options.service ? settings.services[options.service] : null;
    const duration = Number(options.duration ?? service?.duration);
    const durationIsInvalid = !Number.isFinite(duration) || duration <= 0;
    const serviceIsOff = options.service && !service?.active && options.duration === undefined;
    if (durationIsInvalid || serviceIsOff) return [];

    const hours = getDayHours(settings, date);
    if (!hours) return [];

    const blocks = getRulesForDate(settings, date).filter((rule) => rule.type === 'block');
    const breaks = hours.breaks ?? [];
    const otherAppointments = appointments.filter((item) =>
        item.date === date && item.id !== options.excludeId && item.status !== 'cancelled'
    );
    const interval = Number(settings.interval) || 30;
    const available = [];

    // Try each possible start time and keep the ones with no clash.
    for (let start = toMinutes(hours.open); start + duration <= toMinutes(hours.close); start += interval) {
        const end = start + duration;
        const time = minutesToTime(start);
        const hasClash = isStartInPast(date, time)
            || breaks.some((period) => overlapsPeriod(start, end, period))
            || blocks.some((period) => overlapsPeriod(start, end, period))
            || otherAppointments.some((item) => overlaps(start, end, ...getAppointmentRange(item, settings)));
        if (!hasClash) available.push(time);
    }
    return available;
}

// What's happening at every interval of a day. Used by the admin calendar's day view.
export function getCalendarSlots(appointments, date, settings = getBookingSettings()) {
    const hours = getDayHours(settings, date);
    if (!hours) return [];

    const blocks = getRulesForDate(settings, date).filter((rule) => rule.type === 'block');
    const activeAppointments = appointments.filter((item) => item.date === date && item.status !== 'cancelled');
    const interval = Number(settings.interval) || 30;
    const closing = toMinutes(hours.close);
    const slots = [];

    for (let start = toMinutes(hours.open); start < closing; start += interval) {
        const end = Math.min(start + interval, closing);
        const time = minutesToTime(start);
        if (isStartInPast(date, time)) {
            slots.push({ time, status: 'past', appointment: null, label: '' });
            continue;
        }
        const appointment = activeAppointments.find((item) =>
            overlaps(start, end, ...getAppointmentRange(item, settings))
        );
        const breakTime = (hours.breaks ?? []).find((period) => overlapsPeriod(start, end, period));
        const block = blocks.find((period) => overlapsPeriod(start, end, period));

        slots.push({
            time,
            status: appointment ? 'occupied' : breakTime ? 'break' : block ? 'blocked' : 'available',
            appointmentStatus: appointment?.status ?? '',
            appointment,
            label: appointment?.name ?? breakTime?.label ?? block?.label ?? ''
        });
    }
    return slots;
}

// The ids of appointments that overlap another appointment on the same day.
export function findConflicts(appointments, settings = getBookingSettings()) {
    const active = appointments.filter((item) => item.status !== 'cancelled');
    const conflicting = active.filter((appointment, index) =>
        active.some((other, otherIndex) =>
            otherIndex !== index
            && other.date === appointment.date
            && overlaps(...getAppointmentRange(appointment, settings), ...getAppointmentRange(other, settings))
        )
    );
    return new Set(conflicting.map((item) => item.id));
}
