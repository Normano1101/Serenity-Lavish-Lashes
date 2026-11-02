import { useEffect, useRef, useState } from 'react';
import {
    getServiceBaseName,
    getServiceDisplayName,
    getServiceImageSource,
    getServiceType,
    getLashPhotoCategory,
    LASH_PHOTO_CATEGORIES
} from '../../data/services.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import useServices from '../../hooks/useServices.js';
import ServiceAddonsManagement from './ServiceAddonsManagement.jsx';
import './services-management.css';

// Use the protected public-read bucket configured by the service-image migration.
const IMAGE_BUCKET = 'serenity-service-images';
const IMAGE_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
};

// Convert stored full-set/fill rows into one editable style card.
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

// Pair each lash style's full set and fill into a single admin draft.
function getDrafts(services) {
    const fills = new Map(
        services
            .filter((service) => getServiceType(service.name) === 'fill')
            .map((service) => [getServiceBaseName(service.name), service])
    );

    return services
        .filter((service) => getServiceType(service.name) === 'full')
        .map((service) => createDraft(
            service,
            fills.get(getServiceBaseName(service.name))
        ));
}

// Convert an optional price to a number and reject invalid user input.
function asNullablePrice(value, label) {
    if (value === '') return null;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error(`${label} must be a non-negative amount or left blank.`);
    }
    return price;
}

