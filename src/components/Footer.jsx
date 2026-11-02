import { FaInstagram } from 'react-icons/fa';

// Show the studio's social link and the supplied (or default) copyright text.
export default function Footer({ copyright = 'All content Copyright © 2026 Serenity Lavish Lashes' }) {
    return (
        <footer className="footer">
            <a
                href="https://www.instagram.com/serenity_lavishlashes"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit our Instagram"
                className="instagram-link"
            >
                <FaInstagram size={56} />
                <p>Check out my Instagram</p>
            </a>

            <p>{copyright}</p>
        </footer>
    );
}