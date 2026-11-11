// Holds editable copies ("drafts") of database rows for the admin forms. Rows reload whenever
// anything changes in the database, so this keeps unsaved edits from being overwritten.
import { useEffect, useState } from 'react';

// rows: data from the database. toDrafts: turns those rows into drafts, each with a unique `key`.
export default function useDrafts(rows, toDrafts) {
    const [drafts, setDrafts] = useState([]);
    // The keys of drafts with unsaved edits.
    const [dirtyKeys, setDirtyKeys] = useState(() => new Set());

    const markDirty = (key) => setDirtyKeys((current) => new Set(current).add(key));

    // Refresh from the database, but keep anything the admin is still editing.
    useEffect(() => {
        const savedDrafts = toDrafts(rows);
        setDrafts((current) => {
            const refreshed = savedDrafts.map((draft) =>
                dirtyKeys.has(draft.key) ? current.find((item) => item.key === draft.key) ?? draft : draft
            );
            const unsavedNew = current.filter((draft) =>
                dirtyKeys.has(draft.key) && !savedDrafts.some((saved) => saved.key === draft.key)
            );
            return [...refreshed, ...unsavedNew];
        });
    }, [dirtyKeys, rows, toDrafts]);

    const addDraft = (draft) => {
        setDrafts((current) => [...current, draft]);
        markDirty(draft.key);
    };

    // Change some fields of one draft and leave the others alone.
    const updateDraft = (key, updates) => {
        markDirty(key);
        setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...updates } : draft)));
    };

    // Forget a draft after it's saved or deleted. The next refresh brings back the saved version.
    const removeDraft = (key) => {
        setDrafts((current) => current.filter((draft) => draft.key !== key));
        setDirtyKeys((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
        });
    };

    return { drafts, addDraft, updateDraft, removeDraft };
}
