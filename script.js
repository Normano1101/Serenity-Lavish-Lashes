document.addEventListener('DOMContentLoaded', () => {
    const navbarContainer = document.getElementById('navbar');

    if (navbarContainer) {
        fetch('navbar.html')
            .then((response) => response.text())
            .then((html) => {
                navbarContainer.innerHTML = html;

                const moreBtn = document.getElementById('moreBtn');
                const dropdownMenu = document.getElementById('dropdownMenu');

                if (moreBtn && dropdownMenu) {
                    moreBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        const isOpen = dropdownMenu.classList.toggle('show');
                        moreBtn.setAttribute('aria-expanded', String(isOpen));
                    });

                    document.addEventListener('click', (event) => {
                        if (!moreBtn.contains(event.target) && !dropdownMenu.contains(event.target)) {
                            dropdownMenu.classList.remove('show');
                            moreBtn.setAttribute('aria-expanded', 'false');
                        }
                    });
                }

                const currentPage = window.location.pathname.split('/').pop() || 'index.html';

                document.querySelectorAll('.nav-links a[href]').forEach((link) => {
                    const href = link.getAttribute('href');
                    if (href && href === currentPage) {
                        link.classList.add('active');
                    }
                });
            })
            .catch((error) => {
                console.error('Could not load navbar:', error);
            });
    }

    const slides = Array.from(document.querySelectorAll('.slide'));

    if (slides.length > 1) {
        let currentIndex = 0;

        setInterval(() => {
            currentIndex = (currentIndex + 1) % slides.length;

            slides.forEach((slide, index) => {
                slide.classList.toggle('active', index === currentIndex);
            });
        }, 3000);
    }
});