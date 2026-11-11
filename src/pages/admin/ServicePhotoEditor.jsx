// Choose a lash set's photos: pick from existing ones, upload new ones, and set the order.
// The first photo in the list is the "primary" one customers see first.
import { getLashPhotoCategory, getServiceImageSource, LASH_PHOTO_CATEGORIES } from '../../data/services.js';

export default function ServicePhotoEditor({ draft, photoCategory, onCategoryChange, onChange, onUpload, uploading }) {
    const images = draft.imageUrls;
    const category = photoCategory ?? getLashPhotoCategory(draft.name);
    const categoryImages = LASH_PHOTO_CATEGORIES.find((item) => item.name === category)?.images ?? [];

    const updateImages = (imageUrls) => onChange(draft.key, { imageUrls });
    const removeImage = (url) => updateImages(images.filter((item) => item !== url));

    // Swap a photo with its neighbour. direction is -1 for earlier or 1 for later.
    const moveImage = (index, direction) => {
        const next = [...images];
        const target = index + direction;
        [next[index], next[target]] = [next[target], next[index]];
        updateImages(next);
    };

    return (
        <fieldset className="service-images-field">
            <legend>Service photos</legend>

            {/* Photos already on the site */}
            <div className="service-image-library">
                <label className="service-photo-category">
                    Select lash set
                    <select value={category} onChange={(event) => onCategoryChange(draft.key, event.target.value)}>
                        {LASH_PHOTO_CATEGORIES.map((item) => (
                            <option value={item.name} key={item.name}>{item.name}</option>
                        ))}
                    </select>
                </label>
                <div className="service-image-library-grid">
                    {categoryImages.map((image) => {
                        const selected = images.includes(image.url);
                        return (
                            <label className={`service-image-option${selected ? ' service-image-option-selected' : ''}`} key={image.url}>
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={(event) => (event.target.checked ? updateImages([...images, image.url]) : removeImage(image.url))}
                                />
                                <img src={image.url} alt="" loading="lazy" />
                                <span>{image.label}</span>
                                {images[0] === image.url && <strong>Primary</strong>}
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

            {/* The photos chosen for this lash set, in order */}
            <div className="service-image-previews">
                <h4>Selected photos · first photo is shown as primary</h4>
                {images.length === 0 && <p>No photos selected yet.</p>}
                {images.map((image, index) => (
                    <div className="service-image-preview" key={image}>
                        <img src={getServiceImageSource(image)} alt={`${draft.name || 'Service'} preview ${index + 1}`} />
                        <span>{index === 0 ? 'Primary photo' : `Photo ${index + 1}`}</span>
                        <div className="service-image-preview-actions">
                            <button
                                type="button"
                                className="small-button"
                                disabled={index === 0}
                                onClick={() => updateImages([image, ...images.filter((item) => item !== image)])}
                            >
                                Make primary
                            </button>
                            <button type="button" className="small-button" disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => moveImage(index, -1)}>
                                Move left
                            </button>
                            <button type="button" className="small-button" disabled={index === images.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => moveImage(index, 1)}>
                                Move right
                            </button>
                            <button type="button" className="small-button" onClick={() => removeImage(image)}>
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
                    disabled={uploading}
                    onChange={(event) => {
                        onUpload(draft, Array.from(event.target.files ?? []));
                        // Reset the input so choosing the same file again still works.
                        event.target.value = '';
                    }}
                />
            </label>
            {uploading && <span role="status">Uploading photos…</span>}
        </fieldset>
    );
}
