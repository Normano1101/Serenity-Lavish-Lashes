// "Date rules" are one-off exceptions to the weekly hours, stored in the database. A rule's type is:
//   'closed' - unavailable all day (holiday, vacation)
//   'block'  - only some hours are unavailable
//   'hours'  - different opening hours for that day
import { toMinutes } from './dates.js';
import { supabase } from '../lib/supabase.js';

const RULE_COLUMNS = 'id, rule_date, rule_type, starts_at, ends_at, opens_at, closes_at, label, created_at';

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

export async function fetchDateRules() {
    const { data, error } = await supabase
        .from('date_rules')
        .select(RULE_COLUMNS)
        .order('rule_date')
        .order('created_at');
    if (error) throw error;
    return (data ?? []).map(mapDatabaseRule);
}

// How many pending or confirmed appointments on these dates would this rule affect?
export async function countAffectedAppointments(dates, rule) {
    const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date, starts_at_time, duration_minutes, status')
        .in('appointment_date', dates)
        .in('status', ['pending', 'confirmed']);
    if (error) throw error;

    return data.filter((appointment) => {
        if (rule.type === 'closed') return true;
        const start = toMinutes(appointment.starts_at_time);
        const end = start + appointment.duration_minutes;
        if (rule.type === 'hours') return start < toMinutes(rule.open) || end > toMinutes(rule.close);
        return start < toMinutes(rule.end) && end > toMinutes(rule.start);
    }).length;
}

async function insertRules(rule, dates) {
    const { error } = await supabase.from('date_rules').insert(dates.map((date) => toDatabaseRule(rule, date)));
    if (error) throw error;
}

// When editing, the first date updates the existing rule and any others get new rules.
export async function saveDateRules(rule, dates, editingRuleId) {
    if (!editingRuleId) {
        await insertRules(rule, dates);
        return;
    }

    const [firstDate, ...remainingDates] = dates;
    const { data, error } = await supabase
        .from('date_rules')
        .update(toDatabaseRule(rule, firstDate))
        .eq('id', editingRuleId)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This rule could not be updated. Check your admin access and try again.');
    if (remainingDates.length) await insertRules(rule, remainingDates);
}

export async function deleteDateRule(id) {
    const { data, error } = await supabase
        .from('date_rules')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This rule could not be removed. Check your admin access and try again.');
}
