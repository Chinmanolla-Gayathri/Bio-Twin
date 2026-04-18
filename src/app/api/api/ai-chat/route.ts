import { NextRequest, NextResponse } from "next/server";

// ===== Simple in-memory rate limiter =====
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ===== Gemini API helper =====
async function callGemini(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Build conversation history for Gemini
  const history = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood. I am BioTwin AI, an expert health advisor. I will provide personalized, evidence-based health advice referencing the simulation data provided. I will be empathetic but honest, suggest specific actionable improvements, and keep responses concise (2-4 paragraphs). If asked about medical diagnosis, I will remind the user to consult a real doctor." }] },
      ...history,
    ],
  });

  const lastMessage = messages[messages.length - 1]?.content || "";
  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}

// ===== z-ai-web-dev-sdk fallback =====
async function callZAI(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  return completion.choices?.[0]?.message?.content || "I apologize, I could not generate a response. Please try again.";
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a minute before trying again." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  try {
    const { messages, simulationContext } = await req.json();

    // Build context-aware system prompt
    const systemPrompt = `You are BioTwin AI, an expert health advisor integrated into a digital twin simulator. You have real-time access to the user's health simulation data.

Current Simulation Context:
- Day: ${simulationContext.day} of 60
- Gender: ${simulationContext.inputs?.gender || "unknown"}, Age: ${simulationContext.inputs?.age || "unknown"}
- BMI: ${simulationContext.state?.body?.bmi?.toFixed(1) || "unknown"}
- Fatigue: ${Math.round((simulationContext.state?.body?.fatigue || 0) * 100)}%
- Dark Circles: ${Math.round((simulationContext.state?.body?.darkCircles || 0) * 100)}%
- Overall Health Score: ${simulationContext.overallHealth || "unknown"}/100

Organ Health:
${Object.entries(simulationContext.state?.organs || {})
  .map(([id, organ]: [string, any]) => `- ${organ.name}: ${organ.healthScore}/100 (${organ.severity}) - ${organ.cause}`)
  .join("\n")}

Risk Levels:
- Obesity: ${Math.round((simulationContext.state?.risks?.obesity || 0) * 100)}%
- Heart Disease: ${Math.round((simulationContext.state?.risks?.heart || 0) * 100)}%
- Diabetes: ${Math.round((simulationContext.state?.risks?.diabetes || 0) * 100)}%

${
  simulationContext.state?.diseaseTendencies?.length > 0
    ? "Disease Tendencies:\n" +
      simulationContext.state.diseaseTendencies
        .map((d: any) => `- ${d.name}: ${Math.round(d.tendency * 100)}% (${d.reason})`)
        .join("\n")
    : ""
}

${
  simulationContext.treatments?.length > 0
    ? "Active Treatments:\n" +
      simulationContext.treatments
        .map((t: any) => `- ${t.treatment.name} (Day ${t.startDay}, Adherence: ${Math.round(t.adherence * 100)}%)`)
        .join("\n")
    : ""
}

Lifestyle:
- Sleep: ${simulationContext.inputs?.sleep || 0}h/day
- Exercise: ${simulationContext.inputs?.exercise || 0}/5
- Smoking: ${simulationContext.inputs?.smoking || 0} cigs/day
- Alcohol: ${simulationContext.inputs?.alcohol || 0} drinks/week
- Stress: ${simulationContext.inputs?.stress || 0}/10
- Water: ${simulationContext.inputs?.water || 0}L/day
- Calories: ${simulationContext.inputs?.calories || 0} kcal/day

Provide personalized, evidence-based health advice. Reference specific organ scores and risk levels when relevant. Be empathetic but honest about health risks. Suggest specific actionable improvements. Keep responses concise (2-4 paragraphs max). If asked about medical diagnosis, remind them to consult a real doctor.`;

    // Try Gemini first, fall back to z-ai-web-dev-sdk
    let message: string;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey && geminiApiKey !== "your_gemini_api_key_here") {
      try {
        message = await callGemini(systemPrompt, messages);
      } catch (geminiError) {
        console.warn("Gemini API failed, falling back to z-ai-web-dev-sdk:", geminiError);
        message = await callZAI(systemPrompt, messages);
      }
    } else {
      message = await callZAI(systemPrompt, messages);
    }

    return NextResponse.json(
      { message },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate response",
        message: "I'm having trouble connecting right now. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
