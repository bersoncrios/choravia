export type DailyContractType =
  | "resolve-encounter"
  | "move-in-battle"
  | "defend-in-battle"
  | "basic-attack";

export interface DailyContract {
  readonly id: DailyContractType;
  readonly title: string;
  readonly description: string;
  readonly rewardSeeds: number;
  readonly progress: number;
  readonly target: 1;
  readonly completed: boolean;
}

export type DailyCosmeticId = "forest-cloak" | "sun-scarf" | "moon-pin";

export interface DailyReward {
  readonly receiptId: string;
  readonly seeds: number;
  readonly itemId?: DailyCosmeticId;
  readonly fallbackSeeds?: number;
}

export interface DailyBoard {
  readonly cycleId: string;
  readonly resetAt: number;
  readonly contracts: readonly DailyContract[];
  readonly completionBonusSeeds: number;
  readonly completionBonusEarned: boolean;
  readonly weekly: {
    readonly qualifiedDays: number;
    readonly requiredDays: 4;
    readonly completed: boolean;
    readonly rewardItemId: DailyCosmeticId | null;
  };
  readonly pendingRewards: readonly DailyReward[];
}

interface DailyTemplate extends Omit<DailyContract, "progress" | "completed"> {}

const REQUIRED_CONTRACT: DailyTemplate = {
  id: "resolve-encounter",
  title: "Encontro concluído",
  description: "Conclua um encontro ou duelo na sua expedição.",
  rewardSeeds: 12,
  target: 1,
};
const TACTICAL_TEMPLATES: readonly DailyTemplate[] = [
  {
    id: "move-in-battle",
    title: "Use sua estratégia",
    description: "Use uma habilidade elemental em batalha clássica ou mova seu Eco em batalha tática salva.",
    rewardSeeds: 6,
    target: 1,
  },
  {
    id: "defend-in-battle",
    title: "Leia o adversário",
    description: "Use Defender uma vez durante uma batalha.",
    rewardSeeds: 8,
    target: 1,
  },
  {
    id: "basic-attack",
    title: "Treino de precisão",
    description: "Use um ataque básico em uma batalha.",
    rewardSeeds: 8,
    target: 1,
  },
];
export const DAILY_COMPLETION_BONUS = 8;
export const WEEKLY_COSMETICS: readonly DailyCosmeticId[] = [
  "forest-cloak",
  "sun-scarf",
  "moon-pin",
];

export function dailyTemplates(seed: number): readonly DailyTemplate[] {
  let state = seed >>> 0 || 1;
  const random = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const tactics = [...TACTICAL_TEMPLATES];
  for (let index = tactics.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [tactics[index], tactics[target]] = [tactics[target]!, tactics[index]!];
  }
  return [REQUIRED_CONTRACT, tactics[0]!, tactics[1]!];
}

export function progressContract(
  contract: DailyContract,
  progress: number,
): DailyContract {
  const nextProgress = Math.min(contract.target, contract.progress + progress);
  return {
    ...contract,
    progress: nextProgress,
    completed: nextProgress >= contract.target,
  };
}
