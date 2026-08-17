import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, Check, AlertTriangle, Loader2, Flag, ChevronLeft, ChevronRight, Menu, X, RotateCcw } from 'lucide-react';
import { examApi, answerApi } from '../api';
import type { ExamWithStats, Question } from '../api';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Patch Tailwind's SVG resets that break KaTeX square-root / radical symbols.
if (typeof document !== 'undefined' && !document.getElementById('katex-tw-fix')) {
  const s = document.createElement('style');
  s.id = 'katex-tw-fix';
  s.textContent = [
    '.katex svg { display: inline !important; max-width: none !important; overflow: visible !important; }',
    '.katex .hide-tail { overflow: hidden !important; }',
    '.katex path, .katex rect { fill: currentColor !important; }',
  ].join('\n');
  document.head.appendChild(s);
}

const LatexRenderer: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !text) { if (el) el.innerHTML = ''; return; }
    el.innerHTML = '';

    const segments: { type: 'text' | 'block' | 'inline'; content: string }[] = [];
    let remaining = text;
    const blockRe = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/;
    const inlineRe = /\$([^$\n]+?)\$|\\\((.+?)\\\)/;

    while (remaining.length > 0) {
      const blockMatch = blockRe.exec(remaining);
      const inlineMatch = inlineRe.exec(remaining);
      let first: RegExpExecArray | null = null;
      let type: 'block' | 'inline' = 'block';
      if (blockMatch && (!inlineMatch || blockMatch.index <= inlineMatch.index)) {
        first = blockMatch; type = 'block';
      } else if (inlineMatch) {
        first = inlineMatch; type = 'inline';
      }
      if (!first) { segments.push({ type: 'text', content: remaining }); break; }
      if (first.index > 0) segments.push({ type: 'text', content: remaining.slice(0, first.index) });
      segments.push({ type, content: (first[1] || first[2] || '').trim() });
      remaining = remaining.slice(first.index + first[0].length);
    }

    segments.forEach(seg => {
      if (seg.type === 'text') {
        const span = document.createElement('span');
        span.innerHTML = seg.content
          .replace(/\\textbf{([^}]+)}/g, '<strong>$1</strong>')
          .replace(/\\textit{([^}]+)}/g, '<em>$1</em>')
          .replace(/\n/g, '<br />');
        el.appendChild(span);
      } else {
        const mathEl = document.createElement('span');
        mathEl.setAttribute('style', 'display:inline; vertical-align:middle;');
        try {
          katex.render(seg.content, mathEl, { displayMode: seg.type === 'block', throwOnError: false, output: 'html' });
          mathEl.querySelectorAll('svg').forEach(svg => {
            svg.style.setProperty('display', 'inline', 'important');
            svg.style.setProperty('max-width', 'none', 'important');
            svg.style.setProperty('overflow', 'visible', 'important');
          });
          mathEl.querySelectorAll('.hide-tail').forEach(ht => (ht as HTMLElement).style.setProperty('overflow', 'hidden', 'important'));
          mathEl.querySelectorAll('.hide-tail svg').forEach(svg => {
            (svg as SVGElement).style.setProperty('display', 'block', 'important');
            (svg as SVGElement).style.setProperty('max-width', 'none', 'important');
          });
        } catch { mathEl.textContent = seg.content; }
        el.appendChild(mathEl);
      }
    });
  }, [text]);

  return <span ref={containerRef} className={className} />;
};

