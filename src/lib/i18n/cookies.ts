/**
 * Cookie names for the display preferences.
 *
 * They live here, outside the 'use client' context module, because a server
 * component that imports a value from a client module gets a client reference
 * rather than the string itself — which silently turns cookies().get(NAME) into
 * undefined and made every page fall back to Bangla and the light theme.
 */
export const COOKIE_LANG_KEY = 'app_lang';
export const COOKIE_DIGIT_KEY = 'app_digit_style';
export const COOKIE_THEME_KEY = 'app_theme';
