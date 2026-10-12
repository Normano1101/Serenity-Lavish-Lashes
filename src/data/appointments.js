const STORAGE_KEYS = {
    samples: 'serenity-demo-sample-appointments-v1',
    customer: 'serenity-demo-customer-appointments-v1',
    manual: 'serenity-demo-manual-appointments-v1',
    settings: 'serenity-demo-booking-settings-v1'
};

export const LASH_STYLES = ['Classic', 'Wet', 'Hybrid', 'Volume', 'Wispy', 'Anime'];
export const SERVICE_TYPES = ['Full Set', 'Fill'];
export const LEGACY_SERVICES = LASH_STYLES;
export const SERVICES = LASH_STYLES.flatMap((style) =>
    SERVICE_TYPES.map((type) => `${style} ${type}`)
);
export const WEEKDAYS = [
    { key: '0', label: 'Sunday' },
    { key: '1', label: 'Monday' },
    { key: '2', label: 'Tuesday' },
    { key: '3', label: 'Wednesday' },
    { key: '4', label: 'Thursday' },
    { key: '5', label: 'Friday' },
    { key: '6', label: 'Saturday' }
];
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled'];
export const APPOINTMENTS_CHANGED_EVENT = 'serenity-demo-appointments-changed';

const DEFAULT_SCHEDULE = {
    '0': { enabled: false, open: '09:00', close: '17:00', breaks: [] },
    '1': { enabled: true, open: '09:00', close: '17:00', breaks: [] },
    '2': { enabled: true, open: '10:00', close: '18:00', breaks: [] },
    '3': { enabled: false, open: '09:00', close: '17:00', breaks: [] },
    '4': { enabled: true, open: '09:00', close: '17:00', breaks: [] },
    '5': { enabled: true, open: '09:00', close: '16:00', breaks: [] },
    '6': { enabled: true, open: '10:00', close: '15:00', breaks: [] }
};

export function createDefaultSettings() {
    return {
        schedule: DEFAULT_SCHEDULE,
        interval: 30,
        services: {
            ...Object.fromEntries(LEGACY_SERVICES.map((name) => [
                name,
                { active: false, duration: '', price: '' }
            ])),
            ...Object.fromEntries(SERVICES.map((name) => [
                name,
                {
                    active: true,
                    duration: name.endsWith('Full Set') ? '210' : '150',
                    price: ''
                }
            ]))
        },
        dateRules: []
    };
}

export function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function dateAfterDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
}

export function formatDate(dateKey, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, options);
}

export function formatTime(time) {
    const [hour, minute] = time.split(':').map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function formatDuration(minutes) {
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration <= 0) return '';
    if (duration % 60 === 0) {
        const hours = duration / 60;
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    if (duration > 60 && duration % 30 === 0) {
        return `${(duration / 60).toFixed(1)} hours`;
    }
    return `${duration} minutes`;
}

export function toMinutes(time) {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

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

function writeValue(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(APPOINTMENTS_CHANGED_EVENT));
}

function readSettingsValue() {
    const value = window.localStorage.getItem(STORAGE_KEYS.settings);
    if (value === null) return createDefaultSettings();

    try {
        const saved = JSON.parse(value);
        return {
            ...createDefaultSettings(),
            ...saved,
            schedule: { ...DEFAULT_SCHEDULE, ...saved.schedule },
            services: { ...createDefaultSettings().services, ...saved.services },
            dateRules: Array.isArray(saved.dateRules) ? saved.dateRules : []
        };
    } catch (error) {
        throw new Error(`Could not read schedule demo data: ${error.message}`);
    }
}

export function getBookingSettings() {
    return readSettingsValue();
}

export function saveBookingSettings(settings) {
    writeValue(STORAGE_KEYS.settings, settings);
}

function createSampleAppointments() {
    return [
        {
            id: 'sample-today',
            name: 'SAMPLE — Demo Client A',
            email: 'demo-a@example.invalid',
            phone: '555-0100',
            service: 'Classic',
            duration: 60,
            date: dateAfterDays(0),
            time: '17:00',
            status: 'confirmed',
            source: 'sample',
            notes: 'Fictional sample appointment.'
        },
        {
            id: 'sample-upcoming',
            name: 'SAMPLE — Demo Client B',
            email: 'demo-b@example.invalid',
            phone: '555-0101',
            service: 'Volume',
            duration: 60,
            date: dateAfterDays(1),
            time: '11:00',
            status: 'pending',
            source: 'sample',
            notes: 'Fictional sample appointment.'
        },
        {
            id: 'sample-cancelled',
            name: 'SAMPLE — Demo Client C',
            email: 'demo-c@example.invalid',
            phone: '555-0102',
            service: 'Wet',
            duration: 60,
            date: dateAfterDays(3),
            time: '14:00',
            status: 'cancelled',
            source: 'sample',
            notes: 'Fictional cancelled sample.'
        }
    ];
}

function initializeDemoData() {
    if (window.localStorage.getItem(STORAGE_KEYS.samples) === null) {
        writeValue(STORAGE_KEYS.samples, createSampleAppointments());
    }
    if (window.localStorage.getItem(STORAGE_KEYS.settings) === null) {
        writeValue(STORAGE_KEYS.settings, createDefaultSettings());
    }
}

export function getAppointments() {
    initializeDemoData();
    return [
        ...readList(STORAGE_KEYS.samples),
        ...readList(STORAGE_KEYS.customer),
        ...readList(STORAGE_KEYS.manual)
    ].sort((first, second) =>
        `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`)
    );
}

