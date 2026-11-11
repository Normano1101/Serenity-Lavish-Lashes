// The frame around every public page: sidebar links on the left, the page, then the footer.
import { NavLink, Outlet } from 'react-router-dom';
import { FiCalendar, FiHome, FiImage, FiStar, FiTag, FiUser } from 'react-icons/fi';
import AppShell from './AppShell.jsx';
import Footer from './Footer.jsx';

const NAVIGATION_ITEMS = [
    { label: 'Home', to: '/', icon: FiHome, end: true },
    { label: 'About', to: '/about', icon: FiUser },
    { label: 'Portfolio', to: '/portfolio', icon: FiImage },
    { label: 'Pricing', to: '/pricing', icon: FiTag },
    { label: 'Book', to: '/booking', icon: FiCalendar },
    { label: 'Reviews', to: '/reviews', icon: FiStar }
];

// In App.jsx this wraps the routes (<Outlet /> is the current page). It can also wrap content directly.
export default function SiteLayout({ children }) {
    return (
        <AppShell
            navLabel="Main"
            nav={NAVIGATION_ITEMS.map(({ label, to, icon: Icon, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                </NavLink>
            ))}
        >
            {children ?? <Outlet />}
            <Footer />
        </AppShell>
    );
}
