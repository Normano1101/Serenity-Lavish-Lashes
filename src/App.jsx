import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AdminRoute from './auth/AdminRoute.jsx';
import SiteLayout from './components/SiteLayout.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import BookingPage from './pages/BookingPage.jsx';
import HomePage from './pages/HomePage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import ReviewsPage from './pages/ReviewsPage.jsx';

// Match each main route to the browser-tab title shown for that page.
const pageTitles = {
    '/': 'Serenity Lavish Lashes',
    '/about': 'About | Serenity Lavish Lashes',
    '/portfolio': 'Portfolio | Serenity Lavish Lashes',
    '/pricing': 'Price List | Serenity Lavish Lashes',
    '/booking': 'Book Your Appointment | Serenity Lavish Lashes',
    '/reviews': 'Reviews | Serenity Lavish Lashes',
    '/admin': 'Appointment Calendar | Serenity Lavish Lashes',
    '/admin/login': 'Admin Sign In | Serenity Lavish Lashes'
};

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));

function AdminDashboardPage() {
    return (
        <Suspense fallback={<SiteLayout><main className="admin-auth-page"><p role="status">Loading dashboard…</p></main></SiteLayout>}>
            <AdminDashboard />
        </Suspense>
    );
}

// Keep page titles and top-level route selection in one place.
export default function App() {
    const { pathname } = useLocation();

    useEffect(() => {
        document.title = pageTitles[pathname] ?? pageTitles['/'];
    }, [pathname]);

    return (
        <Routes>
            <Route element={<SiteLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/booking" element={<BookingPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/admin/login" element={<AdminLogin />} />
            </Route>
            {/* The dashboard renders the same shell with its own admin navigation. */}
            <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/*" element={<AdminDashboardPage />} />
            </Route>
            {/* Keep the old URL working while directing visitors to the active booking page. */}
            <Route path="/book" element={<Navigate to="/booking" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
