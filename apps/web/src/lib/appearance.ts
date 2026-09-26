/**
 * System, Light or Dark, chosen per browser in the profile menu.
 *
 * The choice lives in localStorage rather than a cookie: the server would have
 * to read a cookie in the root layout, and that makes every page dynamic.
 * Instead APPEARANCE_SCRIPT reads it in <head> and marks <html> before the
 * first paint, and globals.css does the rest. No mark means System.
 */
export const APPEARANCE_KEY = 'samudaya-theme';

export const APPEARANCE_SCRIPT = `try{const t=localStorage.getItem('${APPEARANCE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`;
