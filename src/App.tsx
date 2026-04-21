import React from 'react';
import { Loader2, Upload, XCircle } from 'lucide-react';
import { evaluateCV, EvaluationResult, JDRequirements } from './services/aiService';
import { EvaluationResultView } from './components/EvaluationResultView';
import { JobDescriptionView } from './components/JobDescriptionView';

interface Candidate {
  id: string;
  name: string;
  cvText: string;
  status: 'pending' | 'evaluating' | 'completed' | 'error';
  result?: EvaluationResult;
  timestamp: number;
}

const ACTIVE_JD_STORAGE_KEY = 'active-jd-requirements';

function parseJDText(rawText: string): JDRequirements {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);

  const fallbackSentenceSplit = rawText
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 10);

  const requirements = bulletLines.length > 0 ? bulletLines : fallbackSentenceSplit;
  const midpoint = Math.max(1, Math.ceil(requirements.length * 0.6));
  const mustHaves = requirements.slice(0, midpoint);
  const niceToHaves = requirements.slice(midpoint);
  const title = lines[0]?.slice(0, 80) || 'Untitled Role';

  return {
    title,
    must_haves: mustHaves,
    nice_to_haves: niceToHaves,
    raw_text: rawText,
  };
}

export default function App() {
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [cvInput, setCvInput] = React.useState('');
  const [candidateNameInput, setCandidateNameInput] = React.useState('');
  const [jdInput, setJdInput] = React.useState('');
  const [activeJD, setActiveJD] = React.useState<JDRequirements | null>(null);

  React.useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_JD_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as JDRequirements;
      if (parsed?.must_haves && parsed?.nice_to_haves) {
        setActiveJD(parsed);
      }
    } catch {
      localStorage.removeItem(ACTIVE_JD_STORAGE_KEY);
    }
  }, []);

  const saveActiveJD = (jd: JDRequirements | null) => {
    if (!jd) {
      localStorage.removeItem(ACTIVE_JD_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_JD_STORAGE_KEY, JSON.stringify(jd));
  };

  const handleUseThisJD = () => {
    const parsed = parseJDText(jdInput.trim());
    setActiveJD(parsed);
    saveActiveJD(parsed);
  };

  const handleReplaceJD = () => {
    setJdInput(activeJD?.raw_text || '');
  };

  const handleClearJD = () => {
    setActiveJD(null);
    saveActiveJD(null);
  };

  const handleEvaluate = async () => {
    if (!cvInput || !candidateNameInput || !activeJD) return;

    setIsEvaluating(true);
    const newId = Math.random().toString(36).substr(2, 9);
    
    const newCandidate: Candidate = {
      id: newId,
      name: candidateNameInput,
      cvText: cvInput,
      status: 'evaluating',
      timestamp: Date.now()
    };

    setCandidates(prev => [newCandidate, ...prev]);
    setSelectedCandidateId(newId);

    try {
      const result = await evaluateCV(cvInput, activeJD);
      setCandidates(prev => prev.map(c => 
        c.id === newId ? { ...c, status: 'completed', result } : c
      ));
    } catch (error) {
      console.error(error);
      setCandidates(prev => prev.map(c => 
        c.id === newId ? { ...c, status: 'error' } : c
      ));
    } finally {
      setIsEvaluating(false);
      setCvInput('');
      setCandidateNameInput('');
    }
  };

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        <header className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <h1 className="text-2xl font-bold">RecruitAI Screener</h1>
          <p className="text-sm text-gray-500 mt-1">Use your own Job Description to evaluate candidate CVs.</p>
        </header>

        <section>
          <JobDescriptionView
            jdInput={jdInput}
            activeJD={activeJD}
            onJdInputChange={setJdInput}
            onUseThisJD={handleUseThisJD}
            onReplaceJD={handleReplaceJD}
            onClearJD={handleClearJD}
          />
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">CV Evaluation</h2>
            {!activeJD && (
              <span className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded-full font-semibold">
                Select a JD first
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Candidate Name</label>
              <input
                type="text"
                value={candidateNameInput}
                onChange={(e) => setCandidateNameInput(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Paste CV Text</label>
              <textarea
                value={cvInput}
                onChange={(e) => setCvInput(e.target.value)}
                placeholder="Paste the full text from the candidate CV here..."
                className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none font-mono text-xs"
              />
            </div>
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || !cvInput || !candidateNameInput || !activeJD}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {isEvaluating ? 'Evaluating with AI...' : 'Run AI Screening'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 space-y-4">
          <h2 className="text-lg font-bold">Results</h2>
          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    candidate.id === selectedCandidateId
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {candidate.name} ({candidate.status})
                </button>
              ))}
            </div>
          )}
          {selectedCandidate ? (
            <div className="space-y-6">
              {selectedCandidate.status === 'evaluating' ? (
                <div className="bg-white rounded-2xl p-20 text-center border border-black/5 shadow-sm flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">AI is Analyzing CV</h3>
                    <p className="text-sm text-gray-500">Extracting evidence and calculating weighted scores...</p>
                  </div>
                </div>
              ) : selectedCandidate.result ? (
                <EvaluationResultView result={selectedCandidate.result} />
              ) : (
                <div className="bg-white rounded-2xl p-20 text-center border border-black/5 shadow-sm flex flex-col items-center justify-center gap-4">
                  <XCircle className="w-12 h-12 text-red-500" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">Evaluation Failed</h3>
                    <p className="text-sm text-gray-500">There was an error processing this CV. Please try again.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No evaluation selected yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
