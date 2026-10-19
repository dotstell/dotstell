/**
 * Where the dictation bar is on screen, shared so the note can keep the text being dictated clear of it. The bar sets
 * `rect` (viewport coordinates) while it is shown and clears it when it closes.
 */
export const dictationLayout: { rect: { top: number; bottom: number } | null } = { rect: null }
