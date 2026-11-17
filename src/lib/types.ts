export type Visibility = "private" | "shared" | "family";

export interface Goal {
  id: string;
  owner_id: string;
  family_id: string | null;
  visibility: Visibility;
  sphere: string;
  horizon: string;
  parent_id: string | null;
  title: string;
  why: string | null;
  metric: string | null;
  target: number | null;
  current: number;
  unit: string | null;
  deadline: string | null;
  status: "active" | "done" | "dropped";
  assignee_id: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  owner_id: string;
  goal_id: string | null;
  family_id: string | null;
  title: string;
  week_start: string;
  done: boolean;
}

export interface Profile {
  id: string;
  name: string | null;
}

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
}

export interface Review {
  id: string;
  user_id: string;
  family_id: string | null;
  kind: "weekly" | "family";
  period_start: string;
  answers: Record<string, string>;
  ai_feedback: string | null;
  created_at: string;
}

export function progress(g: Pick<Goal, "target" | "current" | "status">): number {
  if (g.status === "done") return 100;
  if (!g.target || g.target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100)));
}
