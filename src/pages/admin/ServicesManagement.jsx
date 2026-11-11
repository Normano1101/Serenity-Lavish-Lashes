// The "Services & Pricing" panel: edit lash sets on one tab and add-ons on the other.
// One "draft" here is one lash style, which is saved as both a full-set row and a fill row.
import { useEffect, useRef, useState } from 'react';
import { ErrorMessage, SuccessMessage } from '../../components/Messages.jsx';
import {
    getServiceDisplayName,
    getServiceImageSource,
    MAX_SERVICE_PRICE,
    pairFullSetsWithFills,
    parseOptionalPrice
} from '../../data/services.js';
import useDrafts from '../../hooks/useDrafts.js';
import useServices from '../../hooks/useServices.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import PanelHeading from './PanelHeading.jsx';
import ServiceAddonsManagement from './ServiceAddonsManagement.jsx';
import ServicePhotoEditor from './ServicePhotoEditor.jsx';
import './services-management.css';

const IMAGE_BUCKET = 'serenity-service-images';
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const PRICE_FIELDS = [
    { key: 'fullSetPrice', label: 'Full set price' },
    { key: 'refillTwoWeekPrice', label: '2-week refill price' },
    { key: 'refillThreeWeekPrice', label: '3-week refill price' }
];
const DURATION_FIELDS = [
    { key: 'fullSetDuration', label: 'Full set duration (minutes)', errorLabel: 'Full set duration' },
    { key: 'refillDuration', label: 'Refill duration (minutes)', errorLabel: 'Refill duration' }
];

function createDraft(fullService, fillService) {
    return {
        key: fullService?.id ?? `new-${crypto.randomUUID()}`,
        fullServiceId: fullService?.id ?? null,
        name: fullService ? getServiceDisplayName(fullService.name) : '',
        description: fullService?.description ?? '',
        imageUrls: fullService?.image_urls ?? [],
        fullSetPrice: fullService?.price ?? '',
        refillTwoWeekPrice: fillService?.price ?? '',
        refillThreeWeekPrice: fillService?.refill_3_week_price ?? '',
        fullSetDuration: fullService?.duration_minutes ?? '',
        refillDuration: fillService?.duration_minutes ?? '',
        isActive: fullService?.is_active ?? true
    };
}

function servicesToDrafts(services) {
    return pairFullSetsWithFills(services).map(({ full, fill }) => createDraft(full, fill));
}

// Returns a message describing the first problem, or '' when the draft is valid.
function validateDraft(draft) {
    const name = draft.name.trim();
    if (!name) return 'Enter a service name.';
    if (name.length > 100 || / (Full Set|Fill)$/.test(name)) {
        return 'Enter a lash-set name without “Full Set” or “Fill” at the end.';
    }
    // Check prices up front so a typo is reported before any "deactivate?" question or save attempt.
    for (const { key, label } of PRICE_FIELDS) {
        try {
            parseOptionalPrice(draft[key], label);
        } catch (priceError) {
            return priceError.message;
        }
    }
    for (const { key, errorLabel } of DURATION_FIELDS) {
        const minutes = Number(draft[key]);
        if (draft[key] !== '' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
            return `${errorLabel} must be between 1 and 1440 minutes.`;
        }
    }
    return '';
}

