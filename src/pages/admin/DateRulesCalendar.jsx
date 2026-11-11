// The month calendar for picking dates in the date-rules section. Dots mark dates with saved rules.
import { formatDate, formatDateKey, getMondayMonthGrid } from '../../data/dates.js';
import { classNames, plural } from '../../lib/utils.js';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// The most important rule type on a date decides its dot's color.
function getDateStatus(rules) {
    return ['closed', 'block', 'hours'].find((type) => rules.some((rule) => rule.type === type)) ?? '';
}

export default function DateRulesCalendar({ month, todayDateKey, dateRules, selectedDates, onDateClick, onMonthChange, onToday }) {
    return (
        <section className="schedule-month-calendar" aria-label="Date rule calendar">
            <div className="schedule-calendar-heading">
                <button type="button" className="small-button" aria-label="Previous month" onClick={() => onMonthChange(-1)}>‹</button>
                <h4>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h4>
                <button type="button" className="small-button" aria-label="Next month" onClick={() => onMonthChange(1)}>›</button>
                <button type="button" className="small-button schedule-today-button" onClick={onToday}>Today</button>
            </div>
            <div className="schedule-calendar-grid schedule-calendar-weekdays" aria-hidden="true">
                {WEEKDAY_HEADERS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="schedule-calendar-grid">
                {getMondayMonthGrid(month).map((date) => {
                    const dateKey = formatDateKey(date);
                    const rules = dateRules.filter((rule) => rule.date === dateKey);
                    const status = getDateStatus(rules);
                    const selected = selectedDates.includes(dateKey);
                    const ruleCount = rules.length ? `, ${rules.length} saved ${plural(rules.length, 'rule')}` : '';

                    return (
                        <button
                            type="button"
                            key={dateKey}
                            className={classNames(
                                'schedule-calendar-day',
                                date.getMonth() !== month.getMonth() && 'is-outside-month',
                                dateKey === todayDateKey && 'is-today',
                                selected && 'is-selected',
                                status && `has-${status}-rule`
                            )}
                            aria-pressed={selected}
                            aria-label={`${formatDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${ruleCount}`}
                            onClick={() => onDateClick(dateKey)}
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
    );
}