function storageKeyForSource(source) {
    if (source === 'sample') return STORAGE_KEYS.samples;
    if (source === 'manual') return STORAGE_KEYS.manual;
    return STORAGE_KEYS.customer;
}

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
    const key = Object.values(STORAGE_KEYS).find((storageKey) =>
        storageKey !== STORAGE_KEYS.settings
        && readList(storageKey).some((appointment) => appointment.id === id)
    );
    if (!key) throw new Error('Appointment could not be found.');

    writeValue(key, readList(key).map((appointment) =>
        appointment.id === id ? { ...appointment, ...updates } : appointment
    ));
}

export function subscribeToAppointments(onChange) {
    const refresh = () => onChange();
    window.addEventListener(APPOINTMENTS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
        window.removeEventListener(APPOINTMENTS_CHANGED_EVENT, refresh);
        window.removeEventListener('storage', refresh);
    };
}

export function getDayHours(settings, date) {
    const rules = settings.dateRules.filter((rule) => rule.date === date);
    if (rules.some((rule) => rule.type === 'closed')) return null;

    const weeklyHours = settings.schedule[String(new Date(`${date}T12:00:00`).getDay())];
    const override = [...rules].reverse().find((rule) => rule.type === 'hours');
    if (override) return { open: override.open, close: override.close, breaks: weeklyHours?.breaks ?? [] };

    return weeklyHours?.enabled ? weeklyHours : null;
}

function overlaps(start, end, otherStart, otherEnd) {
    return start < otherEnd && otherStart < end;
}

function isStartInPast(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime() <= Date.now();
}

function getAppointmentDuration(appointment, settings) {
    return Number(
        appointment.duration
        || settings.services[appointment.service]?.duration
        || settings.interval
    );
}

export function getAvailableSlots(appointments, date, options = {}) {
    const settings = options.settings ?? getBookingSettings();
    const service = options.service ? settings.services[options.service] : null;
    const duration = Number(options.duration ?? service?.duration);
    if (
        options.service
        && ((!service?.active && options.duration === undefined) || !Number.isFinite(duration) || duration <= 0)
    ) return [];
    if (options.duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) return [];

    const hours = getDayHours(settings, date);
    if (!hours || settings.dateRules.some((rule) => rule.date === date && rule.type === 'closed')) return [];

    const opening = toMinutes(hours.open);
    const closing = toMinutes(hours.close);
    if (closing <= opening) return [];

    const rules = settings.dateRules.filter((rule) => rule.date === date);
    const interval = Number(settings.interval) || 30;
    const available = [];

    for (let start = opening; start + duration <= closing; start += interval) {
        const end = start + duration;
        const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
        if (isStartInPast(date, time)) continue;

        const duringBreak = (hours.breaks ?? []).some((breakTime) =>
            overlaps(start, end, toMinutes(breakTime.start), toMinutes(breakTime.end))
        );
        const duringBlock = rules.some((rule) =>
            rule.type === 'block'
            && overlaps(start, end, toMinutes(rule.start), toMinutes(rule.end))
        );
        const appointmentConflict = appointments.some((appointment) => {
            if (
                appointment.date !== date
                || appointment.id === options.excludeId
                || appointment.status === 'cancelled'
            ) return false;

            const appointmentStart = toMinutes(appointment.time);
            const appointmentEnd = appointmentStart + getAppointmentDuration(appointment, settings);
            return overlaps(start, end, appointmentStart, appointmentEnd);
        });

        if (!duringBreak && !duringBlock && !appointmentConflict) available.push(time);
    }
    return available;
}

export function getCalendarSlots(appointments, date, settings = getBookingSettings()) {
    const hours = getDayHours(settings, date);
    if (!hours) return [];

    const rules = settings.dateRules.filter((rule) => rule.date === date);
    const slots = [];
    const interval = Number(settings.interval) || 30;
    const opening = toMinutes(hours.open);
    const closing = toMinutes(hours.close);

    for (let start = opening; start < closing; start += interval) {
        const end = Math.min(start + interval, closing);
        const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
        if (isStartInPast(date, time)) {
            slots.push({ time, status: 'past', appointment: null, label: '' });
            continue;
        }
        const appointment = appointments.find((item) =>
            item.date === date
            && item.status !== 'cancelled'
            && overlaps(start, end, toMinutes(item.time), toMinutes(item.time) + getAppointmentDuration(item, settings))
        );
        const breakTime = (hours.breaks ?? []).find((item) =>
            overlaps(start, end, toMinutes(item.start), toMinutes(item.end))
        );
        const block = rules.find((rule) =>
            rule.type === 'block' && overlaps(start, end, toMinutes(rule.start), toMinutes(rule.end))
        );

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

export function findConflicts(appointments, settings = getBookingSettings()) {
    const active = appointments.filter((appointment) => appointment.status !== 'cancelled');
    return new Set(
        active.filter((appointment, index) =>
            active.some((other, otherIndex) =>
                otherIndex !== index
                && other.date === appointment.date
                && overlaps(
                    toMinutes(appointment.time),
                    toMinutes(appointment.time) + getAppointmentDuration(appointment, settings),
                    toMinutes(other.time),
                    toMinutes(other.time) + getAppointmentDuration(other, settings)
                )
            )
        ).map((appointment) => appointment.id)
    );
}

export function getBookableDates(appointments, settings, service, days = 90) {
    return Array.from({ length: days }, (_, index) => dateAfterDays(index))
        .filter((date) => getAvailableSlots(appointments, date, { settings, service }).length > 0);
}
