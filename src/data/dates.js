// Date and time helpers. Throughout the site:
//   a "date key" is a date as text, like '2026-11-06'
//   a "time" is 24-hour text, like '17:30'

// Turn a Date into a date key.
export function formatDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

// Today's date key at the studio, which may differ from the visitor's own timezone.
export function getDateKeyInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function getBrowserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

// Noon is used on purpose: daylight-saving changes can never push it onto another day.
export function parseDateKey(dateKey) {
    return new Date(`${dateKey}T12:00:00`);
}

export function dateAfterDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
}

export function addDays(dateKey, count) {
    const date = parseDateKey(dateKey);
    date.setDate(date.getDate() + count);
    return formatDateKey(date);
}

// The Monday of the week containing dateKey.
export function getWeekStart(dateKey) {
    const date = parseDateKey(dateKey);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return formatDateKey(date);
}

// The 42 days (6 rows) of an admin calendar page. Weeks start on Monday.
export function getMondayMonthGrid(month) {
    const year = month.getFullYear();
    const firstDay = new Date(year, month.getMonth(), 1, 12);
    const daysBeforeFirst = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) =>
        new Date(year, month.getMonth(), 1 - daysBeforeFirst + index, 12)
    );
}

// The days of the customer booking calendar. Weeks start on Sunday, always in full rows.
export function getSundayMonthCells(month) {
    const year = month.getFullYear();
    const daysBeforeFirst = new Date(year, month.getMonth(), 1).getDay();
    const dayCount = new Date(year, month.getMonth() + 1, 0).getDate();
    const cellCount = Math.max(35, Math.ceil((daysBeforeFirst + dayCount) / 7) * 7);

    return Array.from({ length: cellCount }, (_, index) => {
        const date = new Date(year, month.getMonth(), index - daysBeforeFirst + 1);
        return { date, key: formatDateKey(date), inMonth: date.getMonth() === month.getMonth() };
    });
}

// '2026-11-06' becomes 'Nov 6, 2026'. Pass options for a different style.
export function formatDate(dateKey, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, options);
}

// '17:30' becomes '5:30 PM'.
export function formatTime(time) {
    const [hour, minute] = time.split(':').map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    });
}

// 60 becomes '1 hour', 210 becomes '3.5 hours', 45 becomes '45 minutes'.
export function formatDuration(minutes) {
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration <= 0) return '';
    if (duration % 60 === 0) {
        const hours = duration / 60;
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    if (duration > 60 && duration % 30 === 0) return `${(duration / 60).toFixed(1)} hours`;
    return `${duration} minutes`;
}

// '01:30' becomes 90, which makes times easy to compare and add.
export function toMinutes(time) {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// 90 becomes '01:30'.
export function minutesToTime(totalMinutes) {
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    return `${hours}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

// The database stores '17:30:00'; the site only uses '17:30'.
export function trimSeconds(time) {
    return String(time).slice(0, 5);
}
