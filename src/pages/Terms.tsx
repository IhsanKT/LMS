import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ArrowRight, GraduationCap } from 'lucide-react';
import type { ExamWithStats } from '../api';

const Terms: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exam = location.state?.exam as ExamWithStats | undefined;
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exam) {
      navigate('/dashboard');
    }
  }, [exam, navigate]);

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight, scrollTop } = scrollRef.current;
        if (scrollHeight <= clientHeight || scrollHeight - scrollTop <= clientHeight + 30) {
          setHasScrolledToBottom(true);
        }
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 30) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Outfit'] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-6 flex justify-between items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all text-sm"
          >
            <ChevronLeft size={18} /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 shadow-xl shadow-slate-900/10 text-white">
               <GraduationCap size={16} />
             </div>
             <h1 className="text-lg font-black tracking-tighter uppercase italic leading-none">Tensors<span className="text-emerald-600">LMS</span></h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12 flex flex-col items-center">

        {/* Page Header */}
        <div className="w-full text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-6 border border-emerald-100">
             Official Practice Session
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-6 tracking-tighter uppercase italic">
            KEAM 2026 <span className="text-emerald-600">Mock Test</span>
          </h1>
          <p className="text-slate-500 font-bold text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
             Experience the official KEAM pattern with our standardized evaluation framework. This test is designed to simulate the actual examination environment.
          </p>
        </div>

        <div className="w-full flex flex-col gap-8">

          {/* ASSESSMENT STRUCTURE */}
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-sm">

            <div className="p-10 border-b border-slate-100 bg-slate-50/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Window</span>
                  <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">{exam?.duration} Minutes</span>
                </div>
                <div className="flex flex-col gap-1 border-x sm:px-12 border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Count</span>
                  <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">{exam?.questionCount} Questions</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marking Scheme</span>
                  <span className="text-2xl font-black text-emerald-600 tracking-tighter uppercase italic">+4 / -1 Rule</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/30 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Correct Attempt
                  </span>
                  <span className="text-xl font-black text-slate-900 tracking-tight">+4 Marks</span>
                </div>
                <div className="p-5 rounded-2xl border border-red-100 bg-red-50/30 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Incorrect Attempt
                  </span>
                  <span className="text-xl font-black text-slate-900 tracking-tight">−1 Mark</span>
                </div>
              </div>
            </div>

            <div className="p-10 bg-white">
              {/* Protocol Scroll Area */}
              <h4 className="font-black text-slate-900 text-sm mb-6 uppercase tracking-widest flex items-center gap-3 italic">
                 Practice Guidelines
              </h4>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-[300px] overflow-y-auto pr-6 custom-scrollbar text-slate-500 bg-slate-50/50 p-6 rounded-3xl border border-slate-100"
              >
                <div className="space-y-8">
                  <section>
                    <ul className="space-y-6">
                      {[
                        'This is a practice-oriented assessment. No camera or microphone access is required.',
                        'The test follows the exact KEAM pattern provided by experts.',
                        'External calculators, gadgets, or paper aids are strictly prohibited to ensure authentic practice.',
                        'Review of answers is only permitted within the active session window.',
                        'Any network interruption will be logged. Ensure stable connectivity.',
                        'IIT Madras student body design remains intellectual property.',
                        'The evaluation system strictly follows the official KEAM pattern.',
                        'Navigation away from the assessment window is monitored but not restricted.',
                        'By clicking I AGREE, you confirm that you have read all rules.',
                        'Your performance analysis will be available immediately after completion.'
                      ].map((rule, idx) => (
                        <li key={idx} className="flex gap-4 items-start text-[13px] font-bold leading-relaxed group">
                          <div className="w-2 h-2 rounded-full border-2 border-emerald-500/30 mt-1.5 shrink-0 group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </div>

            {/* Footer Consent */}
            <div className="p-10 border-t border-slate-100 bg-slate-50/50">
              <div
                onClick={() => hasScrolledToBottom && setAgreed(!agreed)}
                className={`flex items-start gap-5 mb-10 p-8 rounded-[2rem] border-2 transition-all duration-300
                  ${!hasScrolledToBottom
                    ? 'bg-slate-100/50 border-slate-200/50 opacity-60 cursor-not-allowed'
                    : agreed
                    ? 'bg-white border-emerald-500 cursor-pointer shadow-xl shadow-emerald-500/5'
                    : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                  }
                `}
              >
                <div className={`w-7 h-7 rounded-lg border-2 transition-all flex items-center justify-center shrink-0 mt-0.5 shadow-sm
                  ${agreed ? 'bg-emerald-600 border-emerald-600' : 'bg-slate-50 border-slate-300'}
                `}>
                  {agreed && <ArrowRight size={16} className="text-white" />}
                </div>
                <div className="flex flex-col flex-1">
                  <span className={`text-sm font-black uppercase italic tracking-tighter ${agreed ? 'text-emerald-700' : 'text-slate-500'}`}>
                    I AGREE TO COMPLY WITH ALL EXAMINATION PROTOCOLS
                  </span>
                  {!hasScrolledToBottom && (
                    <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest block animate-pulse">
                      Continue scrolling to the end to confirm your agreement.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-4">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="py-5 px-12 rounded-2xl bg-white border border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                >
                   Cancel
                </button>
                <button
                  onClick={() => {
                    if (agreed) {
                      navigate('/exam', { state: { exam } });
                    }
                  }}
                  disabled={!agreed}
                  className={`py-5 px-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-xl active:scale-95
                    ${agreed
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }
                  `}
                >
                  START ASSESSMENT
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
