const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * In-flight request deduplication.
 * If two components simultaneously call generateLesson for the same topic
 * (e.g. React StrictMode double-render), only one HTTP request is made.
 * Both callers receive the same resolved value.
 */
const _inFlight = new Map<string, Promise<unknown>>();

function deduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (_inFlight.has(key)) return _inFlight.get(key) as Promise<T>;
  const p = fn().finally(() => _inFlight.delete(key));
  _inFlight.set(key, p);
  return p;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("panicplan_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  // Auto-clear stale tokens — any 401 on a non-auth endpoint means the token is dead
  if (res.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
    localStorage.removeItem("panicplan_token");
    window.dispatchEvent(new Event("panicplan:logout"));
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || "Request failed");
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function register(email: string, password: string): Promise<TokenResponse> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export interface TopicInput {
  name: string;
  confidence: number;
}

export interface CreatePlanPayload {
  subject: string;
  exam_date: string;
  topics: TopicInput[];
  daily_hours: number;
}

export interface StudySession {
  id: number;
  plan_id: number;
  topic_id: number | null;
  topic_name: string | null;
  scheduled_date: string;
  duration_minutes: number;
  session_type: "learn" | "review" | "practice" | "light_review";
  notes: string | null;
  user_note: string | null;
  completed: boolean;
  comprehension_rating: number | null;
  is_missed: boolean;
}

export interface TopicRecord {
  id: number;
  name: string;
  confidence: number;
  hours_allocated: number;
}

export interface Plan {
  id: number;
  subject: string;
  exam_date: string;
  topics: TopicInput[];
  created_at: string;
  topic_records: TopicRecord[];
  sessions: StudySession[];
}

export interface PublicTopicRecord {
  id: number;
  name: string;
  confidence: number;
}

export interface PublicStudySession {
  scheduled_date: string;
  completed: boolean;
  is_missed: boolean;
}

export interface PublicPlan {
  id: number;
  subject: string;
  exam_date: string;
  topic_records: PublicTopicRecord[];
  sessions: PublicStudySession[];
}

export interface PlanSummary {
  id: number;
  subject: string;
  exam_date: string;
  created_at: string;
  total_sessions: number;
  completed_sessions: number;
}

export function createPlan(payload: CreatePlanPayload): Promise<Plan> {
  return request("/plans", { method: "POST", body: JSON.stringify(payload) });
}

export function listPlans(): Promise<PlanSummary[]> {
  return request("/plans");
}

export function getPlan(id: number): Promise<Plan> {
  return request(`/plans/${id}`);
}

export function getPublicPlan(id: number): Promise<PublicPlan> {
  return request(`/plans/${id}/public`);
}

export function deletePlan(id: number): Promise<void> {
  return request(`/plans/${id}`, { method: "DELETE" });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function completeSession(
  id: number,
  comprehension_rating: number,
  user_note?: string
): Promise<StudySession> {
  return request(`/sessions/${id}/complete`, {
    method: "PATCH",
    body: JSON.stringify({ comprehension_rating, user_note }),
  });
}

export interface UserStats {
  total_plans: number;
  total_completed_sessions: number;
  total_minutes_studied: number;
  streak_days: number;
  studied_today: boolean;
  sessions_this_week: number;
}

export function getUserStats(): Promise<UserStats> {
  return request("/user/stats");
}

export function missSession(id: number): Promise<StudySession> {
  return request(`/sessions/${id}/missed`, { method: "PATCH" });
}

// ── PDF Analysis ──────────────────────────────────────────────────────────────

export interface ExtractedTopic {
  name: string;
  suggested_confidence: number;
  importance: "critical" | "high" | "medium" | "low";
  description: string;
  estimated_hours: number;
}

export interface PdfAnalysis {
  subject: string;
  subject_type: string;
  exam_date_hint: string | null;
  daily_hours_suggestion: number;
  total_estimated_hours: number;
  difficulty_level: "beginner" | "intermediate" | "advanced";
  document_type: string;
  key_insight: string;
  topics: ExtractedTopic[];
  exam_tips: string[];
}

// ── Lessons ───────────────────────────────────────────────────────────────────

export interface KeyConcept { concept: string; explanation: string }
export interface Example { question: string; answer: string }

export interface TopicLesson {
  id: number;
  topic_id: number;
  summary: string;
  key_concepts: KeyConcept[];
  examples: Example[];
  study_tip: string | null;
  common_mistakes: string[] | null;
  created_at: string;
}

export function generateLesson(planId: number, topicId: number): Promise<TopicLesson> {
  // Deduplicated: StrictMode and multi-session same-topic renders share one request
  return deduped(`lesson-${planId}-${topicId}`, () =>
    request(`/plans/${planId}/topics/${topicId}/lesson`, { method: "POST" })
  );
}

export function deleteLesson(planId: number, topicId: number): Promise<void> {
  return request(`/plans/${planId}/topics/${topicId}/lesson`, { method: "DELETE" });
}

// ── Chat history ──────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  plan_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function getChatHistory(planId: number): Promise<ChatMessage[]> {
  return request(`/plans/${planId}/chat`);
}

export function saveChatMessage(planId: number, role: string, content: string): Promise<ChatMessage> {
  return request(`/plans/${planId}/chat`, {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });
}

export function clearChatHistory(planId: number): Promise<void> {
  return request(`/plans/${planId}/chat`, { method: "DELETE" });
}

// ── Ingest PDF content into plan RAG store ────────────────────────────────────

export function ingestPlanContent(planId: number, content: string, source = "pdf"): Promise<void> {
  return request(`/plans/${planId}/ingest`, {
    method: "POST",
    body: JSON.stringify({ content, source }),
  });
}

// ── Flashcards ────────────────────────────────────────────────────────────────

export interface Flashcard {
  id: number;
  lesson_id: number;
  front: string;
  back: string;
  created_at: string;
}

export function generateFlashcards(lessonId: number): Promise<Flashcard[]> {
  return deduped(`flashcards-${lessonId}`, () =>
    request(`/lessons/${lessonId}/flashcards`, { method: "POST" })
  );
}

export function getFlashcards(lessonId: number): Promise<Flashcard[]> {
  return request(`/lessons/${lessonId}/flashcards`);
}

export function getPlanReviewCards(planId: number): Promise<Flashcard[]> {
  return request(`/plans/${planId}/review`);
}

// ── Account management ────────────────────────────────────────────────────────

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request("/user/password", {
    method: "PATCH",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function deleteAccount(): Promise<void> {
  return request("/user", { method: "DELETE" });
}

export async function analyzePdf(file: File): Promise<PdfAnalysis> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/upload/analyze-pdf`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail || "Analysis failed");
  }

  return res.json();
}

// ── Reassessment ──────────────────────────────────────────────────────────────

export interface TopicUpdate {
  topic_id: number;
  new_confidence: number;
}

export function reassessPlan(
  planId: number,
  topic_updates: TopicUpdate[]
): Promise<Plan> {
  return request(`/plans/${planId}/reassess`, {
    method: "POST",
    body: JSON.stringify({ topic_updates }),
  });
}

// ── Save pre-generated sessions (used by the Vercel AI SDK streaming route) ──

export interface PrebuiltSession {
  topic_name: string;
  date: string;
  duration_minutes: number;
  session_type: string;
  notes?: string;
}

export interface SavePlanPayload {
  subject: string;
  exam_date: string;
  topics: TopicInput[];
  daily_hours: number;
  sessions: PrebuiltSession[];
}

export function savePlanFromSessions(payload: SavePlanPayload): Promise<Plan> {
  return request("/plans/from-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
