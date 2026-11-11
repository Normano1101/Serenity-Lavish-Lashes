// The home page: a booking button, the photo slideshow, and a link to the portfolio.
import { Link } from 'react-router-dom';
import HomeSlideshow from '../components/HomeSlideshow.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function HomePage() {
    return (
        <main className="site-page">
            <PageHeader
                title="Luxury Lash Extensions"
                subtitle="Enhance your natural beauty with lashes designed just for you."
            >
                <Link to="/booking" className="page-header-action">Book Your Appointment</Link>
            </PageHeader>
            <section className="hero">
                <HomeSlideshow />
            </section>

            <section className="welcome">
                <h2>Welcome to Serenity Lavish Lashes</h2>
                <p>
                    Discover beautiful lash extensions created to enhance your natural
                    features and give you a look you&apos;ll love.
                </p>
                <Link to="/portfolio" className="btn">View My Work</Link>
            </section>
        </main>
    );
}
