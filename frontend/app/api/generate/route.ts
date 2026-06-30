export const runtime = "nodejs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.json();

  const upstream = await fetch(`${API}/stream/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: body.subject,
      exam_date: body.examDate,
      topics: body.topics,
      daily_hours: body.dailyHours,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.json().catch(() => ({ detail: "Schedule generation failed" }));
    return Response.json(err, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
