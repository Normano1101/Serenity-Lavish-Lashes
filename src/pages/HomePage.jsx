import { Link } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import HomeSlideshow from '../components/HomeSlideshow.jsx';

export default function HomePage() {
    return (
        <>
            <section className="hero">
                <div className="hero-content">
                    <h1>Luxury Lash Extensions</h1>
                    <p>Enhance your natural beauty with lashes designed just for you.</p>
                    <Link to="/booking" className="btn">Book Your Appointment</Link>
                </div>
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
            <Footer />
        </>
    );
}
