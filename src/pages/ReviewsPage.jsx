// The reviews page. Only the introduction exists so far; reviews can be added below the header.
import PageHeader from '../components/PageHeader.jsx';

export default function ReviewsPage() {
    return (
        <main className="site-page reviews-page">
            <PageHeader
                title="See What My Clients Are Saying!"
                subtitle="Hear from real clients about their experiences and results. I take pride in providing quality lash services, and nothing makes me happier than seeing my clients love their lashes! Check out their reviews below."
            />
        </main>
    );
}