const Exam: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exam = location.state?.exam as ExamWithStats | undefined;

  const [showModal, setShowModal] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resultData, setResultData] = useState<{ score: number; submissionId: number } | null>(null);
  const [time, setTime] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState('');
  
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({});

  const LIMIT = 500;
  const started = useRef(false);

  useEffect(() => {
    if (!exam) { navigate('/dashboard'); return; }
    if (!started.current) {
      started.current = true;
      initExam();
    }
  }, []);

  const initExam = async () => {
    try {
      setLoading(true);
      const startRes = await examApi.startExam(exam!.id);
      setTime(startRes.duration * 60);

      if (startRes.answers && Object.keys(startRes.answers).length > 0) {
        const numericalAnswers: Record<number, string> = {};
        for (const [k, v] of Object.entries(startRes.answers)) {
          numericalAnswers[Number(k)] = v;
        }
        setAnswers(numericalAnswers);
      }

      await loadQuestions(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (p: number) => {
    const res = await examApi.getQuestions(exam!.id, p, LIMIT);
    setTotalQuestions(res.total);
    setLastPage(res.lastPage);
    if (p === 1) {
      setQuestions(res.data);
    } else {
      setQuestions(prev => [...prev, ...res.data]);
    }
    setPage(p);
  };

  useEffect(() => {
    if (!exam || loading) return;
    const interval = setInterval(() => {
      const stringAnswers: Record<string, string> = {};
      Object.entries(answers).forEach(([k, v]) => { stringAnswers[k] = v; });
      if (Object.keys(stringAnswers).length > 0) {
        answerApi.saveAnswers(exam.id, stringAnswers).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [answers, loading]);

  useEffect(() => {
    setVisited(prev => ({ ...prev, [currentQ]: true }));
    if (!loading && questions.length > 0 && currentQ >= questions.length - 5 && page < lastPage) {
      setLoadingMore(true);
      loadQuestions(page + 1).finally(() => setLoadingMore(false));
    }
  }, [currentQ]);

  useEffect(() => {
    if (loading || time === 0) return;
    const timer = setInterval(() => {
      setTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleAnswer = (questionId: number, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleClearSelection = (questionId: number) => {
    setAnswers(prev => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  const toggleFlag = async (idx: number) => {
    const q = questions[idx];
    if (!q || !exam) return;
    try {
      const res = await examApi.toggleFlag(exam.id, q.id);
      setFlagged(prev => ({ ...prev, [idx]: res.flagged }));
    } catch (err) {}
  };

  const handleSubmit = async () => {
    if (!exam) return;
    setSubmitting(true);
    try {
      const stringAnswers: Record<string, string> = {};
      Object.entries(answers).forEach(([k, v]) => { stringAnswers[k] = v; });
      if (Object.keys(stringAnswers).length > 0) {
        await answerApi.saveAnswers(exam.id, stringAnswers);
      }
      const res = await examApi.submitExam(exam.id);
      setResultData({ score: res.score, submissionId: res.submissionId });
      setSubmitting(false);
      setShowModal(false);
      setSubmitted(true);
    } catch (err) {
      setSubmitting(false);
      setShowModal(false);
    }
  };

  const currentQuestion = questions[currentQ];
  const optionEntries = currentQuestion 
    ? Object.entries(currentQuestion.options).filter(([_, val]) => val && String(val).trim() !== '') 
    : [];
  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 font-['Outfit']">
        <div className="text-center">
          <Loader2 className="animate-spin text-emerald-500 mx-auto mb-4" size={40} />
          <p className="text-slate-500 font-medium text-lg">Preparing Assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 font-['Outfit']">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-md">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <p className="text-slate-900 font-bold text-xl mb-2">Access Denied</p>
          <p className="text-slate-500 font-medium mb-8">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const timeWarning = time > 0 && time < 300; 

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 font-['Outfit'] p-4 animate-fade-in text-center">
        <div className="w-24 h-24 bg-emerald-100/50 rounded-full flex items-center justify-center mb-8 border border-emerald-200 shadow-inner">
          <Check className="text-emerald-500" size={48} />
        </div>
        <div className="flex items-center gap-2 mb-4">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Session Terminated</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-2 tracking-tighter uppercase italic leading-none">
          ASSESSMENT <span className="text-emerald-600">COMPLETE</span>
        </h1>
        <div className="flex flex-col items-center gap-2 mb-10 mt-12">
           <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/30 border border-emerald-400 relative overflow-hidden group transition-transform hover:scale-105 duration-500">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em] block mb-1 relative z-10">Final Score</span>
              <span className="text-5xl sm:text-7xl font-black text-white italic tracking-tighter relative z-10 drop-shadow-lg">
                {resultData?.score}
              </span>
           </div>
        </div>

        <p className="text-slate-500 font-bold text-base sm:text-lg max-w-xl leading-relaxed mb-10">
          Thank you for participating in the {exam?.title}. Your responses have been successfully recorded. You can view your detailed performance analysis immediately.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button 
            onClick={() => navigate(`/analysis/${resultData?.submissionId}`)}
            className="flex-1 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-3 cursor-pointer"
          >
            See Your Result <ChevronRight size={18} />
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex-1 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-3 cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white font-['Outfit'] select-none overflow-hidden">
    <header className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 py-2 sm:py-3 bg-white border-b border-gray-200 shrink-0 z-20 gap-3 sm:gap-0">
        <div className="flex items-center justify-between w-full sm:w-1/3">
           <div className="flex items-center gap-2 sm:gap-3">
             <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm shrink-0">
               <span className="text-white font-bold text-sm">T</span>
             </div>
             <h1 className="text-sm sm:text-lg font-bold text-gray-900 tracking-tight truncate max-w-[150px] sm:max-w-none">
               {exam?.title}
             </h1>
           </div>
           
           <div className="sm:hidden flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                 <Clock size={14} className={timeWarning ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
                 <span className={`text-sm font-bold font-mono ${timeWarning ? 'text-red-600' : 'text-gray-700'}`}>{formatTime(time)}</span>
              </div>
           </div>
        </div>
        
        <div className="hidden md:flex flex-col items-center justify-center w-1/3">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 shadow-sm">Progress</span>
           <div className="flex items-center gap-3 w-48">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{width: `${(answeredCount/totalQuestions)*100}%`}}></div>
              </div>
              <span className="text-xs font-bold text-gray-500">{answeredCount}/{totalQuestions}</span>
           </div>
        </div>

        <div className="flex items-center justify-end gap-3 w-full sm:w-1/3">
          <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-4 py-1.5 rounded-lg border border-gray-100">
             <Clock size={16} strokeWidth={2.5} className={timeWarning ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
             <span className={`text-[1.1rem] font-bold font-mono tracking-wide ${timeWarning ? 'text-red-600' : 'text-gray-700'}`}>{formatTime(time)}</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-1 sm:flex-none px-6 sm:px-5 py-2 sm:py-2 text-sm font-black uppercase text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-sm rounded-lg"
          >
            Submit
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden bg-[#f8fafc]">
        <main className="flex-1 overflow-y-auto px-4 py-8 md:p-12 relative flex flex-col items-center">
          {currentQuestion ? (
            <div className="w-full max-w-3xl flex flex-col h-full animate-fade-in-up">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Question {currentQ + 1}</span>
                 </div>
                 <div className="flex items-center gap-4">
                   <button 
                     onClick={() => toggleFlag(currentQ)}
                     className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${flagged[currentQ] ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                   >
                     <Flag size={14} className={flagged[currentQ] ? 'fill-current' : ''} />
                     {flagged[currentQ] ? 'Flagged' : 'Flag for review'}
                   </button>
                 </div>
              </div>
              
              <div className="mb-10">
                <h2 className="text-2xl leading-relaxed text-gray-800 font-semibold mb-6">
                  <LatexRenderer text={currentQuestion.question_text} />
                </h2>
                {currentQuestion.image_url && (
                  <div className="flex justify-center">
                    <img
                      src={`${BASE_URL}${currentQuestion.image_url}`}
                      alt="Question diagram"
                      className="max-w-full max-h-64 rounded-xl border border-gray-200 shadow-sm object-contain bg-gray-50"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-12">
                {optionEntries.map(([key, val]) => {
                  const isSelected = answers[currentQuestion.id] === key;
                  return (
                    <label
                      key={key}
                      className={`flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer group
                        ${isSelected 
                          ? 'bg-emerald-50/50 border-emerald-500 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.3)]' 
                          : 'bg-white border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30'}
                      `}
                    >
                      <input 
                        type="radio" 
                        name={`question-${currentQuestion.id}`} 
                        className="hidden"
                        checked={isSelected}
                        onChange={() => handleAnswer(currentQuestion.id, key)}
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 shrink-0 transition-colors
                        ${isSelected ? 'border-emerald-500' : 'border-gray-300 group-hover:border-emerald-300'}`}>
                        {isSelected && <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>}
                      </div>
                       <div className="flex items-center flex-1">
                          <span className="w-8 text-sm font-bold text-gray-400 uppercase">{key}.</span>
                          <span className={`text-[1.05rem] ${isSelected ? 'text-emerald-900 font-semibold' : 'text-gray-700 font-medium'}`}>
                            <LatexRenderer text={String(val)} />
                          </span>
                       </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-auto pt-6 border-t border-gray-200 flex justify-between items-center relative">
                <button
                  onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-lg font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors text-sm sm:text-base cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} /> Prev
                </button>

                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={() => toggleFlag(currentQ)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all border cursor-pointer
                      ${flagged[currentQ] ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}
                    `}
                  >
                    <Flag size={16} fill={flagged[currentQ] ? 'currentColor' : 'none'} />
                    {flagged[currentQ] ? 'Flagged' : 'Flag'}
                  </button>
                  
                  <button
                    onClick={() => handleClearSelection(currentQuestion.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm text-gray-500 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer"
                  >
                    <RotateCcw size={16} />
                    Clear Response
                  </button>
                </div>

                <div className="flex sm:hidden items-center gap-2">
                   <button
                    onClick={() => toggleFlag(currentQ)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${flagged[currentQ] ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    <Flag size={18} fill={flagged[currentQ] ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => handleClearSelection(currentQuestion.id)}
                    className="p-2.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>

                <button
                  onClick={() => setShowMobileNav(true)}
                  className="lg:hidden p-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors shadow-sm cursor-pointer"
                >
                   <Menu size={20} />
                </button>

                <button
                  onClick={() => {
                    if (currentQ === totalQuestions - 1) setShowModal(true);
                    else setCurrentQ(prev => Math.min(questions.length - 1, prev + 1));
                  }}
                  disabled={(currentQ === questions.length - 1 && page >= lastPage) && currentQ !== totalQuestions - 1}
                  className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2.5 rounded-lg font-bold bg-gray-900 text-white hover:bg-black transition-colors shadow-sm text-sm sm:text-base cursor-pointer disabled:cursor-not-allowed"
                >
                  {currentQ === totalQuestions - 1 ? 'Finish' : 'Next'} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-gray-300" size={32} />
            </div>
          )}
        </main>

        {showMobileNav && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[40] lg:hidden" onClick={() => setShowMobileNav(false)} />
        )}

        <aside className={`w-[280px] bg-white border-l border-gray-200 flex flex-col shrink-0 z-[50] fixed inset-y-0 right-0 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${showMobileNav ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>
          <div className="p-5 border-b border-gray-100">
             <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-gray-800 text-sm tracking-wide uppercase">Navigator</h3>
               <button onClick={() => setShowMobileNav(false)} className="lg:hidden text-gray-400 hover:text-gray-900 bg-gray-50 p-1.5 rounded-md border border-gray-200 shadow-sm">
                 <X size={16} strokeWidth={3} />
               </button>
             </div>
             <div className="grid grid-cols-2 gap-3 text-xs font-bold text-gray-500 mb-2">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> Answered</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 border-2 border-gray-300 rounded-sm"></div> Unanswered</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-orange-400 rounded-sm"></div> Flagged</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-50 border border-blue-200 rounded-sm"></div> Visited</div>
             </div>
          </div>

          <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentQ;
                const isFlagged = flagged[idx];
                const isVisited = visited[idx];
                
                let baseStyle = 'bg-white border text-gray-500 border-gray-200 hover:border-gray-400';
                if (isCurrent) baseStyle = 'bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900/20';
                else if (isAnswered) baseStyle = 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
                else if (isVisited) baseStyle = 'bg-blue-50 text-blue-800 border-blue-200 shadow-sm';
                
                return (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentQ(idx); setShowMobileNav(false); }}
                    className={`relative aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all cursor-pointer ${baseStyle}`}
                  >
                    {idx + 1}
                    {isFlagged && !isCurrent && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full border-2 border-white"></div>}
                  </button>
                );
              })}
              {loadingMore && (
                <div className="col-span-5 flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-gray-300" />
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Submit Assessment</h2>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 bg-gray-50 p-4 rounded-xl">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                   <Check className="text-emerald-500" size={24} />
                 </div>
                 <div>
                    <p className="text-sm text-gray-500 font-semibold mb-0.5">Attempt Status</p>
                    <p className="text-gray-900 font-bold">{answeredCount} of {totalQuestions} completed</p>
                 </div>
              </div>

              <p className="text-gray-600 font-medium text-sm leading-relaxed mb-8">
                Are you sure you want to finish? You will not be able to return to this exam or change your answers once submitted.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting</> : 'Confirm Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exam;
