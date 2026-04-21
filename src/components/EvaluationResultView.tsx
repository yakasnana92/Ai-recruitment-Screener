import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { EvaluationResult } from '../services/aiService';
import { CheckCircle2, AlertCircle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  result: EvaluationResult;
}

export const EvaluationResultView: React.FC<Props> = ({ result }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const strengths = result?.strengths ?? [];
  const gaps = result?.gaps ?? [];
  const riskFlags = result?.risk_flags ?? [];
  const evidence = result?.evidence_by_requirement ?? [];
  const githubEvaluation = result?.github_evaluation;

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // emerald-500
    if (score >= 60) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'Strong Hire': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'Proceed to Interview': return <CheckCircle2 className="w-6 h-6 text-blue-500" />;
      case 'Hold': return <AlertCircle className="w-6 h-6 text-amber-500" />;
      case 'Reject': return <XCircle className="w-6 h-6 text-red-500" />;
      default: return <Info className="w-6 h-6 text-gray-500" />;
    }
  };

  const splitLabelIntoTwoLines = (label: string, maxCharsPerLine: number = 30) => {
    const normalized = label.trim().replace(/\s+/g, ' ');
    if (normalized.length <= maxCharsPerLine) {
      return [normalized];
    }

    const words = normalized.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;

      if (nextLine.length <= maxCharsPerLine) {
        currentLine = nextLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }

      if (lines.length === 2) {
        break;
      }
    }

    if (lines.length < 2 && currentLine) {
      lines.push(currentLine);
    }

    if (lines.length > 2) {
      return [lines[0], `${lines[1].slice(0, Math.max(maxCharsPerLine - 1, 1)).trimEnd()}…`];
    }

    const consumedLength = lines.join(' ').length;
    if (normalized.length > consumedLength && lines[1]) {
      const truncated = lines[1].slice(0, Math.max(maxCharsPerLine - 1, 1)).trimEnd();
      lines[1] = `${truncated}…`;
    }

    return lines;
  };

  const chartData = evidence.map(req => ({
    name: req.requirement,
    score: req.score,
    full_name: req.requirement,
    is_must_have: req.is_must_have
  }));

  const chartRowHeight = 46;
  const chartMinHeight = 320;
  const chartTopBottomPadding = 44;
  const chartHeight = Math.max(chartMinHeight, chartData.length * chartRowHeight + chartTopBottomPadding);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-100"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={364.4}
              strokeDashoffset={364.4 * (1 - result.overall_score / 100)}
              className="transition-all duration-1000 ease-out"
              style={{ color: getScoreColor(result.overall_score) }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{result.overall_score}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Score</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <h2 className="text-2xl font-bold text-gray-900">{result.candidate_name}</h2>
            {getRecommendationIcon(result.recommendation)}
          </div>
          <p className="text-lg font-medium text-gray-700">{result.recommendation}</p>
          <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
            {result.recruiter_summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CV Strengths & Gaps */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">CV Strengths</h3>
            <ul className="space-y-3">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4">CV Gaps</h3>
            <ul className="space-y-3">
              {gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {riskFlags.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-4">CV Risk Flags</h3>
              <ul className="space-y-3">
                {riskFlags.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Requirement Breakdown Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 flex flex-col min-w-0 h-full">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">Requirement Evidence Score</h3>
          <div className="w-full min-w-0" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                barCategoryGap="34%"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 3]} hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={220}
                  interval={0}
                  tick={(props: { x: number; y: number; payload: { value: string } }) => {
                    const lines = splitLabelIntoTwoLines(props.payload.value, 30);
                    return (
                      <g transform={`translate(${props.x},${props.y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={4}
                          textAnchor="end"
                          fill="#4b5563"
                          fontSize={11}
                        >
                          {lines.map((line, index) => (
                            <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : 13}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    );
                  }}
                />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 shadow-xl border border-black/5 rounded-lg max-w-xs">
                          <p className="text-xs font-bold mb-1">{data.full_name}</p>
                          <p className="text-xs text-gray-500">Score: {data.score}/3</p>
                          <p className="text-[10px] mt-1 italic text-gray-400">
                            {data.is_must_have ? 'Must-Have' : 'Nice-to-Have'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.is_must_have ? '#6366f1' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase font-bold tracking-wider text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
              <span>Must-Have</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-slate-400 rounded-sm" />
              <span>Nice-to-Have</span>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Evaluation */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900">GitHub Evaluation</h3>
          {githubEvaluation?.provided ? (
            <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
              {githubEvaluation.url_type || 'unknown'}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              not provided
            </span>
          )}
        </div>

        {githubEvaluation?.url && (
          <p className="text-sm text-gray-600 break-all">
            {githubEvaluation.url}
          </p>
        )}

        <p className="text-sm text-gray-600">
          {githubEvaluation?.summary || 'No GitHub evidence was included for this candidate.'}
        </p>

        {githubEvaluation?.provided && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">Strengths</h4>
              <ul className="space-y-2">
                {(githubEvaluation.strengths || []).map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-2">Gaps</h4>
              <ul className="space-y-2">
                {(githubEvaluation.gaps || []).map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">Risk Flags</h4>
              <ul className="space-y-2">
                {(githubEvaluation.risk_flags || []).map((item, idx) => (
                  <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Evidence Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h3 className="text-sm font-bold text-gray-900">Detailed Evidence Breakdown</h3>
          {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {showDetails && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-widest">
                <tr>
                  <th className="px-6 py-3">Requirement</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Evidence Found</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evidence.map((req, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-xs">{req.requirement}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        req.is_must_have ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {req.is_must_have ? 'Must' : 'Nice'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(s => (
                          <div 
                            key={s} 
                            className={`w-2 h-2 rounded-full ${s <= req.score ? 'bg-indigo-500' : 'bg-gray-200'}`} 
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 italic leading-relaxed">{req.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
