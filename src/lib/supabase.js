// The connection to Supabase (the online database). If the keys are missing the
// site runs in "demo mode" and stores everything in the browser instead.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// `supabase` is null in demo mode, so check isSupabaseConfigured before using it.
export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
    : null;

// Each subscription gets its own number so channel names never repeat (see below).
let nextSubscriptionId = 0;

// Run onChange whenever a table changes in the database. Returns a function that stops listening.
export function subscribeToTable({ channel, table, onChange, onUnavailable }) {
    // Supabase hands back the SAME channel object when a name is reused, and adding a listener
    // to a channel that is already running throws an error that blanks the whole page. Two
    // components can load the same table at once (the Services panel and the appointment
    // pop-up both list services), so every subscription gets a unique name.
    nextSubscriptionId += 1;
    const subscription = supabase
        .channel(`${channel}-${nextSubscriptionId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange())
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onUnavailable();
        });

    return () => {
        supabase.removeChannel(subscription);
    };
}
