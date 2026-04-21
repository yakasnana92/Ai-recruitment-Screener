const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const SCREENING_CACHE_KEY_PREFIX = "screening-cache-v1";
const PROMPT_VERSION = "2026-04-21-deterministic-rubric-v1";

type Recommendation = "Strong Hire" | "Proceed to Interview" | "Hold" | "Reject";
type EvidenceStrength = "no_evidence" | "weak" | "moderate" | "strong";

export interface EvaluationResult {
  candidate_name: string;
  overall_score: number;
  must_have_score: number;
  nice_to_have_score: number;
  recommendation: Recommendation;
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

export interface JDRequirements {
  title?: string;
  must_haves: string[];
  nice_to_haves: string[];
  raw_text?: string;
}

interface StructuredEvidenceItem {
  requirement: string;
  evidence: string;
  evidence_strength: EvidenceStrength;
}

interface ModelEvaluationOutput {
  candidate_name?: string;
  strengths?: string[];
  gaps?: string[];
  risk_flags?: string[];
  recruiter_summary?: string;
  evidence_by_requirement?: StructuredEvidenceItem[];
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

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeForMatching(text: string): string {
  return normalizeWhitespace(text).toLowerCase();
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = normalizeForMatching(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function canonicalizeJD(jd: JDRequirements): {
  title: string;
  raw_text: string;
  must_haves: string[];
  nice_to_haves: string[];
} {
  const title = normalizeWhitespace(jd.title || "Untitled Role");
  const raw_text = normalizeWhitespace(jd.raw_text || "");
  const must_haves = dedupePreserveOrder((jd.must_haves || []).map((r) => normalizeWhitespace(String(r))).filter(Boolean));
  const nice_to_haves = dedupePreserveOrder((jd.nice_to_haves || []).map((r) => normalizeWhitespace(String(r))).filter(Boolean));
  return { title, raw_text, must_haves, nice_to_haves };
}

function normalizeCV(cvText: string): string {
  return normalizeWhitespace(cvText);
}

function strengthToScore(strength: EvidenceStrength): number {
  switch (strength) {
    case "strong":
      return 3;
    case "moderate":
      return 2;
    case "weak":
      return 1;
    case "no_evidence":
    default:
      return 0;
  }
}

function scoreToPercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

function getRecommendation(overallScore: number): Recommendation {
  if (overallScore >= 80) return "Strong Hire";
  if (overallScore >= 60) return "Proceed to Interview";
  if (overallScore >= 40) return "Hold";
  return "Reject";
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildStableResult(args: {
  raw: ModelEvaluationOutput;
  requirements: Array<{ requirement: string; is_must_have: boolean }>;
}): EvaluationResult {
  const strengths = Array.isArray(args.raw?.strengths)
    ? args.raw.strengths.map((s) => normalizeWhitespace(String(s))).filter(Boolean)
    : [];
  const gaps = Array.isArray(args.raw?.gaps)
    ? args.raw.gaps.map((g) => normalizeWhitespace(String(g))).filter(Boolean)
    : [];
  const riskFlags = Array.isArray(args.raw?.risk_flags)
    ? args.raw.risk_flags.map((r) => normalizeWhitespace(String(r))).filter(Boolean)
    : [];
  const rawEvidence = Array.isArray(args.raw?.evidence_by_requirement)
    ? args.raw.evidence_by_requirement
    : [];

  const evidenceMap = new Map<string, StructuredEvidenceItem>();
  for (const item of rawEvidence) {
    const requirement = normalizeWhitespace(String(item?.requirement ?? ""));
    if (!requirement) continue;
    const key = normalizeForMatching(requirement);
    if (!evidenceMap.has(key)) {
      const evidence_strength = item?.evidence_strength;
      evidenceMap.set(key, {
        requirement,
        evidence: normalizeWhitespace(String(item?.evidence ?? "")),
        evidence_strength:
          evidence_strength === "no_evidence" ||
          evidence_strength === "weak" ||
          evidence_strength === "moderate" ||
          evidence_strength === "strong"
            ? evidence_strength
            : "no_evidence",
      });
    }
  }

  const evidence_by_requirement = args.requirements.map((req) => {
    const entry = evidenceMap.get(normalizeForMatching(req.requirement));
    const evidence_strength = entry?.evidence_strength ?? "no_evidence";
    const score = strengthToScore(evidence_strength);
    const evidenceText = entry?.evidence
      ? entry.evidence
      : "No evidence found in the provided CV text.";

    return {
      requirement: req.requirement,
      score,
      evidence: evidenceText,
      is_must_have: req.is_must_have,
    };
  });

  const mustEvidence = evidence_by_requirement.filter((e) => e.is_must_have);
  const niceEvidence = evidence_by_requirement.filter((e) => !e.is_must_have);
  const mustRawScore = mustEvidence.reduce((acc, item) => acc + item.score, 0);
  const niceRawScore = niceEvidence.reduce((acc, item) => acc + item.score, 0);

  const mustMax = mustEvidence.length * 3;
  const niceMax = niceEvidence.length * 3;
  const must_have_score = scoreToPercent(mustRawScore, mustMax);
  const nice_to_have_score = scoreToPercent(niceRawScore, niceMax);
  const overall_score = Math.round(must_have_score * 0.8 + nice_to_have_score * 0.2);

  return {
    candidate_name: normalizeWhitespace(String(args.raw?.candidate_name ?? "Unknown Candidate")),
    overall_score,
    must_have_score,
    nice_to_have_score,
    recommendation: getRecommendation(overall_score),
    strengths,
    gaps,
    evidence_by_requirement,
    risk_flags: riskFlags,
    recruiter_summary: normalizeWhitespace(String(args.raw?.recruiter_summary ?? "")),
  };
}

function getScreeningCache(cacheKey: string): EvaluationResult | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as EvaluationResult;
  } catch {
    return null;
  }
}

function setScreeningCache(cacheKey: string, result: EvaluationResult): void {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    // Ignore cache write failures (e.g. quota exceeded, privacy mode).
  }
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
      top_p: 0.1,
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
  jdRequirements: JDRequirements
): Promise<EvaluationResult> {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const normalizedCV = normalizeCV(cvText);
  const normalizedJD = canonicalizeJD(jdRequirements);
  const jdTitle = normalizedJD.title;
  const jdRawText = normalizedJD.raw_text;
  const mustHaves = normalizedJD.must_haves;
  const niceToHaves = normalizedJD.nice_to_haves;
  const requirements = [
    ...mustHaves.map((requirement) => ({ requirement, is_must_have: true })),
    ...niceToHaves.map((requirement) => ({ requirement, is_must_have: false })),
  ];

  const cvHash = await sha256Hex(normalizedCV);
  const jdHash = await sha256Hex(JSON.stringify(normalizedJD));
  const cacheKey = `${SCREENING_CACHE_KEY_PREFIX}:${cvHash}:${jdHash}:${model}:${PROMPT_VERSION}`;
  const cached = getScreeningCache(cacheKey);
  if (cached) return cached;
  
  const prompt = `
You are a deterministic CV evidence extractor.

PROMPT_VERSION: ${PROMPT_VERSION}

Your job:
- Evaluate candidate evidence ONLY from the provided CV text and JD requirements.
- Do not infer, assume, or guess missing experience.
- If evidence is absent, mark it as "no_evidence".
- The same evidence should always map to the same evidence_strength label.
- Do not perform final arithmetic or recommendation logic; that is handled in code.

Evidence strength rubric (strict):
- "no_evidence": requirement is not supported by CV text.
- "weak": requirement is only briefly mentioned without concrete detail.
- "moderate": requirement has clear supporting detail (role/project/task/impact).
- "strong": requirement has substantial and repeated evidence, depth, or leadership.

INPUTS
JD_TITLE:
${jdTitle}

JD_MUST_HAVES:
${mustHaves.map((r, i) => `${i + 1}. ${r}`).join("\n")}

JD_NICE_TO_HAVES:
${niceToHaves.map((r, i) => `${i + 1}. ${r}`).join("\n")}

JD_RAW_TEXT:
"""
${jdRawText}
"""

CV_TEXT:
"""
${normalizedCV}
"""

OUTPUT RULES
- Return strict JSON only.
- Keep array order stable and deterministic.
- Return exactly one evidence object per requirement listed in inputs.
- Keep each evidence item's "requirement" text exactly matching the input wording.
- If no supporting text exists, set:
  - "evidence_strength": "no_evidence"
  - "evidence": "No evidence found in the provided CV text."

OUTPUT SCHEMA
{
  "candidate_name": "string",
  "strengths": ["string"],
  "gaps": ["string"],
  "evidence_by_requirement": [
    {
      "requirement": "string",
      "evidence_strength": "no_evidence" | "weak" | "moderate" | "strong",
      "evidence": "string"
    }
  ],
  "risk_flags": ["string"],
  "recruiter_summary": "string"
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
    const raw = safeParseJson<ModelEvaluationOutput>(outputText);
    const result = buildStableResult({ raw, requirements });
    setScreeningCache(cacheKey, result);
    return result;
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
    const raw = safeParseJson<ModelEvaluationOutput>(repaired);
    const result = buildStableResult({ raw, requirements });
    setScreeningCache(cacheKey, result);
    return result;
  }
}
