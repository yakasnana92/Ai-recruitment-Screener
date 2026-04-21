import express from "express";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const PROMPT_VERSION = "2026-04-21-deterministic-rubric-v1";
const PORT = Number(process.env.API_PORT || 8787);

type Recommendation = "Strong Hire" | "Proceed to Interview" | "Hold" | "Reject";
type EvidenceStrength = "no_evidence" | "weak" | "moderate" | "strong";

interface JDRequirements {
  title?: string;
  mustHaves: string[];
  niceToHaves: string[];
  rawText?: string;
}

interface ScreeningRequest {
  candidateName: string;
  cvText: string;
  activeJD: JDRequirements;
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

interface EvaluationResult {
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

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForMatching(text: string): string {
  return normalizeWhitespace(text).toLowerCase();
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

function canonicalizeJD(jd: JDRequirements) {
  return {
    title: normalizeWhitespace(jd.title || "Untitled Role"),
    rawText: normalizeWhitespace(jd.rawText || ""),
    mustHaves: dedupePreserveOrder((jd.mustHaves || []).map((r) => normalizeWhitespace(String(r))).filter(Boolean)),
    niceToHaves: dedupePreserveOrder((jd.niceToHaves || []).map((r) => normalizeWhitespace(String(r))).filter(Boolean)),
  };
}

function strengthToScore(strength: EvidenceStrength): number {
  switch (strength) {
    case "strong":
      return 3;
    case "moderate":
      return 2;
    case "weak":
      return 1;
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

function buildStableResult(args: {
  candidateName: string;
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
  const rawEvidence = Array.isArray(args.raw?.evidence_by_requirement) ? args.raw.evidence_by_requirement : [];

  const evidenceMap = new Map<string, StructuredEvidenceItem>();
  for (const item of rawEvidence) {
    const requirement = normalizeWhitespace(String(item?.requirement ?? ""));
    if (!requirement) continue;
    const key = normalizeForMatching(requirement);
    if (!evidenceMap.has(key)) {
      evidenceMap.set(key, {
        requirement,
        evidence: normalizeWhitespace(String(item?.evidence ?? "")),
        evidence_strength:
          item?.evidence_strength === "no_evidence" ||
          item?.evidence_strength === "weak" ||
          item?.evidence_strength === "moderate" ||
          item?.evidence_strength === "strong"
            ? item.evidence_strength
            : "no_evidence",
      });
    }
  }

  const evidence_by_requirement = args.requirements.map((req) => {
    const entry = evidenceMap.get(normalizeForMatching(req.requirement));
    return {
      requirement: req.requirement,
      score: strengthToScore(entry?.evidence_strength ?? "no_evidence"),
      evidence: entry?.evidence || "No evidence found in the provided CV text.",
      is_must_have: req.is_must_have,
    };
  });

  const mustEvidence = evidence_by_requirement.filter((e) => e.is_must_have);
  const niceEvidence = evidence_by_requirement.filter((e) => !e.is_must_have);
  const must_have_score = scoreToPercent(mustEvidence.reduce((sum, item) => sum + item.score, 0), mustEvidence.length * 3);
  const nice_to_have_score = scoreToPercent(niceEvidence.reduce((sum, item) => sum + item.score, 0), niceEvidence.length * 3);
  const overall_score = Math.round(must_have_score * 0.8 + nice_to_have_score * 0.2);

  return {
    candidate_name: normalizeWhitespace(String(args.raw?.candidate_name ?? args.candidateName)),
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

async function groqChatText(args: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
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
      response_format: { type: "json_object" },
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
    error?: { message?: string };
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }
  throw new Error(`Groq API returned an empty completion.${data.error?.message ? ` ${data.error.message}` : ""}`);
}

async function evaluateWithGroq(input: ScreeningRequest): Promise<EvaluationResult> {
  const normalizedCV = normalizeWhitespace(input.cvText || "");
  const normalizedCandidateName = normalizeWhitespace(input.candidateName || "");
  const normalizedJD = canonicalizeJD(input.activeJD);
  const requirements = [
    ...normalizedJD.mustHaves.map((requirement) => ({ requirement, is_must_have: true })),
    ...normalizedJD.niceToHaves.map((requirement) => ({ requirement, is_must_have: false })),
  ];

  if (!normalizedCandidateName) throw new Error("Candidate name is required.");
  if (!normalizedCV) throw new Error("CV text is required.");
  if (!normalizedJD.rawText || requirements.length === 0) throw new Error("Active job description is required.");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY in server environment.");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  const prompt = `
You are a deterministic CV evidence extractor.

PROMPT_VERSION: ${PROMPT_VERSION}

Your job:
- Evaluate candidate evidence ONLY from the provided CV text and JD requirements.
- Do not infer, assume, or guess missing experience.
- If evidence is absent, mark it as "no_evidence".
- The same evidence should always map to the same evidence_strength label.
- Do not perform final arithmetic or recommendation logic; that is handled in code.

INPUTS
JD_TITLE:
${normalizedJD.title}

JD_MUST_HAVES:
${normalizedJD.mustHaves.map((r, i) => `${i + 1}. ${r}`).join("\n")}

JD_NICE_TO_HAVES:
${normalizedJD.niceToHaves.map((r, i) => `${i + 1}. ${r}`).join("\n")}

JD_RAW_TEXT:
"""
${normalizedJD.rawText}
"""

CV_TEXT:
"""
${normalizedCV}
"""
`;

  const jsonOnlyInstruction =
    "Return ONLY a valid JSON object with candidate_name, strengths, gaps, evidence_by_requirement, risk_flags, recruiter_summary.";
  const outputText = await groqChatText({
    apiKey,
    model,
    messages: [
      { role: "system", content: jsonOnlyInstruction },
      { role: "user", content: prompt },
    ],
  });

  try {
    const raw = safeParseJson<ModelEvaluationOutput>(outputText);
    return buildStableResult({ candidateName: normalizedCandidateName, raw, requirements });
  } catch (firstParseError) {
    console.error("Primary Groq response parse failed; retrying JSON repair.", {
      error: firstParseError,
      outputText,
    });
    const repaired = await groqChatText({
      apiKey,
      model,
      messages: [
        { role: "system", content: "You repair JSON. Output ONLY valid JSON." },
        { role: "user", content: `Fix this into valid JSON:\n\n${outputText}` },
      ],
    });
    const raw = safeParseJson<ModelEvaluationOutput>(repaired);
    return buildStableResult({ candidateName: normalizedCandidateName, raw, requirements });
  }
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/api/screening", async (req, res) => {
  const input = req.body as ScreeningRequest;
  try {
    const result = await evaluateWithGroq(input);
    res.status(200).json({ result });
  } catch (error) {
    console.error("Screening API failed", { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected screening server error.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Screening API listening on http://localhost:${PORT}`);
});
