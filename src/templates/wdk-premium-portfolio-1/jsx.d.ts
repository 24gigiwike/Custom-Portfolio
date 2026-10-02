/**
 * The host application does not install @types/react.
 * Plain function components would otherwise reject the JSX `key` attribute.
 * This only teaches TypeScript that `key` is a React attribute, not a prop.
 */
export {}

declare global {
    namespace JSX {
        interface IntrinsicAttributes {
            key?: string | number
        }
    }
}
