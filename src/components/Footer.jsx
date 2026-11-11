import { FaInstagram } from 'react-icons/fa';

// The bottom of every public page: the Instagram link and copyright line.
export default function Footer() {
    return (
        <footer className="footer">
            <a
                href="https://www.instagram.com/serenity_lavishlashes"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit our Instagram"
                className="instagram-link"
            >
                <FaInstagram size={32} aria-hidden="true" />
                <p>Check out my Instagram</p>
            </a>

            <p>All content Copyright © 2026 Serenity Lavish Lashes</p>
        </footer>
    );
}
