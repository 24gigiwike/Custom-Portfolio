/**
 * Unsplash photographs used only by The Creative.
 * They are direct image URLs, not files copied from another template or from a reference site.
 *
 * Portrait: photo-1506794778202-cad84cf45f1d
 * Projects: photo-1497366216548-37526070297c, photo-1600585154526-990dced4db0d,
 * photo-1618221195710-dd6b41faaea6, photo-1441986300917-64674bd600d8,
 * photo-1498050108023-c5249f4df085, photo-1487958449943-2429e8be8625
 */
const unsplash = (photoId: string, width: number) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=80`;

export const CREATIVE_PORTRAIT = unsplash("photo-1506794778202-cad84cf45f1d", 2000);

export const CREATIVE_PROJECT_IMAGES = [
  unsplash("photo-1497366216548-37526070297c", 2000),
  unsplash("photo-1600585154526-990dced4db0d", 2000),
  unsplash("photo-1618221195710-dd6b41faaea6", 2000),
  unsplash("photo-1441986300917-64674bd600d8", 2000),
  unsplash("photo-1498050108023-c5249f4df085", 2000),
  unsplash("photo-1487958449943-2429e8be8625", 2000),
];

export function creativeProjectImage(image: string, index: number): string {
  const supplied = image.trim();
  if (supplied) return supplied;
  return CREATIVE_PROJECT_IMAGES[index % CREATIVE_PROJECT_IMAGES.length] ?? CREATIVE_PROJECT_IMAGES[0];
}
