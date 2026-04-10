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
  github_evaluation: GitHubEvaluation;
}

export interface JDRequirements {
  title?: string;
  must_haves: string[];
  nice_to_haves: string[];
  raw_text?: string;
}

export interface GitHubInput {
  url: string;
  url_type: "profile" | "repository" | "unknown";
  owner?: string;
  repo?: string;
}

export interface GitHubEvaluation {
  provided: boolean;
  url?: string;
  url_type?: "profile" | "repository" | "unknown";
  summary: string;
  strengths: string[];
  gaps: string[];
  risk_flags: string[];
}

export function parseGitHubUrl(input: string): GitHubInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
    return {
      url: trimmed,
      url_type: "unknown",
    };
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length === 1) {
    return {
      url: trimmed,
      url_type: "profile",
      owner: parts[0],
    };
  }

  if (parts.length >= 2) {
    return {
      url: trimmed,
      url_type: "repository",
      owner: parts[0],
      repo: parts[1],
    };
  }

  return {
    url: trimmed,
    url_type: "unknown",
  };
}

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
  const githubStrengths = Array.isArray(raw?.github_evaluation?.strengths)
    ? raw.github_evaluation.strengths
    : [];
  const githubGaps = Array.isArray(raw?.github_evaluation?.gaps)
    ? raw.github_evaluation.gaps
    : [];
  const githubRiskFlags = Array.isArray(raw?.github_evaluation?.risk_flags)
    ? raw.github_evaluation.risk_flags
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
    github_evaluation: {
      provided: Boolean(raw?.github_evaluation?.provided),
      url: raw?.github_evaluation?.url
        ? String(raw.github_evaluation.url)
        : undefined,
      url_type:
        raw?.github_evaluation?.url_type === "profile" ||
        raw?.github_evaluation?.url_type === "repository" ||
        raw?.github_evaluation?.url_type === "unknown"
          ? raw.github_evaluation.url_type
          : "unknown",
      summary: String(
        raw?.github_evaluation?.summary ??
          "No GitHub evidence was included for this candidate."
      ),
      strengths: githubStrengths.map((s: any) => String(s)).filter(Boolean),
      gaps: githubGaps.map((g: any) => String(g)).filter(Boolean),
      risk_flags: githubRiskFlags.map((r: any) => String(r)).filter(Boolean),
    },
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

export async function evaluateCV(
  cvText: string,
  jdRequirements: JDRequirements,
  githubUrl?: string
): Promise<EvaluationResult> {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const mustHaves = jdRequirements.must_haves ?? [];
  const niceToHaves = jdRequirements.nice_to_haves ?? [];
  const jdTitle = jdRequirements.title || "Untitled Role";
  const jdRawText = jdRequirements.raw_text || "";
  const parsedGitHub = githubUrl ? parseGitHubUrl(githubUrl) : null;
  const githubInputBlock = parsedGitHub
    ? `URL: ${parsedGitHub.url}
URL_TYPE: ${parsedGitHub.url_type}
OWNER: ${parsedGitHub.owner || ""}
REPOSITORY: ${parsedGitHub.repo || ""}`
    : "No GitHub URL provided.";
  
  const prompt = `
    Evaluate the following candidate CV against the Job Description requirements provided below.
    
    JOB DESCRIPTION REQUIREMENTS:
    TITLE:
    ${jdTitle}

    MUST-HAVES:
    ${mustHaves.map((r, i) => `${i + 1}. ${r}`).join("\n")}
    
    NICE-TO-HAVES:
    ${niceToHaves.map((r, i) => `${i + 1}. ${r}`).join("\n")}

    RAW JOB DESCRIPTION TEXT (for additional context):
    """
    ${jdRawText}
    """
    
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

    OPTIONAL GITHUB INPUT:
    ${githubInputBlock}

    GITHUB EVALUATION RULES:
    - Keep GitHub evaluation separate from CV evaluation.
    - If GitHub input exists, treat it as supporting evidence only.
    - Prioritize repository quality and relevance to the JD.
    - Do NOT prioritize vanity metrics (stars, followers) unless directly relevant.
    - If no GitHub URL is provided, return github_evaluation.provided as false.
    
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
      "recruiter_summary": "Concise summary for a recruiter making a shortlist decision",
      "github_evaluation": {
        "provided": boolean,
        "url": "string",
        "url_type": "profile" | "repository" | "unknown",
        "summary": "string",
        "strengths": ["string"],
        "gaps": ["string"],
        "risk_flags": ["string"]
      }
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
