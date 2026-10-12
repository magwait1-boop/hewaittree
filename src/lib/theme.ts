export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'huwait-theme:v1';

// Runs in <head> before the page paints, so a saved light theme never flashes dark.
export const themeInitializationScript = `(function(){var theme='dark';try{var saved=localStorage.getItem('${THEME_STORAGE_KEY}');if(saved==='light'||saved==='dark')theme=saved;}catch(_){}document.documentElement.dataset.theme=theme;document.documentElement.classList.toggle('dark',theme==='dark');})();`;
