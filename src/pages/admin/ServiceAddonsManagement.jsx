import { useEffect, useState } from 'react';
import useServiceAddons from '../../hooks/useServiceAddons.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';

function makeDraft(addon = null) {
    return {
        key: addon?.id ?? `new-addon-${crypto.randomUUID()}`,
        id: addon?.id ?? null,
        name: addon?.name ?? '',
        description: addon?.description ?? '',
        price: addon?.price ?? '',
        isActive: addon?.is_active ?? true
    };
}

function parsePrice(value) {
    if (value === '') return null;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error('Price must be a non-negative amount or left blank.');
    }
    return price;
}

export default function ServiceAddonsManagement() {
    const { addons, loading, error, refresh } = useServiceAddons({ includeInactive: true });
    const [drafts, setDrafts] = useState([]);
    const [dirtyIds, setDirtyIds] = useState(() => new Set());
    const [savingId, setSavingId] = useState('');
    const [message, setMessage] = useState('');
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const savedDrafts = addons.map((addon) => makeDraft(addon));
        setDrafts((current) => {
            const currentById = new Map(current.map((draft) => [draft.key, draft]));
            const refreshed = savedDrafts.map((draft) =>
                dirtyIds.has(draft.key) ? currentById.get(draft.key) ?? draft : draft
            );
            const unsavedNew = current.filter((draft) =>
                draft.id === null && dirtyIds.has(draft.key)
            );
            return [...refreshed, ...unsavedNew];
        });
    }, [addons, dirtyIds]);

    const updateDraft = (key, updates) => {
        setDirtyIds((current) => new Set(current).add(key));
        setMessage('');
        setFormError('');
        setDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, ...updates } : draft));
    };

    const saveAddon = async (event, draft) => {
        event.preventDefault();
        setMessage('');
        setFormError('');
        const name = draft.name.trim();
        if (!name || name.length > 100) {
            setFormError('Enter an add-on name between 1 and 100 characters.');
            return;
        }
        if (draft.description.length > 1000) {
            setFormError('Add-on descriptions must be 1000 characters or fewer.');
            return;
        }
        if (!draft.isActive) {
            const previous = addons.find((addon) => addon.id === draft.id);
            if (previous?.is_active
                && !window.confirm(`Deactivate ${name}? It will no longer appear to customers.`)) {
                return;
            }
        }

        setSavingId(draft.key);
        try {
            const values = {
                name,
                description: draft.description.trim(),
                price: parsePrice(draft.price),
                is_active: draft.isActive,
                updated_at: new Date().toISOString()
            };
            const result = draft.id
                ? await supabase.from('service_addons').update(values).eq('id', draft.id)
                : await supabase.from('service_addons').insert(values);
            if (result.error) throw result.error;

            setMessage(`${name} saved.`);
            setDirtyIds((current) => {
                const next = new Set(current);
                next.delete(draft.key);
                return next;
            });
            setDrafts((current) => current.filter((item) => item.key !== draft.key));
            await refresh();
        } catch (saveError) {
            setFormError(`Could not save ${name}: ${saveError.message}`);
        } finally {
            setSavingId('');
        }
    };

    const deleteAddon = async (draft) => {
        if (!draft.id || !window.confirm(`Permanently remove ${draft.name}?`)) return;
        setMessage('');
        setFormError('');
        try {
            const { error: deleteError } = await supabase
                .from('service_addons')
                .delete()
                .eq('id', draft.id);
            if (deleteError) throw deleteError;
            setDrafts((current) => current.filter((item) => item.key !== draft.key));
            setDirtyIds((current) => {
                const next = new Set(current);
                next.delete(draft.key);
                return next;
            });
            setMessage(`${draft.name} removed.`);
            await refresh();
        } catch (deleteError) {
            setFormError(`Could not remove ${draft.name}: ${deleteError.message}`);
        }
    };

    return (
        <section className="admin-panel service-management">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Optional service upgrades</p>
                    <h2>Add-Ons</h2>
                </div>
                <button
                    type="button"
                    className="small-button"
                    disabled={!isSupabaseConfigured}
                    onClick={() => {
                        const draft = makeDraft();
                        setDrafts((current) => [...current, draft]);
                        setDirtyIds((current) => new Set(current).add(draft.key));
                        setMessage('');
                        setFormError('');
                    }}
                >
                    Add add-on
                </button>
            </div>
            {loading && <p role="status">Loading add-ons…</p>}
            {error && <p className="form-message form-error" role="alert">{error}</p>}
            {message && <p className="form-message form-success" role="status">{message}</p>}
            {formError && <p className="form-message form-error" role="alert">{formError}</p>}
            <div className="service-management-list">
                {drafts.map((draft, index) => (
                    <form
                        className={`service-management-card${draft.isActive ? '' : ' service-management-card-inactive'}`}
                        key={draft.key || `addon-${index}`}
                        onSubmit={(event) => saveAddon(event, draft)}
                    >
                        <div className="service-management-fields">
                            <label>
                                Add-on name
                                <input
                                    value={draft.name}
                                    maxLength="100"
                                    onChange={(event) => updateDraft(draft.key, { name: event.target.value })}
                                    required
                                />
                            </label>
                            <label>
                                Price
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.price}
                                    placeholder="Price TBD"
                                    onChange={(event) => updateDraft(draft.key, { price: event.target.value })}
                                />
                            </label>
                            <label className="service-description-field">
                                Description
                                <textarea
                                    rows="2"
                                    maxLength="1000"
                                    value={draft.description}
                                    onChange={(event) => updateDraft(draft.key, { description: event.target.value })}
                                />
                            </label>
                        </div>
                        <label className="service-active-toggle">
                            <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={(event) => updateDraft(draft.key, { isActive: event.target.checked })}
                            />
                            Active
                        </label>
                        <div className="service-addon-actions">
                            <button type="submit" className="btn service-save-button" disabled={!isSupabaseConfigured || savingId === draft.key}>
                                {savingId === draft.key ? 'Saving…' : 'Save add-on'}
                            </button>
                            {draft.id && (
                                <button type="button" className="small-button" onClick={() => deleteAddon(draft)}>
                                    Remove permanently
                                </button>
                            )}
                        </div>
                    </form>
                ))}
            </div>
        </section>
    );
}
