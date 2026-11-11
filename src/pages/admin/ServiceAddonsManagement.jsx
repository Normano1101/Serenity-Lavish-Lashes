// The "Add-Ons" tab: create, edit and remove extras like spikes or color.
// The public price list shows whichever add-ons are active here.
import { useState } from 'react';
import { ErrorMessage, SuccessMessage } from '../../components/Messages.jsx';
import { MAX_SERVICE_PRICE, parseOptionalPrice } from '../../data/services.js';
import useDrafts from '../../hooks/useDrafts.js';
import useServiceAddons from '../../hooks/useServiceAddons.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import PanelHeading from './PanelHeading.jsx';

// An editable copy of an add-on, or a blank one when no add-on is passed.
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

function addonsToDrafts(addons) {
    return addons.map((addon) => makeDraft(addon));
}

export default function ServiceAddonsManagement() {
    const { addons, loading, error, refresh } = useServiceAddons({ includeInactive: true });
    const { drafts, addDraft, updateDraft: changeDraft, removeDraft } = useDrafts(addons, addonsToDrafts);
    const [savingKey, setSavingKey] = useState('');
    const [message, setMessage] = useState('');
    const [formError, setFormError] = useState('');

    const clearMessages = () => {
        setMessage('');
        setFormError('');
    };

    const updateDraft = (key, updates) => {
        clearMessages();
        changeDraft(key, updates);
    };

    const saveAddon = async (event, draft) => {
        event.preventDefault();
        clearMessages();

        const name = draft.name.trim();
        if (!name || name.length > 100) {
            setFormError('Enter an add-on name between 1 and 100 characters.');
            return;
        }
        if (draft.description.length > 1000) {
            setFormError('Add-on descriptions must be 1000 characters or fewer.');
            return;
        }
        const wasActive = addons.find((addon) => addon.id === draft.id)?.is_active;
        if (!draft.isActive && wasActive && !window.confirm(`Deactivate ${name}? It will no longer appear to customers.`)) {
            return;
        }

        setSavingKey(draft.key);
        try {
            const values = {
                name,
                description: draft.description.trim(),
                price: parseOptionalPrice(draft.price, 'Price'),
                is_active: draft.isActive,
                updated_at: new Date().toISOString()
            };
            const { error: saveError } = draft.id
                ? await supabase.from('service_addons').update(values).eq('id', draft.id)
                : await supabase.from('service_addons').insert(values);
            if (saveError) throw saveError;

            setMessage(`${name} saved.`);
            removeDraft(draft.key);
            await refresh();
        } catch (saveError) {
            setFormError(`Could not save ${name}: ${saveError.message}`);
        } finally {
            setSavingKey('');
        }
    };

    const deleteAddon = async (draft) => {
        if (!draft.id || !window.confirm(`Permanently remove ${draft.name}?`)) return;
        clearMessages();
        try {
            const { error: deleteError } = await supabase.from('service_addons').delete().eq('id', draft.id);
            if (deleteError) throw deleteError;
            removeDraft(draft.key);
            setMessage(`${draft.name} removed.`);
            await refresh();
        } catch (deleteError) {
            setFormError(`Could not remove ${draft.name}: ${deleteError.message}`);
        }
    };

    return (
        <section className="admin-panel service-management">
            <PanelHeading eyebrow="Optional service upgrades" title="Add-Ons">
                <button
                    type="button"
                    className="small-button"
                    disabled={!isSupabaseConfigured}
                    onClick={() => {
                        addDraft(makeDraft());
                        clearMessages();
                    }}
                >
                    Add add-on
                </button>
            </PanelHeading>
            {loading && <p role="status">Loading add-ons…</p>}
            <ErrorMessage>{error}</ErrorMessage>
            <SuccessMessage>{message}</SuccessMessage>
            <ErrorMessage>{formError}</ErrorMessage>
            <div className="service-management-list">
                {drafts.map((draft) => (
                    <form
                        className={`service-management-card${draft.isActive ? '' : ' service-management-card-inactive'}`}
                        key={draft.key}
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
                                    max={MAX_SERVICE_PRICE}
                                    step="0.01"
                                    inputMode="decimal"
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
                            <button type="submit" className="btn service-save-button" disabled={!isSupabaseConfigured || savingKey === draft.key}>
                                {savingKey === draft.key ? 'Saving…' : 'Save add-on'}
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
