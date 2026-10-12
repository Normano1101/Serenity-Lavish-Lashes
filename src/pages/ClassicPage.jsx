export default function ClassicPage() {
    return (
        <div style={{ minHeight: '100vh', fontFamily: 'Arial, sans-serif', background: '#fff', color: '#333' }}>
            <nav style={{ background: '#000', color: 'white', padding: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <a href="#" style={{ color: 'white', textDecoration: 'none', marginLeft: 20 }}>Home</a>
                    <a href="#" style={{ color: 'white', textDecoration: 'none', marginLeft: 20 }}>Services</a>
                    <a href="#" style={{ color: 'white', textDecoration: 'none', marginLeft: 20 }}>Book</a>
                    <a href="#" style={{ color: 'white', textDecoration: 'none', marginLeft: 20 }}>Contact</a>
                </div>
            </nav>
            <section style={{ textAlign: 'center', padding: '80px 20px', background: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5))', color: 'white' }}>
                <h1 style={{ fontSize: 40 }}>Luxury Lash Extensions</h1>
                <p>Wake up beautiful every day ✨</p>
                <h2>Ready to Book?</h2>
                <a href="#" style={{ display: 'inline-block', marginTop: 20, padding: '15px 30px', background: 'hotpink', color: 'white', textDecoration: 'none', borderRadius: 5 }}>Book Now</a>
            </section>
            <footer style={{ background: '#000', color: 'white', textAlign: 'center', padding: 20 }}>
                <p>© 2026 Luxe Lashes | Follow med on Instagram</p>
            </footer>
        </div>
    );
}