// Check a photo, upload it, and return its public web address.
async function uploadServiceImage(file) {
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) throw new Error(`${file.name} must be a JPEG, PNG, WebP, or GIF image.`);
    if (file.size > MAX_IMAGE_SIZE) throw new Error(`${file.name} exceeds the 10 MB limit.`);

    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function TabButton({ id, panelId, active, onClick, children }) {
    return (
        <button
            id={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            className={active ? 'service-management-tab-active' : ''}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

// The sideways-scrolling row of lash set cards.
function ServiceSelector({ drafts, selectedKey, onSelect }) {
    const track = useRef(null);
    const scroll = (direction) => track.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });

    return (
        <div className="service-selector">
            <button type="button" className="service-selector-arrow" aria-label="Scroll lash sets left" onClick={() => scroll(-1)}>‹</button>
            <div
                className="service-selector-track"
                ref={track}
                onWheel={(event) => {
                    // Let a normal mouse wheel scroll the row sideways.
                    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
                }}
            >
                {drafts.map((draft) => (
                    <button
                        type="button"
                        key={draft.key}
                        className={`service-selector-card${selectedKey === draft.key ? ' service-selector-card-selected' : ''}`}
                        aria-pressed={selectedKey === draft.key}
                        onClick={() => onSelect(draft.key)}
                    >
                        {draft.imageUrls[0]
                            ? <img src={getServiceImageSource(draft.imageUrls[0])} alt="" loading="lazy" />
                            : <span className="service-selector-placeholder" aria-hidden="true">SL</span>}
                        <span>{draft.name.trim() || 'New lash set'}</span>
                        {!draft.isActive && <small>Inactive</small>}
                    </button>
                ))}
            </div>
            <button type="button" className="service-selector-arrow" aria-label="Scroll lash sets right" onClick={() => scroll(1)}>›</button>
        </div>
    );
}

export default function ServicesManagement() {
    const { services, loading, error, refresh } = useServices({ includeInactive: true });
    const { drafts, addDraft, updateDraft: changeDraft, removeDraft } = useDrafts(services, servicesToDrafts);
    const [savingKey, setSavingKey] = useState('');
    const [uploadingKey, setUploadingKey] = useState('');
    const [message, setMessage] = useState('');
    const [formError, setFormError] = useState('');
    const [photoCategories, setPhotoCategories] = useState({});
    const [selectedKey, setSelectedKey] = useState('');
    const [activeTab, setActiveTab] = useState('services');

    const clearMessages = () => {
        setMessage('');
        setFormError('');
    };

    const updateDraft = (key, updates) => {
        clearMessages();
        changeDraft(key, updates);
    };

    // If the selected lash set disappears, select the first one instead.
    useEffect(() => {
        if (!drafts.length) setSelectedKey('');
        else if (!drafts.some((draft) => draft.key === selectedKey)) setSelectedKey(drafts[0].key);
    }, [drafts, selectedKey]);

    const addService = () => {
        const draft = createDraft(null, null);
        addDraft(draft);
        setSelectedKey(draft.key);
        setActiveTab('services');
        clearMessages();
    };

    const uploadImages = async (draft, files) => {
        if (!files.length) return;
        setUploadingKey(draft.key);
        clearMessages();
        try {
            const uploadedUrls = [];
            for (const file of files) uploadedUrls.push(await uploadServiceImage(file));
            updateDraft(draft.key, { imageUrls: [...draft.imageUrls, ...uploadedUrls] });
        } catch (uploadError) {
            setFormError(`Could not upload service image: ${uploadError.message}`);
        } finally {
            setUploadingKey('');
        }
    };

    const saveService = async (event, draft) => {
        event.preventDefault();
        clearMessages();

        const problem = validateDraft(draft);
        if (problem) {
            setFormError(problem);
            return;
        }

        const name = draft.name.trim();
        const wasActive = services.find((service) => service.id === draft.fullServiceId)?.is_active;
        if (!draft.isActive && wasActive
            && !window.confirm(`Deactivate ${name} Set? It will no longer appear to customers or be bookable.`)) {
            return;
        }

        setSavingKey(draft.key);
        try {
            const { error: saveError } = await supabase.rpc('save_lash_service', {
                p_full_service_id: draft.fullServiceId,
                p_name: name,
                p_description: draft.description.trim(),
                p_image_urls: draft.imageUrls,
                p_full_set_price: parseOptionalPrice(draft.fullSetPrice, 'Full set price'),
                p_refill_two_week_price: parseOptionalPrice(draft.refillTwoWeekPrice, '2-week refill price'),
                p_refill_three_week_price: parseOptionalPrice(draft.refillThreeWeekPrice, '3-week refill price'),
                p_full_set_duration: draft.fullSetDuration === '' ? null : Number(draft.fullSetDuration),
                p_refill_duration: draft.refillDuration === '' ? null : Number(draft.refillDuration),
                p_is_active: draft.isActive
            });
            if (saveError) throw saveError;
            setMessage(`${name} Set saved.`);
            removeDraft(draft.key);
            await refresh();
        } catch (saveError) {
            setFormError(`Could not save ${name} Set: ${saveError.message}`);
        } finally {
            setSavingKey('');
        }
    };

    const selectedDraft = drafts.find((draft) => draft.key === selectedKey);
    const selectedService = services.find((service) => service.id === selectedDraft?.fullServiceId);

    // Connects an input to a field of the selected draft: <input {...field('name')} />
    const field = (key) => ({
        value: selectedDraft[key],
        onChange: (event) => updateDraft(selectedDraft.key, { [key]: event.target.value })
    });

    return (
        <section className="admin-panel service-management" id="services">
            <PanelHeading eyebrow="Shared Supabase catalog" title="Services & Pricing">
                {activeTab === 'services' && (
                    <button type="button" className="small-button" onClick={addService} disabled={!isSupabaseConfigured}>
                        Add lash set
                    </button>
                )}
            </PanelHeading>

            <div className="service-management-tabs" role="tablist" aria-label="Pricing management">
                <TabButton id="lash-sets-tab" panelId="lash-sets-panel" active={activeTab === 'services'} onClick={() => setActiveTab('services')}>
                    Lash Sets
                </TabButton>
                <TabButton id="addons-tab" panelId="addons-panel" active={activeTab === 'addons'} onClick={() => setActiveTab('addons')}>
                    Add-Ons
                </TabButton>
            </div>

            {activeTab === 'addons' ? (
                <div id="addons-panel" role="tabpanel" aria-labelledby="addons-tab">
                    <ServiceAddonsManagement />
                </div>
            ) : (
                <div id="lash-sets-panel" role="tabpanel" aria-labelledby="lash-sets-tab">
                    <p className="schedule-help">
                        Manage the public price list and the matching full-set and refill booking services. Blank prices appear as “Price TBD.”
                    </p>
                    {!isSupabaseConfigured && (
                        <ErrorMessage>Configure Supabase to manage shared service data. Development demo data is not saved here.</ErrorMessage>
                    )}
                    {loading && <p role="status">Loading services…</p>}
                    <ErrorMessage>{error}</ErrorMessage>
                    <SuccessMessage>{message}</SuccessMessage>
                    <ErrorMessage>{formError}</ErrorMessage>

                    <ServiceSelector drafts={drafts} selectedKey={selectedKey} onSelect={setSelectedKey} />

                    {selectedDraft && (
                        <form
                            className={`service-management-card${selectedDraft.isActive ? '' : ' service-management-card-inactive'}`}
                            key={selectedDraft.key}
                            onSubmit={(event) => saveService(event, selectedDraft)}
                        >
                            <div className="service-management-card-heading">
                                <div>
                                    <p className="eyebrow">Selected lash set</p>
                                    <h3>{selectedDraft.name.trim() || 'New lash set'}</h3>
                                </div>
                            </div>

                            <details className="service-editor-section">
                                <summary>Service Details</summary>
                                <div className="service-management-fields">
                                    <label>
                                        Service name
                                        <input {...field('name')} maxLength="100" required />
                                    </label>
                                    <label className="service-description-field">
                                        Description
                                        <textarea rows="3" {...field('description')} />
                                    </label>
                                </div>
                            </details>

                            <details className="service-editor-section" open>
                                <summary>Pricing</summary>
                                <div className="service-management-fields">
                                    {PRICE_FIELDS.map(({ key, label }) => (
                                        <label key={key}>
                                            {label}
                                            <input type="number" min="0" max={MAX_SERVICE_PRICE} step="0.01" inputMode="decimal" {...field(key)} placeholder="Price TBD" />
                                        </label>
                                    ))}
                                </div>
                            </details>

                            <details className="service-editor-section">
                                <summary>Service Photos</summary>
                                <ServicePhotoEditor
                                    draft={selectedDraft}
                                    photoCategory={photoCategories[selectedDraft.key]}
                                    onCategoryChange={(key, category) => setPhotoCategories((current) => ({ ...current, [key]: category }))}
                                    onChange={updateDraft}
                                    onUpload={uploadImages}
                                    uploading={!isSupabaseConfigured || uploadingKey === selectedDraft.key}
                                />
                            </details>

                            <details className="service-editor-section">
                                <summary>Advanced Settings</summary>
                                <div className="service-management-fields">
                                    {DURATION_FIELDS.map(({ key, label }) => (
                                        <label key={key}>
                                            {label}
                                            <input type="number" min="1" max="1440" {...field(key)} />
                                        </label>
                                    ))}
                                    <label className="service-active-toggle">
                                        <input
                                            type="checkbox"
                                            checked={selectedDraft.isActive}
                                            onChange={(event) => updateDraft(selectedDraft.key, { isActive: event.target.checked })}
                                        />
                                        Active service
                                    </label>
                                </div>
                            </details>

                            <div className="service-editor-actions">
                                <button
                                    type="submit"
                                    className="btn service-save-button"
                                    disabled={!isSupabaseConfigured || savingKey === selectedDraft.key || uploadingKey === selectedDraft.key}
                                >
                                    {savingKey === selectedDraft.key ? 'Saving…' : 'Save changes'}
                                </button>
                                {!selectedDraft.fullServiceId && (
                                    <span className="service-unsaved-note">New service · Save to add to the shared catalog</span>
                                )}
                                {selectedService && !selectedService.is_active && (
                                    <span className="service-unsaved-note">This service is currently inactive.</span>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            )}
        </section>
    );
}
