// --- Hamburger Menu Logic ---
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const navMenu = document.getElementById('nav-menu');

    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', () => {
            const isVisible = navMenu.classList.toggle('active');
            hamburgerBtn.setAttribute('aria-expanded', isVisible);
        });
    }
});
