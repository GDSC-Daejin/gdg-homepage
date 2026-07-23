export type Stage = 1 | 2 | 3;

export type Contributor = { slack_user_id: string; count: number };

export type CheckinResult =
  | { counted: false; reason: string }
  | { counted: true; total: number; stage: Stage; stage_changed: boolean; participants: string[]; top3: Contributor[] };

export type CloseResult =
  | { closed: false }
  | { closed: true; stage: Stage; total: number; top3: Contributor[] };
