import React from 'react';
import { 
  Users, 
  FileText, 
  Settings, 
  Code, 
  Upload, 
  Search, 
  Loader2, 
  Plus,
  Trash2,
  ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import { evaluateCV, EvaluationResult } from './services/aiService';
import { EvaluationResultView } from './components/EvaluationResultView';
import { JobDescriptionView } from './components/JobDescriptionView';
import { AppsScriptExport } from './components/AppsScriptExport';

type View = 'dashboard' | 'jd' | 'script' | 'evaluation';

interface Candidate {
  id: string;
  name: string;
  cvText: string;
  status: 'pending' | 'evaluating' | 'completed' | 'error';
  result?: EvaluationResult;
  timestamp: number;
}

export default function App() {
  const [activeView, setActiveView] = React.useState<View>('dashboard');
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [cvInput, setCvInput] = React.useState('');
  const [candidateNameInput, setCandidateNameInput] = React.useState('');

  const handleEvaluate = async () => {
    if (!cvInput || !candidateNameInput) return;

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
    setActiveView('evaluation');

    try {
      const result = await evaluateCV(cvInput);
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

  const deleteCandidate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCandidates(prev => prev.filter(c => c.id !== id));
    if (selectedCandidateId === id) {
      setSelectedCandidateId(null);
      setActiveView('dashboard');
    }
  };

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">RecruitAI</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveView('jd')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === 'jd' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Job Description
          </button>
          <button 
            onClick={() => setActiveView('script')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === 'script' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Code className="w-4 h-4" />
            Apps Script
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Active JD</p>
            <p className="text-xs font-bold text-gray-700 truncate">React Native Engineer</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
            {activeView === 'dashboard' && 'Candidate Pipeline'}
            {activeView === 'jd' && 'JD Configuration'}
            {activeView === 'script' && 'Automation Export'}
            {activeView === 'evaluation' && 'Evaluation Result'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search candidates..." 
                className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-xs focus:ring-2 focus:ring-indigo-500 transition-all w-64"
              />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {activeView === 'dashboard' && (
            <div className="space-y-8">
              {/* New Evaluation Form */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-black/5 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold">New Candidate Evaluation</h3>
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
                      placeholder="Paste the full text from the candidate's CV here..."
                      className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none font-mono text-xs"
                    />
                  </div>
                  <button 
                    onClick={handleEvaluate}
                    disabled={isEvaluating || !cvInput || !candidateNameInput}
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {isEvaluating ? 'Evaluating with AI...' : 'Run AI Screening'}
                  </button>
                </div>
              </div>

              {/* Candidate List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Recent Evaluations</h3>
                {candidates.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                    <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">No candidates evaluated yet. Start by adding one above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {candidates.map((candidate) => (
                      <div 
                        key={candidate.id}
                        onClick={() => {
                          setSelectedCandidateId(candidate.id);
                          setActiveView('evaluation');
                        }}
                        className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            candidate.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                            candidate.status === 'evaluating' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'
                          }`}>
                            {candidate.status === 'evaluating' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-900">{candidate.name}</h4>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                              {new Date(candidate.timestamp).toLocaleDateString()} • {candidate.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          {candidate.result && (
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{candidate.result.overall_score}</div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => deleteCandidate(candidate.id, e)}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-5 h-5 text-gray-300" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'jd' && <JobDescriptionView />}
          {activeView === 'script' && <AppsScriptExport />}
          {activeView === 'evaluation' && selectedCandidate && (
            <div className="space-y-6">
              <button 
                onClick={() => setActiveView('dashboard')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
              >
                ← Back to Dashboard
              </button>
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
          )}
        </div>
      </main>
    </div>
  );
}
