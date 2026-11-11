// Steps 2 and 3 of the booking form: the month calendar and the buttons for free times.
import { formatDateKey, formatTime, getSundayMonthCells } from '../data/dates.js';
import { classNames } from '../lib/utils.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Text read aloud by screen readers for one calendar day.
function getDayLabel(cell, service, loading, available) {
    const day = cell.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (!service) return `${day}, choose a service first`;
    if (loading) return `${day}, checking availability`;
    return `${day}, ${available ? 'available' : 'unavailable'}`;
}

function MonthButton({ label, offset, symbol, onMonthChange }) {
    return (
        <button type="button" className="calendar-month-button" aria-label={label} onClick={() => onMonthChange(offset)}>
            {symbol}
        </button>
    );
}

// Step 3: what to show depends on how far through the form the customer is.
function TimePicker({ service, date, time, availableSlots, onTimeChange }) {
    if (!service) return <p className="booking-help">Choose a service first to see available times.</p>;
    if (!date) return <p className="booking-help">Choose an available date on the calendar.</p>;
    if (!availableSlots.length) {
        return <p className="booking-help">There are no available times on this date. Please choose another day.</p>;
    }
    return (
        <div className="booking-time-grid">
            {availableSlots.map((slot) => (
                <button
                    type="button"
                    className={`booking-time-button${time === slot ? ' time-selected' : ''}`}
                    aria-pressed={time === slot}
                    key={slot}
                    onClick={() => onTimeChange(slot)}
                >
                    {formatTime(slot)}
                </button>
            ))}
        </div>
    );
}

export default function BookingAvailability({
    service,
    date,
    time,
    month,
    slotsByDate,
    availableSlots,
    availabilityLoading,
    availabilityMessage,
    bookingsDisabled,
    onMonthChange,
    onDateChange,
    onTimeChange
}) {
    const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const today = formatDateKey(new Date());

    return (
        <>
            <section className="booking-calendar-section" aria-labelledby="calendar-heading">
                <div className="booking-section-heading">
                    <h2 id="calendar-heading">2. Choose an available date</h2>
                    {!service && <span>Choose a lash service above first</span>}
                </div>
                <div className={`booking-calendar${service ? '' : ' calendar-needs-service'}`}>
                    {!service && (
                        <p className="booking-calendar-prompt" role="status">
                            {bookingsDisabled
                                ? 'Choose a lash service to check its available dates. Online appointment requests remain turned off.'
                                : 'Choose a lash service in step 1 to load availability and select a date.'}
                        </p>
                    )}
                    {availabilityLoading && <p role="status">Loading available times…</p>}
                    {service && bookingsDisabled && (
                        <p className="booking-calendar-prompt" role="status">
                            You can check available dates and times, but online appointment requests are not enabled yet.
                        </p>
                    )}
                    {availabilityMessage && <p className="booking-calendar-prompt" role="status">{availabilityMessage}</p>}
                    <div className="booking-calendar-header">
                        <MonthButton label="Previous month" offset={-1} symbol="‹" onMonthChange={onMonthChange} />
                        <h3 aria-live="polite">{monthLabel}</h3>
                        <MonthButton label="Next month" offset={1} symbol="›" onMonthChange={onMonthChange} />
                    </div>
                    <div className="booking-calendar-grid" aria-label={monthLabel}>
                        {WEEKDAY_LABELS.map((weekday) => (
                            <span className="booking-weekday" key={weekday}>{weekday}</span>
                        ))}
                        {getSundayMonthCells(month).map((cell) => {
                            const available = cell.inMonth && (slotsByDate.get(cell.key) ?? []).length > 0;
                            return (
                                <button
                                    type="button"
                                    className={classNames(
                                        'booking-calendar-day',
                                        available ? 'day-available' : 'day-unavailable',
                                        date === cell.key && 'day-selected',
                                        !cell.inMonth && 'day-outside-month'
                                    )}
                                    key={cell.key}
                                    disabled={!service || cell.key < today || !available}
                                    aria-pressed={date === cell.key}
                                    aria-label={getDayLabel(cell, service, availabilityLoading, available)}
                                    onClick={() => onDateChange(cell.key)}
                                >
                                    {cell.date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                    <div className="booking-calendar-legend" aria-label="Calendar key">
                        <span><i className="legend-available" /> Available</span>
                        <span><i className="legend-unavailable" /> Unavailable</span>
                        <span><i className="legend-selected" /> Selected</span>
                    </div>
                </div>
            </section>

            <section className="booking-time-section" aria-labelledby="time-heading">
                <h2 id="time-heading">3. Choose an available time</h2>
                <TimePicker
                    service={service}
                    date={date}
                    time={time}
                    availableSlots={availableSlots}
                    onTimeChange={onTimeChange}
                />
            </section>
        </>
    );
}
