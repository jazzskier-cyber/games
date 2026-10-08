export type Difficulty = 'E' | 'M' | 'H';
// Preserve the complete 21-stage sequence confirmed by the user.
export const REQUESTED_PATTERN = 'EEMMEMHEMMEHEMMHEHMEM';
export const STAGE_COUNT = 21;
export const DIFFICULTY_PATTERN = REQUESTED_PATTERN.slice(0, STAGE_COUNT);
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { E: '简单', M: '中等', H: '困难' };
const names = ['风起的地方', '蒲公英邮局', '苔石小径', '蘑菇转角', '午睡的草甸', '溪云石桥', '逆风山脊', '蜂蜜晴空', '藤蔓阶梯', '雾中花径', '棉花糖山谷', '追风峡口', '落日野餐', '星屑石林', '萤火回廊', '高空回旋', '月光花圃', '云海试炼', '晨露之巅', '春天的来信', '花园的回声'];
const biomes = [
  { name: '微风草甸', color: 0xffffff, flower: 0xffdfb1 },
  { name: '蜂蜜溪谷', color: 0xffefd7, flower: 0xffd288 },
  { name: '暮光花径', color: 0xeee3ff, flower: 0xe1c4ed },
  { name: '晨露云海', color: 0xe2f5ef, flower: 0xc4e3dd },
];
const settings = {
  E: { islands: 10, step: 90, width: 260, enemySpeed: .8, wind: 0, bonus: 500 },
  M: { islands: 12, step: 96, width: 200, enemySpeed: 1.15, wind: 0, bonus: 700 },
  H: { islands: 14, step: 102, width: 155, enemySpeed: 1.5, wind: 28, bonus: 1000 },
};
export const STAGES = [...DIFFICULTY_PATTERN].map((value, i) => {
  const difficulty = value as Difficulty, tuning = settings[difficulty];
  return { ...tuning, number: i + 1, name: names[i], difficulty, floor: tuning.islands * tuning.step + 420, biome: biomes[Math.floor(i / 5) % biomes.length] };
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
