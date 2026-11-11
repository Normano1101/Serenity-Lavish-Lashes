// Small helpers used all over the site.

// Join CSS class names and skip empty ones: classNames('a', false, 'b') gives 'a b'.
export function classNames(...names) {
    return names.filter(Boolean).join(' ');
}

// Add an "s" when needed: plural(1, 'rule') gives 'rule', plural(2, 'rule') gives 'rules'.
export function plural(count, word) {
    return count === 1 ? word : `${word}s`;
}

// 'today' becomes 'Today'.
export function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
