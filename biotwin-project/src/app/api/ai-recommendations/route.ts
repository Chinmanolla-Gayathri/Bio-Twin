import { NextRequest, NextResponse } from "next/server";

// ===== Simple in-memory rate limiter =====
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute

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
async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      role: "user",
      parts: [{ text: "You are a medical AI assistant that provides health recommendations based on digital twin simulation data. Always respond with valid JSON only." }],
    },
    {
      role: "model",
      parts: [{ text: "Understood. I will analyze the digital twin simulation data and provide structured health recommendations as a JSON array. Each recommendation will include category, title, description, actionItems, affectedOrgans, and priority fields." }],
    },
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ]);

  return result.response.text();
}

// ===== z-ai-web-dev-sdk fallback =====
async function callZAI(prompt: string): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a medical AI assistant that provides health recommendations based on digital twin simulation data. Always respond with valid JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return completion.choices?.[0]?.message?.content || "[]";
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
    const body = await req.json();
    const { simulationState, inputs, day } = body;

    // Build a detailed prompt for the AI
    const organSummary = Object.values(simulationState.organs)
      .map((o: { name: string; healthScore: number; severity: string; cause: string }) =>
        `${o.name}: ${o.healthScore}/100 (${o.severity}) — ${o.cause}`
      )
      .join("\n");

    const riskSummary = [
      `Obesity: ${Math.round(simulationState.risks.obesity * 100)}%`,
      `Heart Disease: ${Math.round(simulationState.risks.heart * 100)}%`,
      `Diabetes T2: ${Math.round(simulationState.risks.diabetes * 100)}%`,
    ].join("\n");

    const tendencySummary = (simulationState.diseaseTendencies || [])
      .slice(0, 5)
      .map((d: { name: string; tendency: number; reason: string }) =>
        `${d.name}: ${Math.round(d.tendency * 100)}% — ${d.reason}`
      )
      .join("\n");

    const treatmentSummary = simulationState.treatmentEffects?.organImprovements
      ? Object.entries(simulationState.treatmentEffects.organImprovements)
          .filter(([, v]: [string, number]) => v > 0)
          .map(([k, v]: [string, number]) => `${k}: +${v} improvement`)
          .join("\n")
      : "No treatments active";

    const prompt = `You are an expert AI health advisor analyzing a digital twin simulation. Based on the following 60-day health projection, provide personalized, actionable recommendations.

PATIENT PROFILE:
- Gender: ${inputs.gender}, Age: ${inputs.age}
- Height: ${inputs.height}cm, Weight: ${inputs.weight}kg
- Daily Calories: ${inputs.calories}, Water: ${inputs.water}L
- Sleep: ${inputs.sleep}h, Exercise Level: ${inputs.exercise}/5
- Smoking: ${inputs.smoking}/day, Alcohol: ${inputs.alcohol}/week
- Stress: ${inputs.stress}/10
- Conditions: ${[...inputs.conditions, ...inputs.customConditions].join(", ") || "None"}
- Notes: ${inputs.notes || "None"}

SIMULATION DAY: ${day}/60

ORGAN HEALTH SCORES:
${organSummary}

RISK LEVELS:
${riskSummary}

DISEASE TENDENCIES:
${tendencySummary || "No significant tendencies"}

TREATMENT EFFECTS:
${treatmentSummary}

BODY METRICS:
- BMI: ${simulationState.body.bmi.toFixed(1)}
- Fatigue: ${Math.round(simulationState.body.fatigue * 100)}%
- Dark Circles: ${Math.round((simulationState.body.darkCircles || 0) * 100)}%
- Skin Health: ${Math.round((1 - (simulationState.body.skinDull || 0)) * 100)}%
- Breathing Quality: ${Math.round((1 - (simulationState.body.breathing || 0)) * 100)}%

Provide 4-6 specific, medically-informed recommendations as a JSON array. Each recommendation must have:
- category: one of "critical", "warning", "improvement", "preventive"
- title: short title (max 80 chars)
- description: detailed explanation with medical reasoning (2-3 sentences)
- actionItems: array of 3-4 specific actionable steps
- affectedOrgans: array of organ IDs from: brain, heart, lungs, liver, kidneys, stomach, reproductive
- priority: number 1-5 (1 = most urgent)

Sort by priority (1 first). Be specific about mechanisms and pathways. Reference actual medical knowledge. Do NOT include disclaimers about consulting doctors - the user already knows this is a simulation.

Respond with ONLY the JSON array, no other text.`;

    // Try Gemini first, fall back to z-ai-web-dev-sdk
    let content: string;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey && geminiApiKey !== "your_gemini_api_key_here") {
      try {
        content = await callGemini(prompt);
      } catch (geminiError) {
        console.warn("Gemini API failed, falling back to z-ai-web-dev-sdk:", geminiError);
        content = await callZAI(prompt);
      }
    } else {
      content = await callZAI(prompt);
    }

    // Try to parse the AI response as JSON
    let recommendations;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      // If parsing fails, return the raw content as a single recommendation
      recommendations = [
        {
          id: "ai-general",
          category: "improvement",
          title: "AI Health Assessment",
          description: content.slice(0, 500),
          actionItems: [
            "Review the detailed AI analysis above",
            "Focus on the most affected organs first",
            "Consider lifestyle modifications recommended",
          ],
          affectedOrgans: Object.keys(simulationState.organs),
          priority: 2,
        },
      ];
    }

    return NextResponse.json(
      { recommendations },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (error: unknown) {
    console.error("AI Recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI recommendations", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
