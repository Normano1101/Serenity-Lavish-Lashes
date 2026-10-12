import { Link } from 'react-router-dom';
import portfolioPhotos from '../data/portfolioPhotos.js';
import Footer from '../components/Footer.jsx';
import PortfolioSlideshow from '../components/PortfolioSlideshow.jsx';

export default function PortfolioPage() {
    return (
        <>
            <main>
                <section className="portfolio-intro">
                    <h1>Welcome to My Lash Portfolio!</h1>
                    <p>
                        Here, you can explore the variety of eyelash styles I&apos;ve created
                        for my amazing clients. From natural looks to bold, voluminous
                        lashes, each set is tailored to highlight unique features and
                        enhance natural beauty. Browse through my work and get inspired
                        for your next lash transformation!
                    </p>
                </section>
                <PortfolioSlideshow />
                
                
            </main>
            <Footer />
        </>
    );
}
