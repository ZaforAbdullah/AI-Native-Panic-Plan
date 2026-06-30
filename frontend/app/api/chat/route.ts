export const runtime = "nodejs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.json();
  const { chatMessages, planId, subject, examDate, topics, topicFocus, token } = body as {
    chatMessages: { role: string; content: string }[];
    planId: number;
    subject: string;
    examDate: string;
    topics: { name: string; confidence: number }[];
    topicFocus?: string;
    token: string;
  };

  const upstream = await fetch(`${API}/stream/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: chatMessages,
      plan_id: planId,
      subject,
      exam_date: examDate,
      topics,
      topic_focus: topicFocus,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.json().catch(() => ({ detail: "Chat failed" }));
    return Response.json(err, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
