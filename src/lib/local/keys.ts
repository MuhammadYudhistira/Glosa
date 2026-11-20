/**
 * Where a member's data lives on this device besides IndexedDB "glosa". The
 * cover cache name is repeated in pwa/sw.template.js.
 */
export const USER_KEY = "glosa:user"
export const READER_SETTINGS_KEY = "glosa:reader-settings"
export const QUOTE_CARD_KEY = "glosa:quote-card"
export const HABIT_TOAST_KEY = "glosa:habit-toast"
export const RECAP_BUBBLE_KEY = "glosa:recap-bubble"
export const COVER_CACHE = "glosa-covers"
/** The total of the saved words' meetings when Kosakata was last opened (spec 3F §3.6). */
export const VOCAB_SEEN_KEY = "glosa:vocab-seen"
/** What the room showed when the member last saw it on this device (spec 3F §4A.2). */
export const ROOM_SEEN_KEY = "glosa:room-seen"
/** Set once the lobby's "tap a thing to see its name" line has been shown on this device (spec 3G §3.4). */
export const PLACE_HINT_KEY = "glosa:place-hint-seen"
