/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_PORTFOLIO_PUBLIC_ORIGIN?: string;
  /** BroadBrand support WhatsApp number: digits with country code, or E.164. Empty hides Contact Support. */
  readonly VITE_BROADBRAND_SUPPORT_WHATSAPP?: string;
  /** `browser` (default) or `legacy`. Read at build time. */
  readonly VITE_IMAGE_COMPRESSION_BACKEND?: string;
  /** `1` prints image upload timings. Unset or `0` keeps production quiet. */
  readonly VITE_IMAGE_UPLOAD_DEBUG?: string;
  /**
   * `firebase` (default) or `imagekit`. Read at build time.
   * Portfolio uploads stay on Firebase until a later step turns ImageKit on.
   */
  readonly VITE_IMAGE_STORAGE_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
