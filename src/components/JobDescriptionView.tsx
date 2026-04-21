import React from 'react';
import { Briefcase } from 'lucide-react';
import { JDRequirements } from '../services/aiService';

interface Props {
  jdInput: string;
  activeJD: JDRequirements | null;
  activationError: string | null;
  onJdInputChange: (value: string) => void;
  onUseThisJD: (currentInput: string) => void;
  onReplaceJD: () => void;
  onClearJD: () => void;
}

export const JobDescriptionView: React.FC<Props> = ({
  jdInput,
  activeJD,
  activationError,
  onJdInputChange,
  onUseThisJD,
  onReplaceJD,
  onClearJD,
}) => {
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Job Description Input</h3>
            <p className="text-sm text-gray-500">Paste the full JD text and activate it for screening.</p>
          </div>
        </div>

        <textarea
          ref={inputRef}
          value={jdInput}
          onChange={(e) => onJdInputChange(e.target.value)}
          placeholder="Paste job description text here..."
          className="w-full h-44 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none text-sm"
        />

        <button
          onClick={() => onUseThisJD(inputRef.current?.value ?? jdInput)}
          disabled={!jdInput.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Use This JD
        </button>
        {activationError && <p className="text-sm text-red-600">{activationError}</p>}
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Active Job Description</h3>

        {!activeJD ? (
          <p className="text-sm text-gray-500">No active JD selected.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Title</p>
              <p className="text-sm text-gray-900">{activeJD.title || 'Untitled Role'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Must-Haves</p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {activeJD.must_haves.slice(0, 8).map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nice-to-Haves</p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {activeJD.nice_to_haves.slice(0, 8).map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onReplaceJD}
                className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
              >
                Replace JD
              </button>
              <button
                onClick={onClearJD}
                className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-all"
              >
                Clear JD
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
