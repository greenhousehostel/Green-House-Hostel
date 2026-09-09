/**
 * Green House Hostel - Theme Manager (theme-factory)
 * Handles light and dark mode state persistence and UI sync
 */
(function() {
    const THEME_STORAGE_KEY = 'ghh_theme';

    function getInitialTheme() {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (document.body) document.body.classList.add('dark-theme');
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (document.body) document.body.classList.remove('dark-theme');
        }
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        updateToggleIcons(theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    }

    function updateToggleIcons(theme) {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            const isDark = (theme === 'dark');
            const iconName = isDark ? 'sun' : 'moon';
            const label = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
            btn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 pointer-events-none"></i>`;
        });
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Apply immediately to prevent FOUC
    const initialTheme = getInitialTheme();
    if (initialTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(getInitialTheme());
        
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', toggleTheme);
        });
    });

    window.ghhToggleTheme = toggleTheme;
})();
