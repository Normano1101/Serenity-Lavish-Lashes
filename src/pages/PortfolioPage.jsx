// The portfolio page: an introduction and the photo gallery.
import PageHeader from '../components/PageHeader.jsx';
import PortfolioSlideshow from '../components/PortfolioSlideshow.jsx';

export default function PortfolioPage() {
    return (
        <main className="site-page">
            <PageHeader
                title="Welcome to My Lash Portfolio!"
                subtitle="Here, you can explore the variety of eyelash styles I've created for my amazing clients. From natural looks to bold, voluminous lashes, each set is tailored to highlight unique features and enhance natural beauty. Browse through my work and get inspired for your next lash transformation!"
            />
            <PortfolioSlideshow />
        </main>
    );
}
