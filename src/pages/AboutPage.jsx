// The about page: a photo and a short bio of the lash artist.
import PageHeader from '../components/PageHeader.jsx';

export default function AboutPage() {
    return (
        <main className="site-page">
            <PageHeader title="About Me" />
            <div className="about-page">
                <img className="about-photo" src="/assets/Pictures/About.JPG" alt="Serenity Lavish Lashes owner" />
                <section className="about-content">
                    <p>
                        Ever since I was young, I’ve been fascinated by the beauty of eyelashes and how
                        they enhance a person’s look. In 2023, I became a licensed lash technician, turning
                        my passion into a career dedicated to making clients feel confident and beautiful.
                        I specialize in classic, wet, volume, hybrid, and wispy lash sets, customizing each
                        look to complement my clients&apos; unique features. With a strong attention to detail,
                        I ensure every set is flawless while providing a comfortable and relaxing experience.
                        I love meeting new clients, personalizing each visit to match their aesthetic, and
                        creating a welcoming space for everyone, regardless of background or gender. Outside
                        of lashing, I’m a big animal lover—especially when it comes to dogs! I look forward to
                        enhancing your lashes and giving you a confidence boost with every blink.
                    </p>
                </section>
            </div>
        </main>
    );
}
