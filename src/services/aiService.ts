type Recommendation = "Strong Hire" | "Proceed to Interview" | "Hold" | "Reject";

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
  mustHaves: string[];
  niceToHaves: string[];
  rawText?: string;
}

export async function evaluateCV(
  candidateName: string,
  cvText: string,
  jdRequirements: JDRequirements
): Promise<EvaluationResult> {
  const response = await fetch("/api/screening", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      candidateName,
      cvText,
      activeJD: jdRequirements,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    result?: EvaluationResult;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error || "Screening request failed.");
  }

  if (!payload?.result) {
    throw new Error("Screening API returned an invalid response payload.");
  }

  return payload.result;
}
