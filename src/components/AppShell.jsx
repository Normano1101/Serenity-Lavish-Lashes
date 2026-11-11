import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';

// Lay out a page as the branded sidebar plus a workspace column. Pages supply their own <main>.
// On phones the sidebar collapses into a top bar with a menu button that reveals the nav and footer.
export default function AppShell({ role, navLabel, nav, footer, children }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname, hash } = useLocation();

    // Close the phone menu whenever the page or section changes.
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname, hash]);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);

    // Choosing any link or button in the menu closes it (admin links only change the hash).
    const closeOnChoice = (event) => {
        if (event.target.closest('a, button')) setMenuOpen(false);
    };

    return (
        <div className="app-shell">
            <aside className={`app-sidebar${menuOpen ? ' is-menu-open' : ''}`}>
                <Link to="/" className="app-brand">
                    <span>Serenity</span>
                    <strong>Lavish Lashes</strong>
                </Link>
                <button
                    type="button"
                    className="app-menu-toggle"
                    aria-expanded={menuOpen}
                    aria-controls="app-sidebar-menu"
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    {menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
                </button>
                <div className="app-sidebar-menu" id="app-sidebar-menu" onClick={closeOnChoice}>
                    {role && <span className="app-sidebar-role">{role}</span>}
                    <nav className="app-side-nav" aria-label={navLabel}>{nav}</nav>
                    {footer && <div className="app-sidebar-footer">{footer}</div>}
                </div>
            </aside>
            <div className="app-main">{children}</div>
        </div>
    );
}
