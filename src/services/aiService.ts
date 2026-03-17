import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export async function evaluateCV(cvText: string): Promise<EvaluationResult> {
  const model = "gemini-3.1-pro-preview"; // Using Pro for better reasoning on CVs
  
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

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text || "{}");
}
