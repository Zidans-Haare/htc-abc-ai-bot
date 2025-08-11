// Universal theme-aware logo switcher
// This script can be included on any page to handle logo switching

function updateLogosForTheme(isDarkMode) {
    // Update HTW logos (find both SVG and PNG versions)
    const htwLogos = document.querySelectorAll('img[src*="HTW.svg"], img[src*="HTW_hell.png"], img[alt*="HTW"], img[alt*="HTWD"]');
    htwLogos.forEach(logo => {
        if (isDarkMode) {
            logo.src = '/image/HTW_hell.png';
        } else {
            logo.src = '/image/HTW.svg';
        }
    });
    
    // Update FarantoStura background images in CSS
    const root = document.documentElement;
    if (isDarkMode) {
        root.style.setProperty('--faranto-stura-bg', 'url("/image/FarantoStura_hell.png")');
    } else {
        root.style.setProperty('--faranto-stura-bg', 'url("/image/FarantoStura.png")');
    }
}

// Function to check current theme and update logos
function initThemeLogos() {
    const root = document.documentElement;
    const isDarkMode = root.classList.contains('dark-mode') || 
                      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    updateLogosForTheme(isDarkMode);
    
    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const isDarkMode = root.classList.contains('dark-mode');
                updateLogosForTheme(isDarkMode);
            }
        });
    });
    
    observer.observe(root, {
        attributes: true,
        attributeFilter: ['class']
    });
    
    // Also listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only update if not explicitly set to light/dark theme
            if (!root.classList.contains('dark-mode') && !root.dataset.theme) {
                updateLogosForTheme(e.matches);
            }
        });
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeLogos);
} else {
    initThemeLogos();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateLogosForTheme, initThemeLogos };
}