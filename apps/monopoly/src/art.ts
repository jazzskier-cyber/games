const paths: Record<string, string> = {
  house: '<path d="M3 11 12 4l9 7M5 10v11h14V10M10 21v-7h4v7"/><path d="M8 11h1m6 0h1"/>',
  flag: '<path d="M6 22V3m0 1h13l-3 4 3 4H6M3 22h8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  tree: '<path d="m12 2-6 8h3l-5 7h16l-5-7h3L12 2Zm0 15v5m-4 0h8"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-5a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9m3-10v12"/>',
  shop: '<path d="M4 10v11h16V10M3 4h18l1 6H2l1-6Zm6 17v-7h6v7M7 4l-1 6m6-6v6m5-6 1 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  flower: '<path d="M12 15v7m0-3 5-2M12 9C5-2 0 11 9 12c-8 8 5 13 5 3 9 6 13-7 3-6 3-10-9-10-5 0Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
export function icon(name: string, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.house}</svg>`; }
const TILE_SPRITES = [12, 0, 1, 13, 2, 3, 15, 4, 14, 5, 13, 6, 15, 7, 8, 13, 9, 14, 15, 10, 13, 11, 13, 15];
export function spriteArt(index: number, cls = '') {
  const col = index % 4, row = Math.floor(index / 4);
  return `<span class="sprite-art ${cls}" style="background-position:${col * 100 / 3}% ${row * 100 / 3}%" aria-hidden="true"></span>`;
}
export function tileArt(index: number, cls = '') { return spriteArt(TILE_SPRITES[index], cls); }
export function cityArt() {
  return `<div class="city-art" role="img" aria-label="Bright toy skyscrapers, a shopping mall and a luxury hotel"><span class="city-orbit orbit-one"></span><span class="city-orbit orbit-two"></span>${spriteArt(9, 'skyline skyline-left')}${spriteArt(11, 'skyline skyline-center')}${spriteArt(10, 'skyline skyline-right')}<span class="floating-coin coin-one">$</span><span class="floating-coin coin-two">$</span><span class="city-star">✦</span></div>`;
}
