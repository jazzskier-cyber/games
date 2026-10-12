export type Difficulty = 'E' | 'M' | 'H';
// Preserve the complete 21-stage sequence confirmed by the user.
export const REQUESTED_PATTERN = 'EEMMEMHEMMEHEMMHEHMEM';
export const STAGE_COUNT = 21;
export const DIFFICULTY_PATTERN = REQUESTED_PATTERN.slice(0, STAGE_COUNT);
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { E: '简单', M: '中等', H: '困难' };
const names = ['风起的地方', '蒲公英邮局', '苔石小径', '蘑菇转角', '午睡的草甸', '溪云石桥', '逆风山脊', '蜂蜜晴空', '藤蔓阶梯', '雾中花径', '棉花糖山谷', '追风峡口', '落日野餐', '星屑石林', '萤火回廊', '高空回旋', '月光花圃', '云海试炼', '晨露之巅', '春天的来信', '花园的回声'];
export type RouteStyle = 'zigzag' | 'crescent' | 'switchback' | 'spiral' | 'stepping' | 'drift' | 'cloud-hop';
export type Gimmick = 'bounce' | 'drift' | 'crumble' | 'meteor' | 'wind' | 'calm';
const gimmicks: Gimmick[] = ['calm','drift','calm','bounce','crumble','meteor','wind','drift','bounce','crumble','calm','meteor','calm','drift','bounce','meteor','crumble','drift','meteor','bounce','meteor'];
const routeStyles: RouteStyle[] = ['zigzag', 'crescent', 'switchback', 'spiral', 'stepping', 'drift', 'cloud-hop'];
const biomes = [
  { name: '微风草甸', color: 0xf5f4e7, platform: 0xf4f2df, flower: 0xffdfb1, mote: 0xfff1bd },
  { name: '蒲公英邮路', color: 0xffeedb, platform: 0xf1e6cb, flower: 0xffce80, mote: 0xffedb1 },
  { name: '月白苔径', color: 0xe7efdf, platform: 0xdce8d1, flower: 0xd6c8ed, mote: 0xe9f4c7 },
  { name: '蘑菇暮庭', color: 0xf2e2df, platform: 0xead8d2, flower: 0xeab1a8, mote: 0xffd9c8 },
  { name: '午睡草甸', color: 0xfaf1d4, platform: 0xede6c6, flower: 0xffdc8b, mote: 0xffe6a6 },
  { name: '溪云石桥', color: 0xe1efec, platform: 0xd2e5df, flower: 0xb9dcd0, mote: 0xc7f0df },
  { name: '逆风山脊', color: 0xe0e6f4, platform: 0xd0d9eb, flower: 0xc5c9ef, mote: 0xd5e5ff },
  { name: '蜂蜜晴空', color: 0xf7ead1, platform: 0xeee0bd, flower: 0xffcf72, mote: 0xffdf9c },
  { name: '藤蔓云梯', color: 0xe0eddd, platform: 0xd1e0ca, flower: 0xd6b8df, mote: 0xd5efbd },
  { name: '雾中花径', color: 0xe8edf1, platform: 0xd9e2e8, flower: 0xe0bddb, mote: 0xe5f1f4 },
  { name: '棉花糖谷', color: 0xf4e4ec, platform: 0xe8dbe7, flower: 0xf0b9d0, mote: 0xffd9e9 },
  { name: '追风峡口', color: 0xe0e2f0, platform: 0xd2d6e7, flower: 0xd2b8e8, mote: 0xe0defb },
  { name: '落日野餐', color: 0xf8e3d2, platform: 0xedd9c6, flower: 0xf2b783, mote: 0xffd7a4 },
  { name: '星屑石林', color: 0xe6e1f4, platform: 0xd9d4eb, flower: 0xc8b7ea, mote: 0xe7d8ff },
  { name: '萤火回廊', color: 0xe0eee7, platform: 0xd0e2d8, flower: 0xe7c77e, mote: 0xe9efaa },
  { name: '高空回旋', color: 0xddebf1, platform: 0xd0e1e7, flower: 0xb4d8e5, mote: 0xc4eaf6 },
  { name: '月光花圃', color: 0xe8e8f3, platform: 0xdadceb, flower: 0xd9c8ef, mote: 0xe7e6ff },
  { name: '云海试炼', color: 0xe8e0f0, platform: 0xdcd2e6, flower: 0xe4bada, mote: 0xf2d5f0 },
  { name: '晨露之巅', color: 0xdff0e3, platform: 0xcfe2d2, flower: 0xffd79c, mote: 0xe3f6bd },
  { name: '春日来信', color: 0xf7e6dc, platform: 0xead8cb, flower: 0xf3b5ad, mote: 0xffd8bc },
  { name: '花园回声', color: 0xf5edcf, platform: 0xeae1bd, flower: 0xf3c768, mote: 0xffedaa },
];
const settings = {
  E: { islands: 10, step: 90, width: 260, enemySpeed: .8, wind: 0, bonus: 500 },
  M: { islands: 12, step: 96, width: 200, enemySpeed: 1.15, wind: 0, bonus: 700 },
  H: { islands: 14, step: 102, width: 155, enemySpeed: 1.5, wind: 28, bonus: 1000 },
};
export const STAGES = [...DIFFICULTY_PATTERN].map((value, i) => {
  const difficulty = value as Difficulty, tuning = settings[difficulty];
  const meteorInterval = ({ 6: 12, 12: 10, 16: 8, 19: 11, 21: 9 } as Record<number, number>)[i + 1] ?? null;
  return { ...tuning, number: i + 1, name: names[i], difficulty, route: routeStyles[i % routeStyles.length], gimmick: gimmicks[i], meteorInterval, floor: tuning.islands * tuning.step + 420, biome: biomes[i] };
});
export type Stage = (typeof STAGES)[number];
export function getStage(number: number) { return STAGES[Math.max(0, Math.min(STAGES.length - 1, Math.floor(number) - 1))] ?? STAGES[0]; }
export function nextStage(number: number): number | null { return number < STAGES.length ? number + 1 : null; }
export interface Campaign { selected: number; scores: Record<string, number> }
export function readCampaign(raw: string | null): Campaign {
  const fresh: Campaign = { selected: 1, scores: {} };
  if (!raw) return fresh;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fresh;
    const data = parsed as { selected?: unknown; scores?: unknown };
    const selected = typeof data.selected === 'number' && Number.isInteger(data.selected) ? getStage(data.selected).number : 1;
    const scores: Record<string, number> = {};
    if (data.scores && typeof data.scores === 'object') for (const stage of STAGES) {
      const score = (data.scores as Record<string, unknown>)[String(stage.number)];
      if (typeof score === 'number' && Number.isFinite(score) && score >= 0) scores[stage.number] = Math.floor(score);
    }
    return { selected, scores };
  } catch { return fresh; }
}
export function completeStage(campaign: Campaign, number: number, score: number): Campaign {
  return { selected: nextStage(number) ?? number, scores: { ...campaign.scores, [number]: Math.max(campaign.scores[number] ?? 0, score) } };
}
