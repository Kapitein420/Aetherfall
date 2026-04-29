export function assetUrl(pathFromAssets) {
  return new URL(`../../assets/${pathFromAssets}`, import.meta.url).href;
}
