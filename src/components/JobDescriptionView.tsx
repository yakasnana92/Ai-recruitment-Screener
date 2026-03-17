import React from 'react';
import { JD_REQUIREMENTS } from '../services/aiService';
import { Briefcase, CheckCircle, Star } from 'lucide-react';

export const JobDescriptionView: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-black/5 space-y-8">
      <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Briefcase className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">React Native Engineer</h2>
          <p className="text-sm text-gray-500">Recruitment Screening Configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900">Must-Have Requirements (80%)</h3>
          </div>
          <ul className="space-y-4">
            {JD_REQUIREMENTS.must_haves.map((req, i) => (
              <li key={i} className="flex items-start gap-4 group">
                <span className="text-xs font-mono text-indigo-300 mt-1 font-bold">0{i + 1}</span>
                <p className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">{req}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-slate-400" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900">Nice-to-Have Requirements (20%)</h3>
          </div>
          <ul className="space-y-4">
            {JD_REQUIREMENTS.nice_to_haves.map((req, i) => (
              <li key={i} className="flex items-start gap-4 group">
                <span className="text-xs font-mono text-slate-300 mt-1 font-bold">0{i + 1}</span>
                <p className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">{req}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Scoring Framework</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { score: "0", label: "No Evidence", color: "bg-gray-200" },
            { score: "1", label: "Weak Evidence", color: "bg-indigo-200" },
            { score: "2", label: "Moderate Evidence", color: "bg-indigo-400" },
            { score: "3", label: "Strong Evidence", color: "bg-indigo-600" },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-full h-1.5 rounded-full ${item.color}`} />
              <span className="text-[10px] font-bold text-gray-900">{item.score} - {item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
