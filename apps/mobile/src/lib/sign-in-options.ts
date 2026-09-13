/**
 * Which sign-in methods the app offers.
 *
 * The pilot uses Google only. Email magic links are switched off here rather
 * than removed: `signInWithEmail` and the auth callback still handle them, so
 * turning this back on is a one-line change. Supabase's Email provider is
 * still enabled server-side.
 */
export const EMAIL_SIGN_IN_ENABLED = false;
