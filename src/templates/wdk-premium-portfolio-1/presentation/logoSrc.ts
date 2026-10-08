/** Empty logo text must not become an image request. */
export function portfolioLogoSrc(logo: string): string | null {
  const trimmed = logo.trim();
  return trimmed ? trimmed : null;
}
