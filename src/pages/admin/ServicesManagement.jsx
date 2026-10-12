import { useEffect, useState } from 'react';
import {
    AVAILABLE_LASH_IMAGES,
    getServiceBaseName,
    getServiceDisplayName,
    getServiceImageSource,
    getServiceType
} from '../../data/services.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import useServices from '../../hooks/useServices.js';
import './services-management.css';

const IMAGE_BUCKET = 'serenity-service-images';
const IMAGE_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
};

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

function asNullablePrice(value, label) {
    if (value === '') return null;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error(`${label} must be a non-negative amount or left blank.`);
    }
    return price;
}

export default function ServicesManagement() {
    const { services, loading, error, refresh } = useServices({ includeInactive: true });
    const [drafts, setDrafts] = useState([]);
    const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
    const [savingKey, setSavingKey] = useState('');
    const [uploadingKey, setUploadingKey] = useState('');
    const [message, setMessage] = useState('');
    const [formError, setFormError] = useState('');

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

    const updateDraft = (key, updates) => {
        setDirtyKeys((current) => new Set(current).add(key));
        setMessage('');
        setFormError('');
        setDrafts((current) => current.map((draft) =>
            draft.key === key ? { ...draft, ...updates } : draft
        ));
    };

    const addService = () => {
        const draft = createDraft(null, null);
        setDrafts((current) => [...current, draft]);
        setDirtyKeys((current) => new Set(current).add(draft.key));
        setMessage('');
        setFormError('');
    };

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

    return (
        <section className="admin-panel service-management">
            <div className="admin-panel-heading">
                <div>
                    <p className="eyebrow">Shared Supabase catalog</p>
                    <h2>Services &amp; Pricing</h2>
                </div>
                <button type="button" className="small-button" onClick={addService} disabled={!isSupabaseConfigured}>
                    Add lash set
                </button>
            </div>

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

            <div className="service-management-list">
                {drafts.map((draft) => (
                    <form
                        className={`service-management-card${draft.isActive ? '' : ' service-management-card-inactive'}`}
                        key={draft.key}
                        onSubmit={(event) => saveService(event, draft)}
                    >
                        <div className="service-management-card-heading">
                            <h3>{draft.name.trim() || 'New lash set'}</h3>
                            <label className="service-active-toggle">
                                <input
                                    type="checkbox"
                                    checked={draft.isActive}
                                    onChange={(event) => {
                                        if (!event.target.checked && !draft.fullServiceId) {
                                            updateDraft(draft.key, { isActive: false });
                                            return;
                                        }
                                        updateDraft(draft.key, { isActive: event.target.checked });
                                    }}
                                />
                                Active
                            </label>
                        </div>

                        <div className="service-management-fields">
                            <label>
                                Service name
                                <input
                                    value={draft.name}
                                    maxLength="100"
                                    onChange={(event) => updateDraft(draft.key, { name: event.target.value })}
                                    required
                                />
                            </label>
                            <label>
                                Full set price
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.fullSetPrice}
                                    onChange={(event) => updateDraft(draft.key, { fullSetPrice: event.target.value })}
                                    placeholder="Price TBD"
                                />
                            </label>
                            <label>
                                2-week refill price
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.refillTwoWeekPrice}
                                    onChange={(event) => updateDraft(draft.key, { refillTwoWeekPrice: event.target.value })}
                                    placeholder="Price TBD"
                                />
                            </label>
                            <label>
                                3-week refill price
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.refillThreeWeekPrice}
                                    onChange={(event) => updateDraft(draft.key, { refillThreeWeekPrice: event.target.value })}
                                    placeholder="Price TBD"
                                />
                            </label>
                            <label>
                                Full set duration (minutes)
                                <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={draft.fullSetDuration}
                                    onChange={(event) => updateDraft(draft.key, { fullSetDuration: event.target.value })}
                                />
                            </label>
                            <label>
                                Refill duration (minutes)
                                <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={draft.refillDuration}
                                    onChange={(event) => updateDraft(draft.key, { refillDuration: event.target.value })}
                                />
                            </label>
                            <label className="service-description-field">
                                Description
                                <textarea
                                    rows="3"
                                    value={draft.description}
                                    onChange={(event) => updateDraft(draft.key, { description: event.target.value })}
                                />
                            </label>
                        </div>

                        <fieldset className="service-images-field">
                            <legend>Service photos</legend>
                            <div className="service-image-library">
                                <p>Select existing LashSet photos</p>
                                <div className="service-image-library-options">
                                    {AVAILABLE_LASH_IMAGES.map((image) => (
                                        <label key={image.name}>
                                            <input
                                                type="checkbox"
                                                checked={draft.imageUrls.includes(image.url)}
                                                onChange={(event) => updateDraft(draft.key, {
                                                    imageUrls: event.target.checked
                                                        ? [...draft.imageUrls, image.url]
                                                        : draft.imageUrls.filter((url) => url !== image.url)
                                                })}
                                            />
                                            {image.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="service-image-previews">
                                {draft.imageUrls.map((image) => (
                                    <div className="service-image-preview" key={image}>
                                        <img src={getServiceImageSource(image)} alt={`${draft.name || 'Service'} preview`} />
                                        <button
                                            type="button"
                                            className="small-button"
                                            onClick={() => updateDraft(draft.key, {
                                                imageUrls: draft.imageUrls.filter((item) => item !== image)
                                            })}
                                        >
                                            Remove photo
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <label className="service-image-upload">
                                Upload photos
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    disabled={!isSupabaseConfigured || uploadingKey === draft.key}
                                    onChange={(event) => {
                                        uploadImages(draft, Array.from(event.target.files ?? []));
                                        event.target.value = '';
                                    }}
                                />
                            </label>
                            {uploadingKey === draft.key && <span role="status">Uploading photos…</span>}
                        </fieldset>

                        <button
                            type="submit"
                            className="btn service-save-button"
                            disabled={!isSupabaseConfigured || savingKey === draft.key || uploadingKey === draft.key}
                        >
                            {savingKey === draft.key ? 'Saving…' : 'Save service'}
                        </button>
                    </form>
                ))}
            </div>
        </section>
    );
}
