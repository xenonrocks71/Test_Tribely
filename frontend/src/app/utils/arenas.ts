export interface DiscoveryArena {
  id: number;
  name: string;
  description: string;
  invite_code?: string;
  is_private?: boolean;
  proof_type?: string;
  penalty_amount?: number;
  deadline_time?: string;
  member_count?: number;
}

export interface LandingArena {
  id: number;
  name: string;
  description: string;
  icon: string;
  is_live: boolean;
  member_count: number;
  stake_at_risk: number;
  is_private: boolean;
  proof_type?: string;
  deadline_time?: string;
  avg_streak_days?: number | null;
}

const PROOF_ICONS: Record<string, string> = {
  image: "📸",
  text: "✍️",
  link: "🔗",
};

const NAME_KEYWORDS: [RegExp, string][] = [
  [/5\s*am|early|morning|wake/i, "⏰"],
  [/athletic|workout|fitness|gym|train/i, "🗡️"],
  [/deep\s*work|focus|study/i, "🧠"],
  [/code|leet|dev|program/i, "⌨️"],
  [/read|book/i, "📚"],
  [/meditat|mindful/i, "🧘"],
  [/diet|nutrition|meal/i, "🥗"],
];

export function iconForArena(name: string, proofType?: string): string {
  for (const [pattern, icon] of NAME_KEYWORDS) {
    if (pattern.test(name)) return icon;
  }
  if (proofType && PROOF_ICONS[proofType]) return PROOF_ICONS[proofType];
  return "🎯";
}

export function mapDiscoveryArena(arena: DiscoveryArena): LandingArena {
  return {
    id: arena.id,
    name: arena.name,
    description: arena.description ?? "",
    icon: iconForArena(arena.name, arena.proof_type),
    is_live: !arena.is_private,
    member_count: arena.member_count ?? 0,
    stake_at_risk: Number(arena.penalty_amount ?? 0),
    is_private: Boolean(arena.is_private),
    proof_type: arena.proof_type,
    deadline_time: arena.deadline_time,
    avg_streak_days: null,
  };
}

export const FALLBACK_ARENAS: LandingArena[] = [
  {
    id: 101,
    name: "The 5AM Club",
    description:
      "Zero tolerance early rising. Geo-verify out of bed by 5:00 AM local time, every day, no exceptions.",
    icon: "⏰",
    is_live: true,
    member_count: 1200,
    stake_at_risk: 1500,
    is_private: false,
    avg_streak_days: 42,
  },
  {
    id: 102,
    name: "Savage Athletics",
    description:
      "Daily training log, no skipped days. Post your workout summary before midnight or forfeit your stake.",
    icon: "🗡️",
    is_live: true,
    member_count: 842,
    stake_at_risk: 5000,
    is_private: false,
    avg_streak_days: 28,
  },
  {
    id: 103,
    name: "Deep Work Club",
    description:
      "Four uninterrupted hours, screen-time verified. Submit your focus block report before the daily cutoff.",
    icon: "🧠",
    is_live: true,
    member_count: 615,
    stake_at_risk: 800,
    is_private: false,
    avg_streak_days: 19,
  },
  {
    id: 104,
    name: "LeetCode Grind",
    description:
      "One medium or hard problem, every day. Submit a verified solution link before the pool closes.",
    icon: "⌨️",
    is_live: false,
    member_count: 389,
    stake_at_risk: 250,
    is_private: true,
    avg_streak_days: 11,
  },
];

export function storePendingArenaJoin(arenaId: number, isPrivate: boolean) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("pending_join_arena_id", String(arenaId));
  sessionStorage.setItem("pending_join_is_private", String(isPrivate));
}
