import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

// Render the site links and keep the More menu closed after navigation or outside clicks.
export default function Navbar() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const location = useLocation();

    useEffect(() => {
        setDropdownOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!dropdownOpen) return undefined;

        const closeOnOutsideClick = (event) => {
            if (!dropdownRef.current?.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('click', closeOnOutsideClick);
        return () => document.removeEventListener('click', closeOnOutsideClick);
    }, [dropdownOpen]);

    const activeClass = ({ isActive }) => (isActive ? 'active' : undefined);

    return (
        <nav className="navbar">
            <Link to="/" className="logo">Serenity Lavish Lashes</Link>
            <ul className="nav-links">
                <li><NavLink to="/about" className={activeClass}>About</NavLink></li>
                <li><NavLink to="/portfolio" className={activeClass}>Portfolio</NavLink></li>
                <li><NavLink to="/pricing" className={activeClass}>Pricing</NavLink></li>
                <li><NavLink to="/booking" className={activeClass}>Book</NavLink></li>
                <li><NavLink to="/reviews" className={activeClass}>Reviews</NavLink></li>
                <li className="dropdown" ref={dropdownRef}>
                    <a
                        href="#"
                        aria-expanded={dropdownOpen}
                        aria-controls="dropdownMenu"
                        onClick={(event) => {
                            event.preventDefault();
                            setDropdownOpen((open) => !open);
                        }}
                    >
                        More ▼
                    </a>
                    <ul id="dropdownMenu" className={`dropdown-menu${dropdownOpen ? ' show' : ''}`}>
                        <li><NavLink to="/about" className={activeClass}>Contact</NavLink></li>
                        <li><NavLink to="/" end className={activeClass}>Blog</NavLink></li>
                    </ul>
                </li>
            </ul>
        </nav>
    );
}
