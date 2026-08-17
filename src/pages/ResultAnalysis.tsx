import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examApi } from '../api';
import type { Submission } from '../api';
import { ChevronLeft, CheckCircle2, XCircle, AlertCircle, Loader2, GraduationCap, Printer } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

const ResultAnalysis: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ submission: Submission; analysis: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      examApi.getSubmissionAnalysis(Number(id))
        .then(res => setData(res))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-emerald-600" size={48} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <AlertCircle size={64} className="text-red-500 mb-6" />
        <h1 className="text-3xl font-black text-slate-900 mb-4 uppercase italic">Analysis Not Found</h1>
        <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl uppercase tracking-widest text-xs">Return to Dashboard</button>
      </div>
    );
  }

  const { submission, analysis } = data;
  const correctCount = analysis.filter((a: any) => a.isCorrect).length;
  const incorrectCount = analysis.filter((a: any) => a.selectedOption && !a.isCorrect).length;
  const unansweredCount = analysis.filter((a: any) => !a.selectedOption).length;

  return (
    <div className="min-h-screen bg-slate-50 font-['Outfit'] pb-20 print:bg-white print:pb-0">
      
      {/* Header - Hidden on Print */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md bg-white/80 print:hidden">
        <header className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors font-black uppercase tracking-widest text-[9px] sm:text-[10px] shrink-0"
              >
                <ChevronLeft size={14} /> Dashboard
              </button>
              
              <div className="flex items-center gap-2 sm:gap-3">
                 <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 shadow-lg text-white shrink-0">
                   <GraduationCap size={14} />
                 </div>
                 <h1 className="text-[14px] sm:text-lg font-black tracking-tighter uppercase italic leading-none whitespace-nowrap">
                    Tensors<span className="text-emerald-600">LMS</span>
                 </h1>
              </div>

              {/* Spacer for mobile alignment */}
              <div className="w-10 sm:hidden"></div>
            </div>
            
            <button 
              onClick={handlePrint}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
            >
              <Printer size={14} /> Download PDF Report
            </button>
          </div>
        </header>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-12 print:pt-0">
        
        {/* Score Card */}
        <div className="bg-slate-900 rounded-[3rem] p-10 sm:p-16 text-white overflow-hidden relative shadow-2xl mb-12 print:rounded-none print:shadow-none print:mb-8">
           <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
              <div className="text-center md:text-left">
                 <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4 italic">Performance Summary</p>
                 <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic leading-none mb-4">
                   {submission.exam?.title}
                 </h2>
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center justify-center md:justify-start gap-2">
                   Attempted on {new Date(submission.submitted_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                 </p>
              </div>
              <div className="flex flex-col items-center">
                 <div className="w-32 h-32 sm:w-40 h-40 bg-emerald-600 rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/40 border border-emerald-400/30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1 leading-none">Final Score</p>
                    <span className="text-5xl sm:text-7xl font-black italic tracking-tighter text-white">{submission.final_score}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16 print:mb-8">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center print:border-slate-300">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-4" />
              <p className="text-3xl font-black text-slate-900 italic mb-1">{correctCount}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Correct Answers</p>
           </div>
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center print:border-slate-300">
              <XCircle size={32} className="text-red-500 mx-auto mb-4" />
              <p className="text-3xl font-black text-slate-900 italic mb-1">{incorrectCount}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Incorrect Answers</p>
           </div>
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center print:border-slate-300">
              <AlertCircle size={32} className="text-slate-300 mx-auto mb-4" />
              <p className="text-3xl font-black text-slate-900 italic mb-1">{unansweredCount}</p>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Unanswered Items</p>
           </div>
        </div>

        {/* Question Breakdown */}
        <div className="space-y-10">
           <div className="flex items-center gap-4 px-2 font-black">
              <div className="h-6 w-1.5 bg-emerald-600 rounded-full"></div>
              <h3 className="text-2xl text-slate-900 uppercase italic tracking-tighter">Detailed Analysis</h3>
           </div>

           {analysis.map((ans: any, idx: number) => (
             <div key={idx} className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-slate-200 shadow-sm flex flex-col gap-8 print:break-inside-avoid print:shadow-none print:border-slate-300">
                <div className="flex items-start justify-between">
                   <div className="flex items-center gap-4">
                      <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic">#{idx + 1}</span>
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${ans.isCorrect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : ans.selectedOption ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                         {ans.isCorrect ? <CheckCircle2 size={12} /> : ans.selectedOption ? <XCircle size={12} /> : <AlertCircle size={12} />}
                         {ans.isCorrect ? 'Correct' : ans.selectedOption ? 'Incorrect' : 'Unanswered'}
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h4 className="text-xl sm:text-2xl font-bold text-slate-800 leading-relaxed">
                      <LatexRenderer text={ans.questionText} />
                   </h4>
                   {ans.imageUrl && (
                     <div className="flex justify-center bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <img src={`${BASE_URL}${ans.imageUrl}`} alt="Question diagram" className="max-h-64 object-contain rounded-lg" />
                     </div>
                   )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {Object.entries(ans.options).filter(([_, val]) => val && String(val).trim() !== '').map(([key, val]: [any, any]) => {
                     const isSelected = ans.selectedOption === key;
                     const isCorrect = ans.correctOption === key;
                     
                     let style = 'bg-slate-50 border-slate-200 text-slate-500';
                     if (isCorrect) style = 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20';
                     else if (isSelected) style = 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/20';

                     return (
                       <div key={key} className={`p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${style}`}>
                          <span className="w-6 h-6 rounded-lg bg-white/50 flex items-center justify-center text-[10px] font-black uppercase font-mono border border-slate-200">{key}</span>
                          <span className="flex-1 text-sm font-bold"><LatexRenderer text={String(val)} /></span>
                          <div className="flex items-center gap-2">
                             {isCorrect && <CheckCircle2 size={18} className="text-emerald-600" />}
                             {isSelected && !isCorrect && <XCircle size={18} className="text-red-600" />}
                             <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                               {isCorrect ? 'Correct Answer' : isSelected ? 'Your Choice' : ''}
                             </span>
                          </div>
                       </div>
                     );
                   })}
                </div>
             </div>
           ))}
        </div>

        <div className="mt-20 text-center font-black pb-10 print:mt-10">
           <p className="text-[11px] text-slate-300 uppercase tracking-[0.3em] italic">Assessment Record Verified by Tensors Academic</p>
           <p className="text-[9px] text-slate-200 uppercase tracking-[0.2em] mt-3">Ref ID ID: {submission.id} · Generated on {new Date().toLocaleString()}</p>
        </div>

      </main>

      {/* Styled Print Footer */}
      <div className="hidden print:block fixed bottom-0 left-0 w-full p-8 border-t border-slate-100 flex justify-between items-center bg-white">
         <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
             <GraduationCap size={16} />
           </div>
           <span className="text-xs font-black uppercase tracking-tighter italic">Tensors<span className="text-emerald-600">LMS</span> Assessment Report</span>
         </div>
         <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Page 1 of 1</span>
      </div>

    </div>
  );
};

export default ResultAnalysis;
