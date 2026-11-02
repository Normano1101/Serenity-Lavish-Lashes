import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AdminRoute from './auth/AdminRoute.jsx';
import Navbar from './components/Navbar.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
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
    '/admin': 'Appointment Dashboard | Serenity Lavish Lashes',
    '/admin/login': 'Admin Sign In | Serenity Lavish Lashes'
};

// Keep page titles and top-level route selection in one place.
export default function App() {
    const { pathname } = useLocation();

    useEffect(() => {
        document.title = pageTitles[pathname] ?? pageTitles['/'];
    }, [pathname]);

    return (
        <>
            <Navbar />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/booking" element={<BookingPage />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/*" element={<AdminDashboard />} />
                </Route>
                <Route path="/reviews" element={<ReviewsPage />} />
                {/* Keep the old URL working while directing visitors to the active booking page. */}
                <Route path="/book" element={<Navigate to="/booking" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
}
