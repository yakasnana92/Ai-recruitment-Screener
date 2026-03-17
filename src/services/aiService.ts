const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export interface EvaluationResult {
  candidate_name: string;
  overall_score: number;
  must_have_score: number;
  nice_to_have_score: number;
  recommendation: "Strong Hire" | "Proceed to Interview" | "Hold" | "Reject";
  strengths: string[];
  gaps: string[];
  evidence_by_requirement: {
    requirement: string;
    score: number;
    evidence: string;
    is_must_have: boolean;
  }[];
  risk_flags: string[];
  recruiter_summary: string;
}

export const JD_REQUIREMENTS = {
  must_haves: [
    "Strong development experience in React Native mobile development",
    "Hands-on experience with Expo for building cross-platform mobile apps",
    "Tech leadership experience",
    "Clear understanding of the most common design patterns in React Native",
    "Ability to lead on Unit Testing and UI Testing for mobile apps",
    "Experience with Agile, TDD, and BDD",
    "React Native UI customisation, ensuring user experience is consistent in both Android and iOS",
    "Performance optimisation"
  ],
  nice_to_haves: [
    "AWS Serverless experience",
    "Coaching experience across Agile teams",
    "Leadership across cross-functional development teams",
    "Experience exploring other technologies and recommending improvements to ways of working",
    "Clear understanding of software development best practices",
    "Appreciation for client work and/or consulting",
    "Familiarity with deploying Expo apps to both iOS and Android stores using EAS Build"
  ]
};

function safeParseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error("Model returned non-JSON output.");
  }
}

function normalizeEvaluationResult(raw: any): EvaluationResult {
  const strengths = Array.isArray(raw?.strengths) ? raw.strengths : [];
  const gaps = Array.isArray(raw?.gaps) ? raw.gaps : [];
  const riskFlags = Array.isArray(raw?.risk_flags) ? raw.risk_flags : [];
  const evidence = Array.isArray(raw?.evidence_by_requirement)
    ? raw.evidence_by_requirement
    : [];

  return {
    candidate_name: String(raw?.candidate_name ?? "Unknown Candidate"),
    overall_score: Number.isFinite(raw?.overall_score) ? raw.overall_score : 0,
    must_have_score: Number.isFinite(raw?.must_have_score) ? raw.must_have_score : 0,
    nice_to_have_score: Number.isFinite(raw?.nice_to_have_score) ? raw.nice_to_have_score : 0,
    recommendation:
      raw?.recommendation === "Strong Hire" ||
      raw?.recommendation === "Proceed to Interview" ||
      raw?.recommendation === "Hold" ||
      raw?.recommendation === "Reject"
        ? raw.recommendation
        : "Hold",
    strengths: strengths.map((s: any) => String(s)).filter(Boolean),
    gaps: gaps.map((g: any) => String(g)).filter(Boolean),
    evidence_by_requirement: evidence
      .map((e: any) => ({
        requirement: String(e?.requirement ?? ""),
        score: Number.isFinite(e?.score) ? e.score : 0,
        evidence: String(e?.evidence ?? ""),
        is_must_have: Boolean(e?.is_must_have),
      }))
      .filter((e: any) => e.requirement),
    risk_flags: riskFlags.map((r: any) => String(r)).filter(Boolean),
    recruiter_summary: String(raw?.recruiter_summary ?? ""),
  };
}

async function groqChatText(args: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  response_format?: unknown;
}): Promise<string> {
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      response_format: args.response_format,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function evaluateCV(cvText: string): Promise<EvaluationResult> {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  
  const prompt = `
    Evaluate the following candidate CV against the Job Description requirements provided below.
    
    JOB DESCRIPTION REQUIREMENTS:
    MUST-HAVES:
    ${JD_REQUIREMENTS.must_haves.map((r, i) => `${i + 1}. ${r}`).join("\n")}
    
    NICE-TO-HAVES:
    ${JD_REQUIREMENTS.nice_to_haves.map((r, i) => `${i + 1}. ${r}`).join("\n")}
    
    SCORING RULES:
    - Assess ONLY based on evidence found in the CV.
    - Do NOT assume missing experience.
    - Score each criterion using:
      0 = No evidence
      1 = Weak evidence (mentioned but no detail)
      2 = Moderate evidence (clear experience described)
      3 = Strong evidence (extensive experience or leadership shown)
    - Must-haves carry 80% of the total weight.
    - Nice-to-haves carry 20% of the total weight.
    
    CANDIDATE CV TEXT:
    """
    ${cvText}
    """
    
    OUTPUT FORMAT:
    Return a strict JSON object following this schema:
    {
      "candidate_name": "string",
      "overall_score": number (0-100),
      "must_have_score": number (0-100),
      "nice_to_have_score": number (0-100),
      "recommendation": "Strong Hire" | "Proceed to Interview" | "Hold" | "Reject",
      "strengths": ["string"],
      "gaps": ["string"],
      "evidence_by_requirement": [
        {
          "requirement": "string",
          "score": number (0-3),
          "evidence": "string summarizing findings",
          "is_must_have": boolean
        }
      ],
      "risk_flags": ["string"],
      "recruiter_summary": "Concise summary for a recruiter making a shortlist decision"
    }
  `;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable.");

  const jsonOnlyInstruction =
    "Return ONLY a valid JSON object that matches the requested schema. No markdown, no commentary, no code fences.";

  const outputText = await groqChatText({
    apiKey,
    model,
    messages: [
      { role: "system", content: jsonOnlyInstruction },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  try {
    return normalizeEvaluationResult(safeParseJson<any>(outputText));
  } catch {
    const repaired = await groqChatText({
      apiKey,
      model,
      messages: [
        {
          role: "system",
          content:
            "You repair JSON. Output ONLY valid JSON. Do not add any other text.",
        },
        {
          role: "user",
          content: `Fix this into a single valid JSON object (no commentary):\n\n${outputText}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    return normalizeEvaluationResult(safeParseJson<any>(repaired));
  }
}