// Let admins edit service details, upload photos, and save the shared catalog.
export default function ServicesManagement() {
    const { services, loading, error, refresh } = useServices({ includeInactive: true });
    const [drafts, setDrafts] = useState([]);
    const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
    const [savingKey, setSavingKey] = useState('');
    const [uploadingKey, setUploadingKey] = useState('');
    const [message, setMessage] = useState('');
    const [formError, setFormError] = useState('');
    const [photoCategories, setPhotoCategories] = useState({});
    const [selectedKey, setSelectedKey] = useState('');
    const [activeTab, setActiveTab] = useState('services');
    const serviceCarousel = useRef(null);

    // Merge refreshed server data without discarding unsaved edits or new drafts.
    useEffect(() => {
        const savedDrafts = getDrafts(services);
        setDrafts((current) => {
            const currentByKey = new Map(current.map((draft) => [draft.key, draft]));
            const refreshed = savedDrafts.map((draft) =>
                dirtyKeys.has(draft.key) ? currentByKey.get(draft.key) ?? draft : draft
            );
            const unsavedNew = current.filter((draft) =>
                dirtyKeys.has(draft.key) && !savedDrafts.some((savedDraft) => savedDraft.key === draft.key)
            );
            return [...refreshed, ...unsavedNew];
        });
    }, [dirtyKeys, services]);

    // Keep the selected style visible when the catalog changes.
    useEffect(() => {
        if (!drafts.length) {
            setSelectedKey('');
            return;
        }
        if (!drafts.some((draft) => draft.key === selectedKey)) {
            setSelectedKey(drafts[0].key);
        }
    }, [drafts, selectedKey]);

    // Apply a field edit to one draft while preserving its other form values.
    const updateDraft = (key, updates) => {
        setDirtyKeys((current) => new Set(current).add(key));
        setMessage('');
        setFormError('');
        setDrafts((current) => current.map((draft) =>
            draft.key === key ? { ...draft, ...updates } : draft
        ));
    };

    // Add a blank service card and select it for immediate editing.
    const addService = () => {
        const draft = createDraft(null, null);
        setDrafts((current) => [...current, draft]);
        setSelectedKey(draft.key);
        setActiveTab('services');
        setDirtyKeys((current) => new Set(current).add(draft.key));
        setMessage('');
        setFormError('');
    };

    // Validate, upload, and append selected photos to the draft's image list.
    const uploadImages = async (draft, files) => {
        if (!files.length) return;
        setUploadingKey(draft.key);
        setMessage('');
        setFormError('');
        try {
            const uploadedUrls = [];
            for (const file of files) {
                const extension = IMAGE_EXTENSIONS[file.type];
                if (!extension) {
                    throw new Error(`${file.name} must be a JPEG, PNG, WebP, or GIF image.`);
                }
                if (file.size > 10 * 1024 * 1024) {
                    throw new Error(`${file.name} exceeds the 10 MB limit.`);
                }

                const path = `${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await supabase.storage
                    .from(IMAGE_BUCKET)
                    .upload(path, file, { contentType: file.type, upsert: false });
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
                uploadedUrls.push(data.publicUrl);
            }

            updateDraft(draft.key, { imageUrls: [...draft.imageUrls, ...uploadedUrls] });
        } catch (uploadError) {
            setFormError(`Could not upload service image: ${uploadError.message}`);
        } finally {
            setUploadingKey('');
        }
    };

    // Validate one draft and save its full-set/fill data through the admin RPC.
    const saveService = async (event, draft) => {
        event.preventDefault();
        setMessage('');
        setFormError('');

        if (!draft.name.trim()) {
            setFormError('Enter a service name.');
            return;
        }
        if (draft.name.trim().length > 100 || / (Full Set|Fill)$/.test(draft.name.trim())) {
            setFormError('Enter a lash-set name without “Full Set” or “Fill” at the end.');
            return;
        }
        for (const [label, value] of [
            ['Full set duration', draft.fullSetDuration],
            ['Refill duration', draft.refillDuration]
        ]) {
            if (value !== ''
                && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 1440)) {
                setFormError(`${label} must be between 1 and 1440 minutes.`);
                return;
            }
        }
        if (!draft.isActive) {
            const existingService = services.find((service) => service.id === draft.fullServiceId);
            if (existingService?.is_active
                && !window.confirm(`Deactivate ${draft.name.trim()} Set? It will no longer appear to customers or be bookable.`)) {
                return;
            }
        }

        setSavingKey(draft.key);
        try {
            const { error: saveError } = await supabase.rpc('save_lash_service', {
                p_full_service_id: draft.fullServiceId,
                p_name: draft.name.trim(),
                p_description: draft.description.trim(),
                p_image_urls: draft.imageUrls,
                p_full_set_price: asNullablePrice(draft.fullSetPrice, 'Full set price'),
                p_refill_two_week_price: asNullablePrice(draft.refillTwoWeekPrice, '2-week refill price'),
                p_refill_three_week_price: asNullablePrice(draft.refillThreeWeekPrice, '3-week refill price'),
                p_full_set_duration: draft.fullSetDuration === '' ? null : Number(draft.fullSetDuration),
                p_refill_duration: draft.refillDuration === '' ? null : Number(draft.refillDuration),
                p_is_active: draft.isActive
            });
            if (saveError) throw saveError;
            setMessage(`${draft.name.trim()} Set saved.`);
            setDrafts((current) => current.filter((item) => item.key !== draft.key));
            setDirtyKeys((current) => {
                const next = new Set(current);
                next.delete(draft.key);
                return next;
            });
            await refresh();
        } catch (saveError) {
            setFormError(`Could not save ${draft.name.trim()} Set: ${saveError.message}`);
        } finally {
            setSavingKey('');
        }
    };

    // Move the horizontal service selector by one visible card.
    const scrollServices = (direction) => {
        serviceCarousel.current?.scrollBy({
            left: direction * 240,
            behavior: 'smooth'
        });
    };

    const selectedDraft = drafts.find((draft) => draft.key === selectedKey);
    const selectedExistingService = services.find((service) => service.id === selectedDraft?.fullServiceId);
    const selectedCategory = selectedDraft
        ? photoCategories[selectedDraft.key] ?? getLashPhotoCategory(selectedDraft.name)
        : '';
    const categoryImages = LASH_PHOTO_CATEGORIES.find((category) => category.name === selectedCategory)?.images ?? [];

    return (
        <section className="admin-panel service-management">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Shared Supabase catalog</p>
                    <h2>Services &amp; Pricing</h2>
                </div>
                {activeTab === 'services' && (
                    <button type="button" className="small-button" onClick={addService} disabled={!isSupabaseConfigured}>
                        Add lash set
                    </button>
                )}
            </div>

            <div className="service-management-tabs" role="tablist" aria-label="Pricing management">
                <button
                    id="lash-sets-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'services'}
                    aria-controls="lash-sets-panel"
                    className={activeTab === 'services' ? 'service-management-tab-active' : ''}
                    onClick={() => setActiveTab('services')}
                >
                    Lash Sets
                </button>
                <button
                    id="addons-tab"
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'addons'}
                    aria-controls="addons-panel"
                    className={activeTab === 'addons' ? 'service-management-tab-active' : ''}
                    onClick={() => setActiveTab('addons')}
                >
                    Add-Ons
                </button>
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
                <p className="form-message form-error" role="alert">
                    Configure Supabase to manage shared service data. Development demo data is not saved here.
                </p>
            )}
            {loading && <p role="status">Loading services…</p>}
            {error && <p className="form-message form-error" role="alert">{error}</p>}
            {message && <p className="form-message form-success" role="status">{message}</p>}
            {formError && <p className="form-message form-error" role="alert">{formError}</p>}

                    {/* Select a lash style before editing its shared full-set and fill records. */}
                    <div className="service-selector">
                        <button
                            type="button"
                            className="service-selector-arrow"
                            aria-label="Scroll lash sets left"
                            onClick={() => scrollServices(-1)}
                        >
                            ‹
                        </button>
                        <div
                            className="service-selector-track"
                            ref={serviceCarousel}
                            onWheel={(event) => {
                                if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                                    event.currentTarget.scrollLeft += event.deltaY;
                                }
                            }}
                        >
                            {drafts.map((draft) => (
                                <button
                                    type="button"
                                    key={draft.key}
                                    className={`service-selector-card${selectedKey === draft.key ? ' service-selector-card-selected' : ''}`}
                                    aria-pressed={selectedKey === draft.key}
                                    onClick={() => setSelectedKey(draft.key)}
                                >
                                    {draft.imageUrls[0] ? (
                                        <img
                                            src={getServiceImageSource(draft.imageUrls[0])}
                                            alt=""
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span className="service-selector-placeholder" aria-hidden="true">SL</span>
                                    )}
                                    <span>{draft.name.trim() || 'New lash set'}</span>
                                    {!draft.isActive && <small>Inactive</small>}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="service-selector-arrow"
                            aria-label="Scroll lash sets right"
                            onClick={() => scrollServices(1)}
                        >
                            ›
                        </button>
                    </div>

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
                                    <input
                                        value={selectedDraft.name}
                                        maxLength="100"
                                        onChange={(event) => updateDraft(selectedDraft.key, { name: event.target.value })}
                                        required
                                    />
                                </label>
                                <label className="service-description-field">
                                    Description
                                    <textarea
                                        rows="3"
                                        value={selectedDraft.description}
                                        onChange={(event) => updateDraft(selectedDraft.key, { description: event.target.value })}
                                    />
                                </label>
                            </div>
                        </details>

                        <details className="service-editor-section" open>
                            <summary>Pricing</summary>
                            <div className="service-management-fields">
                                <label>
                                    Full set price
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={selectedDraft.fullSetPrice}
                                        onChange={(event) => updateDraft(selectedDraft.key, { fullSetPrice: event.target.value })}
                                        placeholder="Price TBD"
                                    />
                                </label>
                                <label>
                                    2-week refill price
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={selectedDraft.refillTwoWeekPrice}
                                        onChange={(event) => updateDraft(selectedDraft.key, { refillTwoWeekPrice: event.target.value })}
                                        placeholder="Price TBD"
                                    />
                                </label>
                                <label>
                                    3-week refill price
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={selectedDraft.refillThreeWeekPrice}
                                        onChange={(event) => updateDraft(selectedDraft.key, { refillThreeWeekPrice: event.target.value })}
                                        placeholder="Price TBD"
                                    />
                                </label>
                            </div>
                        </details>

                        <details className="service-editor-section">
                            <summary>Service Photos</summary>
                            <fieldset className="service-images-field">
                            <legend>Service photos</legend>
                            <div className="service-image-library">
                                <label className="service-photo-category">
                                    Select lash set
                                    <select
                                        value={selectedCategory}
                                        onChange={(event) => setPhotoCategories((current) => ({
                                            ...current,
                                            [selectedDraft.key]: event.target.value
                                        }))}
                                    >
                                        {LASH_PHOTO_CATEGORIES.map((category) => (
                                            <option value={category.name} key={category.name}>{category.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="service-image-library-grid">
                                    {categoryImages.map((image) => {
                                        const selected = selectedDraft.imageUrls.includes(image.url);
                                        const index = selectedDraft.imageUrls.indexOf(image.url);
                                        return (
                                            <label
                                                className={`service-image-option${selected ? ' service-image-option-selected' : ''}`}
                                                key={image.url}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={(event) => updateDraft(selectedDraft.key, {
                                                        imageUrls: event.target.checked
                                                            ? [...selectedDraft.imageUrls, image.url]
                                                            : selectedDraft.imageUrls.filter((url) => url !== image.url)
                                                    })}
                                                />
                                                <img src={image.url} alt="" loading="lazy" />
                                                <span>{image.label}</span>
                                                {selected && index === 0 && <strong>Primary</strong>}
                                            </label>
                                        );
                                    })}
                                    {categoryImages.length === 0 && (
                                        <p className="service-photo-empty">
                                            No existing photos for this lash set. Upload a photo below to add a preview.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="service-image-previews">
                                <h4>Selected photos · first photo is shown as primary</h4>
                                {selectedDraft.imageUrls.length === 0 && <p>No photos selected yet.</p>}
                                {selectedDraft.imageUrls.map((image, index) => (
                                    <div className="service-image-preview" key={image}>
                                        <img src={getServiceImageSource(image)} alt={`${selectedDraft.name || 'Service'} preview ${index + 1}`} />
                                        <span>{index === 0 ? 'Primary photo' : `Photo ${index + 1}`}</span>
                                        <div className="service-image-preview-actions">
                                            <button
                                                type="button"
                                                className="small-button"
                                                disabled={index === 0}
                                                onClick={() => updateDraft(selectedDraft.key, {
                                                    imageUrls: [image, ...selectedDraft.imageUrls.filter((item) => item !== image)]
                                                })}
                                            >
                                                Make primary
                                            </button>
                                            <button
                                                type="button"
                                                className="small-button"
                                                disabled={index === 0}
                                                aria-label={`Move photo ${index + 1} earlier`}
                                                onClick={() => {
                                                    const next = [...selectedDraft.imageUrls];
                                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                                    updateDraft(selectedDraft.key, { imageUrls: next });
                                                }}
                                            >
                                                Move left
                                            </button>
                                            <button
                                                type="button"
                                                className="small-button"
                                                disabled={index === selectedDraft.imageUrls.length - 1}
                                                aria-label={`Move photo ${index + 1} later`}
                                                onClick={() => {
                                                    const next = [...selectedDraft.imageUrls];
                                                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                                    updateDraft(selectedDraft.key, { imageUrls: next });
                                                }}
                                            >
                                                Move right
                                            </button>
                                            <button
                                                type="button"
                                                className="small-button"
                                                onClick={() => updateDraft(selectedDraft.key, {
                                                    imageUrls: selectedDraft.imageUrls.filter((item) => item !== image)
                                                })}
                                            >
                                                Remove from service
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <label className="service-image-upload">
                                Upload photos
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    disabled={!isSupabaseConfigured || uploadingKey === selectedDraft.key}
                                    onChange={(event) => {
                                        uploadImages(selectedDraft, Array.from(event.target.files ?? []));
                                        event.target.value = '';
                                    }}
                                />
                            </label>
                            {uploadingKey === selectedDraft.key && <span role="status">Uploading photos…</span>}
                            </fieldset>
                        </details>

                        <details className="service-editor-section">
                            <summary>Advanced Settings</summary>
                            <div className="service-management-fields">
                                <label>
                                    Full set duration (minutes)
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={selectedDraft.fullSetDuration}
                                        onChange={(event) => updateDraft(selectedDraft.key, { fullSetDuration: event.target.value })}
                                    />
                                </label>
                                <label>
                                    Refill duration (minutes)
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={selectedDraft.refillDuration}
                                        onChange={(event) => updateDraft(selectedDraft.key, { refillDuration: event.target.value })}
                                    />
                                </label>
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
                            {selectedExistingService && !selectedExistingService.is_active && (
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
