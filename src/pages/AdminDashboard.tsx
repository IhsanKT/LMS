import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, HelpCircle, Users, Activity, Flag,
  Plus, Edit2, Trash2, Save, X, Loader2, ChevronRight, ChevronLeft, PanelLeftClose,
  FileText, RefreshCw, GraduationCap, LogOut, Shield, Eye, Upload, AlertTriangle, Camera, Download,
  ImageIcon, FlaskConical, EyeOff
} from 'lucide-react';
import {
  adminApi,
  getSession, clearSession,
} from '../api';
import type { AdminStats, ExamWithStats, Question, User, Submission, QuestionFlag, Exam } from '../api';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── LATEX RENDERER ────────────────────────────────────────────────────────────
// Splits text into plain/math segments and renders each math block via
// katex.render() directly onto DOM nodes. This bypasses dangerouslySetInnerHTML
// so that KaTeX's own SVG DOM is never touched by React's reconciler, and
// Tailwind's preflight svg{display:block} cannot override it because we
// forcibly reset display to 'inline' immediately after katex writes the SVG.

const LatexRenderer: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !text) { if (el) el.innerHTML = ''; return; }

    // Clear old content
    el.innerHTML = '';

    // Tokenise: split on $$, $, \[..\], \(..\)
    const segments: { type: 'text' | 'block' | 'inline'; content: string }[] = [];
    let remaining = text;
    const blockRe = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/;
    const inlineRe = /\$([^$\n]+?)\$|\\\((.+?)\\\)/;

    while (remaining.length > 0) {
      const blockMatch = blockRe.exec(remaining);
      const inlineMatch = inlineRe.exec(remaining);

      // Pick whichever match comes first
      let first: RegExpExecArray | null = null;
      let type: 'block' | 'inline' = 'block';
      if (blockMatch && (!inlineMatch || blockMatch.index <= inlineMatch.index)) {
        first = blockMatch; type = 'block';
      } else if (inlineMatch) {
        first = inlineMatch; type = 'inline';
      }

      if (!first) {
        segments.push({ type: 'text', content: remaining });
        break;
      }

      if (first.index > 0) {
        segments.push({ type: 'text', content: remaining.slice(0, first.index) });
      }
      segments.push({ type, content: (first[1] || first[2] || '').trim() });
      remaining = remaining.slice(first.index + first[0].length);
    }

    // Render each segment into the container
    segments.forEach(seg => {
      if (seg.type === 'text') {
        // Handle \textbf, \textit, newlines
        const span = document.createElement('span');
        span.innerHTML = seg.content
          .replace(/\\textbf{([^}]+)}/g, '<strong>$1</strong>')
          .replace(/\\textit{([^}]+)}/g, '<em>$1</em>')
          .replace(/\n/g, '<br />');
        el.appendChild(span);
      } else {
        const mathEl = document.createElement('span');
        // Inline style that beats Tailwind's svg{display:block} reset
        mathEl.setAttribute('style', 'display:inline; vertical-align:middle;');
        try {
          katex.render(seg.content, mathEl, {
            displayMode: seg.type === 'block',
            throwOnError: false,
            output: 'html',
          });
          // Force every SVG inside this node to be inline
          mathEl.querySelectorAll('svg').forEach(svg => {
            svg.style.setProperty('display', 'inline', 'important');
            svg.style.setProperty('max-width', 'none', 'important');
            svg.style.setProperty('overflow', 'visible', 'important');
          });
          // But keep hide-tail overflow:hidden so sqrt tail clips properly
          mathEl.querySelectorAll('.hide-tail').forEach(ht => {
            (ht as HTMLElement).style.setProperty('overflow', 'hidden', 'important');
          });
          mathEl.querySelectorAll('.hide-tail svg').forEach(svg => {
            (svg as SVGElement).style.setProperty('display', 'block', 'important');
            (svg as SVGElement).style.setProperty('max-width', 'none', 'important');
          });
        } catch {
          mathEl.textContent = seg.content;
        }
        el.appendChild(mathEl);
      }
    });
  }, [text]);

  return <span ref={containerRef} className={className} />;
};


// ── EXCEL (CSV) DOWNLOAD HELPER ────────────────────────────────────────────
const downloadExcel = (filename: string, headers: string[], rows: (string | number | undefined | null)[][]) => {
  const escape = (v: string | number | undefined | null) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};


const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }> = ({
  icon, label, value, sub, color = 'emerald',
}) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-xl bg-${color}-50 text-${color}-500 flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <p className="text-3xl font-extrabold text-gray-900 mb-1">{value}</p>
    <p className="text-sm font-semibold text-gray-500">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ── SHARED COMPONENTS ───────────────────────────────────────────────────────
const LoadingCenter: React.FC = () => (
  <div className="flex items-center justify-center p-20">
    <div className="flex flex-col items-center">
      <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Analytics...</p>
    </div>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="p-20 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border border-dashed border-slate-200">
    <div className="text-slate-200">{icon}</div>
    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{message}</p>
  </div>
);

// ── SIDE NAV ───────────────────────────────────────────────────────────────
type Tab = 'overview' | 'exams' | 'questions' | 'users' | 'monitoring' | 'results' | 'flagged';
const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'exams', label: 'Exams', icon: <BookOpen size={18} /> },
  { id: 'questions', label: 'Questions', icon: <HelpCircle size={18} /> },
  { id: 'users', label: 'Users', icon: <Users size={18} /> },
  { id: 'monitoring', label: 'Monitoring', icon: <Activity size={18} /> },
  { id: 'results', label: 'Results', icon: <FileText size={18} /> },
  { id: 'flagged', label: 'Flagged Content', icon: <Flag size={18} /> },
];

// ── MODAL WRAPPER ──────────────────────────────────────────────────────────
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; actions?: React.ReactNode }> = ({ 
  title, onClose, children, wide, actions 
}) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-5xl' : 'max-w-xl'} shadow-2xl overflow-hidden`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {actions}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
          <X size={20} />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// ── FORM INPUT ─────────────────────────────────────────────────────────────
const FormField: React.FC<{ label: string; children: React.ReactNode; required?: boolean }> = ({ label, children, required }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm font-medium";

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = getSession();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/login');
  }, []);

  const handleLogout = () => { clearSession(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside
        style={{ transition: 'width 0.25s cubic-bezier(.4,0,.2,1)' }}
        className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden`}
      >
        {/* Logo + Toggle */}
        <div className="px-3 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className={`flex items-center gap-3 overflow-hidden ${sidebarOpen ? '' : 'w-0 opacity-0 pointer-events-none'}`}
            style={{ transition: 'opacity 0.2s, width 0.25s' }}>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <GraduationCap size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 whitespace-nowrap">Admin Panel</div>
              <div className="text-xs text-gray-500 font-medium whitespace-nowrap">LMS Platform</div>
            </div>
          </div>

          {/* When collapsed show only the icon centered */}
          {!sidebarOpen && (
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm mx-auto shrink-0">
              <GraduationCap size={20} />
            </div>
          )}

          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 transition-all ${!sidebarOpen ? 'absolute left-2 top-4' : ''}`}
          >
            {sidebarOpen
              ? <ChevronLeft size={16} />
              : <ChevronRight size={16} />
            }
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={!sidebarOpen ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-semibold transition-colors
                ${activeTab === item.id
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'}`}
            >
              <span className="shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && activeTab === item.id && <ChevronRight size={14} className="ml-auto shrink-0" />}
            </button>
          ))}
        </nav>

        <div className={`px-2 py-4 border-t border-gray-100 ${sidebarOpen ? '' : 'flex flex-col items-center'}`}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                  {user?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <div
                title={user?.name}
                className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm mb-2 cursor-default"
              >
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <PanelLeftClose size={18} style={{ transform: sidebarOpen ? 'none' : 'scaleX(-1)', transition: 'transform 0.25s' }} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 capitalize">{activeTab}</h1>
              <p className="text-sm text-gray-500 font-medium">LMS Administrator Console</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <GraduationCap size={16} /> Student View
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'overview'    && <OverviewTab />}
          {activeTab === 'exams'       && <ExamsTab />}
          {activeTab === 'questions'   && <QuestionsTab />}
          {activeTab === 'users'       && <UsersTab />}
          {activeTab === 'monitoring'  && <MonitoringTab />}
          {activeTab === 'results'     && <ResultsTab />}
          {activeTab === 'flagged'     && <FlagsTab />}
        </main>
      </div>
    </div>
  );
};

// ── Shared Loading ──────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// FLAGGED CONTENT TAB
// ═══════════════════════════════════════════════════════════════════════════
const FlagsTab: React.FC = () => {
  const [flags, setFlags] = useState<QuestionFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'analytics' | 'history'>('analytics');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setFlags(await adminApi.getQuestionFlags()); } finally { setLoading(false); }
  };

  const analytics = React.useMemo(() => {
    const groups: Record<number, { question: Question; exam: Exam; count: number; users: string[] }> = {};
    flags.forEach(f => {
      if (!f.question || !f.exam) return;
      if (!groups[f.question_id]) {
        groups[f.question_id] = { question: f.question, exam: f.exam, count: 0, users: [] };
      }
      groups[f.question_id].count++;
      if (f.user?.name) groups[f.question_id].users.push(f.user.name);
    });
    return Object.values(groups).sort((a,b) => b.count - a.count);
  }, [flags]);

  if (loading) return <LoadingCenter />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Flagged Content</h2>
          <p className="text-sm text-slate-500 font-medium">Review questions marked by students during their assessments.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
           <button 
             onClick={() => setView('analytics')}
             className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'analytics' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
           >Summary</button>
           <button 
             onClick={() => setView('history')}
             className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'history' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
           >Log</button>
        </div>
      </div>

      {view === 'analytics' ? (
        <div className="grid grid-cols-1 gap-6">
           {analytics.map(item => (
             <div key={item.question.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex items-start gap-8 hover:border-amber-400 transition-all shadow-sm group">
                <div className="w-20 h-20 rounded-3xl bg-amber-50 text-amber-600 flex flex-col items-center justify-center shrink-0 border border-amber-100 shadow-inner group-hover:bg-amber-100 transition-colors">
                   <p className="text-2xl font-black">{item.count}</p>
                   <p className="text-[10px] font-black uppercase tracking-widest">Flags</p>
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{item.exam.title}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">QID: #{item.question.id}</span>
                   </div>
                   <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner mb-4">
                      <LatexRenderer text={item.question.question_text} className="text-sm font-bold text-slate-800 leading-relaxed" />
                   </div>
                   <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Flagged by:</span>
                      <div className="flex -space-x-2">
                        {item.users.slice(0, 5).map((u, i) => (
                          <div key={i} title={u} className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase shadow-sm">
                            {u[0]}
                          </div>
                        ))}
                        {item.users.length > 5 && (
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm">
                            +{item.users.length - 5}
                          </div>
                        )}
                      </div>
                   </div>
                </div>
             </div>
           ))}
           {analytics.length === 0 && <EmptyState icon={<Flag size={60} />} message="No content has been flagged for review yet." />}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam Reference</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Question Preview</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {flags.map(f => (
                   <tr key={f.id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-8 py-5 text-xs text-slate-400 font-bold tabular-nums">{new Date(f.created_at).toLocaleString()}</td>
                      <td className="px-8 py-5">
                         <p className="text-sm font-bold text-slate-900 leading-none mb-1">{f.user?.name}</p>
                         <p className="text-[10px] text-slate-400 font-medium">{f.user?.email}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">{f.exam?.title}</span>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-xs font-bold text-slate-600 truncate max-w-xs mb-1 opacity-70 group-hover:opacity-100 transition-opacity">{f.question?.question_text.substring(0, 100)}...</p>
                         <div className="flex items-center gap-2">
                           <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded">Question #{f.question_id}</span>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
           {flags.length === 0 && <EmptyState icon={<RefreshCw size={60} />} message="Log is currently empty." />}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS TAB
// ═══════════════════════════════════════════════════════════════════════════
const ResultsTab: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<ExamWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterExamId, setFilterExamId] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'violations'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [detail, setDetail] = useState<Submission | null>(null);
  const [scoreOverride, setScoreOverride] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([adminApi.getExams(), adminApi.getSubmissions()]);
      setExams(e);
      setSubmissions(s);
    } finally { setLoading(false); }
  };

  const openDetail = async (sub: Submission) => {
    try {
      const d = await adminApi.getSubmissionDetail(sub.id);
      setDetail(d);
      setScoreOverride(d.final_score?.toString() ?? '');
    } catch { setDetail(sub); }
  };

  const handleOverride = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await adminApi.overrideScore(detail.id, parseFloat(scoreOverride));
      setDetail(null);
      loadData();
    } finally { setSaving(false); }
  };

  const toggleSort = (key: 'score' | 'violations') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const filtered = submissions.filter(s => {
    const studentName = s.user?.name?.toLowerCase() || '';
    const studentEmail = s.user?.email?.toLowerCase() || '';
    const examTitle = s.exam?.title?.toLowerCase() || '';
    const matchesSearch = studentName.includes(search.toLowerCase()) || 
                          studentEmail.includes(search.toLowerCase()) || 
                          examTitle.includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterExamId && s.exam_id !== +filterExamId) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = sortBy === 'score' ? (a.final_score ?? -999) : (a.user?.warning_count ?? 0);
    let valB = sortBy === 'score' ? (b.final_score ?? -999) : (b.user?.warning_count ?? 0);
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const exportCSV = () => {
    const headers = ['Student Name', 'Email', 'Exam Title', 'Score', 'Violations', 'Submitted At', 'Status'];
    const rows = sorted.map(s => [
      s.user?.name || 'N/A',
      s.user?.email || 'N/A',
      s.exam?.title || 'N/A',
      s.final_score ?? 'N/A',
      s.user?.warning_count || 0,
      new Date(s.submitted_at).toLocaleString(),
      s.user?.has_completed_exam ? 'FINISHED' : 'IN_PROGRESS'
    ]);
    downloadExcel(`Sorted_Exam_Results_${sortBy}_${sortOrder}.csv`, headers, rows);
  };
  
  if (loading) return <LoadingCenter />;

  return (
    <div className="p-8">
       <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Performance Analytics</h2>
            <p className="text-sm text-slate-500 font-medium">Smart sorting and detailed student performance records.</p>
          </div>
          <button
             onClick={exportCSV}
             className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl text-sm transition-all shadow-xl shadow-slate-200"
          >
             <Download size={18} /> Export Sorted Results
          </button>
       </div>

       <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-8 shadow-sm flex gap-4">
          <div className="flex-1">
            <FormField label="Search Student">
               <input className={inputCls} placeholder="Name or Email..." value={search} onChange={e => setSearch(e.target.value)} />
            </FormField>
          </div>
          <div className="w-64">
            <FormField label="Filter Exam">
               <select className={inputCls} value={filterExamId} onChange={e => setFilterExamId(e.target.value)}>
                  <option value="">All Exams</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
               </select>
            </FormField>
          </div>
          <div className="flex items-end pb-1">
             <button 
               onClick={() => { setSearch(''); setFilterExamId(''); setSortBy('score'); setSortOrder('desc'); }} 
               className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-900 border border-dashed border-slate-200 rounded-xl transition-all"
             >
               Reset View
             </button>
          </div>
       </div>

       <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
             <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                   <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Details</th>
                   <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Exam Title</th>
                   
                   <th 
                    onClick={() => toggleSort('score')}
                    className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-emerald-600 transition-colors"
                   >
                     <div className="flex items-center gap-1">
                        Performance 
                        {sortBy === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
                        {sortBy !== 'score' && <RefreshCw size={10} className="opacity-30" />}
                     </div>
                   </th>
                   
                   <th 
                    onClick={() => toggleSort('violations')}
                    className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-amber-600 transition-colors"
                   >
                     <div className="flex items-center gap-1">
                        Integrity 
                        {sortBy === 'violations' && (sortOrder === 'asc' ? '↑' : '↓')}
                        {sortBy !== 'violations' && <RefreshCw size={10} className="opacity-30" />}
                     </div>
                   </th>
                   
                   <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                   <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {sorted.map(s => {
                  const warnings = s.user?.warning_count || 0;
                  const score = s.final_score ?? 0;
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50/30 transition-colors ${sortBy === 'score' ? 'bg-emerald-50/5' : sortBy === 'violations' && warnings > 0 ? 'bg-amber-50/5' : ''}`}>
                       <td className="px-6 py-5">
                          <p className="text-sm font-bold text-slate-900">{s.user?.name}</p>
                          <p className="text-xs text-slate-400 font-medium">{s.user?.email}</p>
                       </td>
                       <td className="px-6 py-5">
                          <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]" title={s.exam?.title}>{s.exam?.title}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-300 tracking-tighter">ID: #{s.exam_id}</p>
                       </td>
                       <td className="px-6 py-5">
                          <div className={`text-lg font-black ${score >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {s.final_score != null ? s.final_score : <span className="text-xs text-slate-300 font-bold uppercase tracking-widest">Pending</span>}
                          </div>
                       </td>
                       <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-widest
                             ${warnings >= 3 ? 'bg-rose-50 text-rose-600 border-rose-100' : warnings > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                             {warnings} Violations
                          </span>
                       </td>
                       <td className="px-6 py-5">
                          <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1 rounded-full border
                             ${s.user?.has_completed_exam ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse'}`}>
                             {s.user?.has_completed_exam ? 'Completed' : 'Active'}
                          </span>
                       </td>
                       <td className="px-6 py-5">
                          <button 
                            onClick={() => openDetail(s)}
                            className="bg-white border border-slate-200 text-slate-600 p-2.5 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                          >
                             <Eye size={16} />
                          </button>
                       </td>
                    </tr>
                  )
                })}
             </tbody>
          </table>
          {sorted.length === 0 && (
             <EmptyState icon={<FileText size={60} />} message="No data matches your filter criteria." />
          )}
       </div>

       {detail && (
        <Modal 
          title={`Detailed Analysis - ${detail.user?.name}`} 
          onClose={() => setDetail(null)}
          wide
          actions={
            <button
              onClick={() => {
                const headers = ['Q#', 'Question', 'Student Answer', 'Correct Answer', 'Result', 'Score'];
                const rows = (detail.answers || []).map((ans, idx) => {
                  const isCorrect = ans.selected_option === ans.question?.correct_answer;
                  return [
                    idx + 1,
                    ans.question?.question_text || '',
                    ans.selected_option || 'N/A',
                    ans.question?.correct_answer || '',
                    isCorrect ? 'CORRECT' : 'WRONG',
                    isCorrect ? '+4' : '-1'
                  ];
                });
                downloadExcel(`Report_${detail.user?.name}.csv`, headers, rows);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95"
            >
              <Download size={14} /> Download Analysis
            </button>
          }
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-5 gap-3">
              <div className={`rounded-xl p-3 border ${detail.user?.warning_count && detail.user?.warning_count >= 3 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Score</p>
                <p className={`text-lg font-black ${(detail.user?.warning_count ?? 0) >= 3 ? 'text-red-600' : 'text-emerald-600'}`}>{detail.final_score ?? 'N/A'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exam</p>
                <p className="text-sm font-bold text-slate-700 truncate" title={detail.exam?.title}>{detail.exam?.title}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Answered</p>
                <p className="text-sm font-bold text-slate-700">{detail.answers?.length || 0} Questions</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm font-bold text-slate-700 truncate">{new Date(detail.submitted_at).toLocaleDateString()}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Flags</p>
                <p className={`text-sm font-bold ${(detail.user?.warning_count ?? 0) >= 3 ? 'text-red-600' : 'text-orange-500'}`}>{detail.user?.warning_count || 0} / 3</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Question Wise Analysis</h3>
              {detail.answers && detail.answers.length > 0 ? (
                detail.answers.map((ans, idx) => {
                  const isCorrect = ans.selected_option === ans.question?.correct_answer;
                  return (
                    <div key={ans.id} className={`p-4 rounded-xl border transition-all ${isCorrect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                      <div className="flex items-start gap-4">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 
                          ${isCorrect ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200' : 'bg-red-100 text-red-700 shadow-sm border border-red-200'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <LatexRenderer text={ans.question?.question_text || 'Removed Question'} className="text-sm font-bold text-gray-800 mb-4 block leading-relaxed" />
                          
                          <div className="grid grid-cols-2 gap-3">
                             {ans.question?.options && Object.entries(ans.question.options).map(([key, text]) => {
                               const isActualCorrect = key === ans.question?.correct_answer;
                               const isStudentPick = key === ans.selected_option;
                               
                               let labelClass = "text-gray-500 border-gray-100 bg-white";
                               if (isActualCorrect) labelClass = "text-emerald-700 border-emerald-200 bg-emerald-50 font-bold shadow-sm";
                               else if (isStudentPick && !isCorrect) labelClass = "text-red-700 border-red-200 bg-red-50 font-bold shadow-sm";

                               return (
                                 <div key={key} className={`flex items-center gap-3 p-2.5 rounded-xl border text-[11px] transition-all ${labelClass}`}>
                                   <span className={`w-6 h-6 rounded-lg flex items-center justify-center border text-[10px] font-black
                                     ${isActualCorrect ? 'bg-emerald-200 border-emerald-300' : 'bg-gray-50 border-gray-100'}`}>
                                     {key}
                                   </span>
                                   <span className="truncate flex-1 font-medium"><LatexRenderer text={text as string} /></span>
                                   {isStudentPick && <span className="text-[8px] font-black uppercase tracking-tighter opacity-80 bg-current/10 px-1.5 py-0.5 rounded">Your Pick</span>}
                                 </div>
                               );
                             })}
                          </div>
                        </div>
                        <div className={`text-sm font-black uppercase tracking-tighter mt-1 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isCorrect ? '+4 pts' : '-1 pt'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">No answers available</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Administrative Override</label>
              <div className="flex gap-2">
                <input
                  className={inputCls + ' flex-1 text-sm font-black text-emerald-600'}
                  type="number"
                  value={scoreOverride}
                  onChange={e => setScoreOverride(e.target.value)}
                  placeholder="Override final score..."
                />
                <button
                  onClick={handleOverride}
                  disabled={saving || !scoreOverride}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-bold text-xs transition-all shadow-lg"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════
const OverviewTab: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getStats();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingCenter />;

  return (
    <div className="p-8">
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard icon={<BookOpen size={24} />} label="Total Exams" value={stats?.totalExams ?? 0} />
        <StatCard icon={<HelpCircle size={24} />} label="Total Questions" value={stats?.totalQuestions ?? 0} color="blue" />
        <StatCard icon={<Users size={24} />} label="Registered Students" value={stats?.totalUsers ?? 0} color="purple" />
        <StatCard icon={<FileText size={24} />} label="Submissions" value={stats?.totalSubmissions ?? 0} color="orange" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Recent Submissions</h3>
            <button onClick={load} className="text-gray-400 hover:text-emerald-600 transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {(stats?.recentSubmissions ?? []).length === 0 && (
              <p className="text-sm text-gray-400 px-6 py-8 text-center font-medium">No submissions yet</p>
            )}
            {(stats?.recentSubmissions ?? []).map(sub => (
              <div key={sub.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{sub.user?.name ?? `User #${sub.user_id}`}</p>
                  <p className="text-xs text-gray-500">{sub.exam?.title ?? `Exam #${sub.exam_id}`}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {sub.final_score != null ? `${sub.final_score} pts` : <span className="text-orange-500 font-semibold text-xs">In Progress</span>}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(sub.submitted_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-6">Platform Health</h3>
          <div className="space-y-5">
            {[
              { label: 'Avg Score', value: `${(stats?.avgScore ?? 0).toFixed(1)} pts`, color: 'emerald' },
              { label: 'Completion Rate', value: stats?.totalSubmissions && stats.totalUsers ? `${Math.round((stats.totalSubmissions / stats.totalUsers) * 100)}%` : '0%', color: 'blue' },
              { label: 'Questions / Exam', value: stats?.totalExams ? Math.round((stats.totalQuestions || 0) / stats.totalExams) : 0, color: 'purple' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">{item.label}</span>
                <span className={`text-sm font-bold text-${item.color}-600`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMS TAB
// ═══════════════════════════════════════════════════════════════════════════
const ExamsTab: React.FC = () => {
  const [exams, setExams] = useState<ExamWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<ExamWithStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', duration: 60, is_active: true });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setExams(await adminApi.getExams()); } finally { setLoading(false); }
  };

  const openCreate = () => {
    setForm({ title: '', description: '', duration: 60, is_active: true });
    setEditing(null);
    setModal('create');
  };

  const openEdit = (exam: ExamWithStats) => {
    setEditing(exam);
    setForm({ title: exam.title, description: exam.description ?? '', duration: exam.duration, is_active: exam.is_active });
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (modal === 'create') await adminApi.createExam(form);
      else if (editing) await adminApi.updateExam(editing.id, form);
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await adminApi.deleteExam(id);
    setDeleteConfirm(null);
    load();
  };

  if (loading) return <LoadingCenter />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Examination Management</h2>
          <p className="text-sm text-gray-500 font-medium">{exams.length} exam{exams.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm">
          <Plus size={16} /> Create Exam
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {exams.length === 0 ? (
          <EmptyState icon={<BookOpen size={40} />} message="No exams yet. Create your first exam." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                {['Title', 'Duration', 'Questions', 'Submissions', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {exams.map(exam => (
                <tr key={exam.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900 text-sm">{exam.title}</p>
                    {exam.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{exam.description}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 font-medium">{exam.duration} min</td>
                  <td className="px-5 py-4 text-sm text-gray-600 font-medium">{exam.questionCount}</td>
                  <td className="px-5 py-4 text-sm text-gray-600 font-medium">{exam.submissionCount}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                      ${exam.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {exam.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(exam)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteConfirm(exam.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <Modal title={modal === 'create' ? 'Create New Exam' : 'Edit Exam'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <FormField label="Exam Title" required>
              <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. KEAM 2027 Mock Test" />
            </FormField>
            <FormField label="Description">
              <textarea className={inputCls + ' resize-none'} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional exam description..." />
            </FormField>
            <FormField label="Duration (minutes)" required>
              <input className={inputCls} type="number" min={1} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))} />
            </FormField>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-emerald-500' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5.5' : 'translate-x-0.5'}`} style={{ transform: form.is_active ? 'translateX(22px)' : 'translateX(2px)' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Active (visible to students)</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold text-sm transition-colors">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {modal === 'create' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Modal title="Delete Exam?" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-gray-600 font-medium mb-6">This will permanently delete the exam and all its questions. This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm">Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm">Yes, Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// QUESTIONS TAB
// ═══════════════════════════════════════════════════════════════════════════
const QuestionsTab: React.FC = () => {
  const [exams, setExams] = useState<ExamWithStats[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingQ, setLoadingQ] = useState(false);
  const [modal, setModal] = useState<'create' | 'edit' | 'bulk' | null>(null);
  const [editing, setEditing] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showLatexPreview, setShowLatexPreview] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qForm, setQForm] = useState({
    question_text: '',
    options: { A: '', B: '', C: '', D: '', E: '' },
    correct_answer: 'A',
    image_url: '' as string,
  });
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    adminApi.getExams().then(e => { setExams(e); if (e.length > 0) setSelectedExamId(e[0].id); }).finally(() => setLoadingExams(false));
  }, []);

  useEffect(() => {
    if (selectedExamId) loadQuestions();
  }, [selectedExamId]);

  const loadQuestions = async () => {
    setLoadingQ(true);
    try { setQuestions(await adminApi.getQuestions(selectedExamId!)); } finally { setLoadingQ(false); }
  };

  const openCreate = () => {
    setQForm({ question_text: '', options: { A: '', B: '', C: '', D: '', E: '' }, correct_answer: 'A', image_url: '' });
    setEditing(null);
    setShowLatexPreview(false);
    setModal('create');
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    const opts = { A: '', B: '', C: '', D: '', E: '', ...q.options };
    setQForm({ question_text: q.question_text, options: opts as any, correct_answer: q.correct_answer, image_url: q.image_url || '' });
    setShowLatexPreview(false);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!qForm.question_text.trim() || !selectedExamId) return;
    setSaving(true);
    try {
      const payload = {
        ...qForm,
        image_url: qForm.image_url || null,
      };
      if (modal === 'create') {
        await adminApi.createQuestion({ exam_id: selectedExamId, ...payload });
      } else if (editing) {
        await adminApi.updateQuestion(editing.id, payload);
      }
      setModal(null);
      loadQuestions();
    } finally { setSaving(false); }
  };

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB'); return; }
    setImageUploading(true);
    try {
      const { url } = await adminApi.uploadImage(file);
      setQForm(f => ({ ...f, image_url: url }));
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally { setImageUploading(false); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const handleDelete = async (id: number) => {
    await adminApi.deleteQuestion(id);
    setDeleteConfirm(null);
    loadQuestions();
  };

  // Parse bulk text: each question block separated by blank line
  // Format per question:
  // Q: <text>
  // A: <option>
  // B: <option>
  // C: <option>
  // D: <option>
  // ANS: <letter>
  const handleBulkSave = async () => {
    if (!selectedExamId || !bulkText.trim()) return;
    setSaving(true);
    try {
      const blocks = bulkText.trim().split(/\n\s*\n/);
      const parsed = blocks.map(block => {
        const lines = block.trim().split('\n');
        const get = (prefix: string) => lines.find(l => l.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
        return {
          question_text: get('Q:'),
          options: { A: get('A:'), B: get('B:'), C: get('C:'), D: get('D:'), E: get('E:') },
          correct_answer: get('ANS:').toUpperCase() || 'A',
        };
      }).filter(q => q.question_text);
      await adminApi.bulkCreateQuestions(selectedExamId, parsed);
      setModal(null);
      setBulkText('');
      loadQuestions();
    } finally { setSaving(false); }
  };

  if (loadingExams) return <LoadingCenter />;

  return (
    <div className="p-8">
      {/* Exam Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Select Exam</label>
            <select
              className={inputCls + ' mt-1 min-w-[260px]'}
              value={selectedExamId ?? ''}
              onChange={e => setSelectedExamId(+e.target.value)}
            >
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        </div>
        {selectedExamId && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setBulkText(''); setModal('bulk'); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              <Upload size={15} /> Bulk Import
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm">
              <Plus size={16} /> Add Question
            </button>
          </div>
        )}
      </div>

      {/* Questions Table */}
      {loadingQ ? (
        <LoadingCenter />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {questions.length === 0 ? (
            <EmptyState icon={<HelpCircle size={40} />} message="No questions yet. Add your first question or use Bulk Import." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {['#', 'Question', 'Options', 'Answer', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-4 text-sm font-bold text-gray-400 w-10">{idx + 1}</td>
                    <td className="px-5 py-4 max-w-xs">
                      {q.image_url && (
                        <img
                          src={`${BASE_URL}${q.image_url}`}
                          alt="Question diagram"
                          className="mb-2 max-h-24 rounded-lg border border-gray-200 object-contain"
                        />
                      )}
                      <p className="text-sm text-gray-700 font-medium">
                        <LatexRenderer text={q.question_text} />
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        {Object.entries(q.options).filter(([_, v]) => v && String(v).trim() !== '').map(([k, v]) => (
                          <span key={k} className="text-xs text-gray-500 font-medium">
                            <span className="font-bold text-gray-700">{k}:</span>{' '}
                            <LatexRenderer text={String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v)} />
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                        {q.correct_answer}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(q)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setDeleteConfirm(q.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Question' : 'Edit Question'} onClose={() => setModal(null)}>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

            {/* LaTeX info banner */}
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-2">
              <FlaskConical size={14} className="shrink-0 text-indigo-500 mt-0.5" />
              <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                Supports <strong>LaTeX math</strong>: use <code className="bg-indigo-100 px-1 rounded">$...$</code> for inline and <code className="bg-indigo-100 px-1 rounded">$$...$$</code> for block equations.
                Plain text also works perfectly.
              </p>
            </div>

            {/* Question Text */}
            <FormField label="Question Text" required>
              <div className="relative">
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={4}
                  value={qForm.question_text}
                  onChange={e => setQForm(f => ({ ...f, question_text: e.target.value }))}
                  placeholder="e.g. What is the value of $\\pi$ to 2 decimal places?"
                />
                <button
                  type="button"
                  onClick={() => setShowLatexPreview(v => !v)}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                >
                  {showLatexPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showLatexPreview ? 'Hide' : 'Preview'}
                </button>
              </div>
              {showLatexPreview && qForm.question_text && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 min-h-[2rem]">
                  <LatexRenderer text={qForm.question_text} />
                </div>
              )}
            </FormField>

            {/* Options */}
            {(['A', 'B', 'C', 'D', 'E'] as const).map(opt => (
              <FormField key={opt} label={`Option ${opt}`} required={opt !== 'E'}>
                <input
                  className={inputCls}
                  value={qForm.options[opt]}
                  onChange={e => setQForm(f => ({ ...f, options: { ...f.options, [opt]: e.target.value } }))}
                  placeholder={opt === 'E' ? `Option E (Optional) — plain text or $LaTeX$` : `Answer option ${opt} — plain text or $LaTeX$`}
                />
                {showLatexPreview && qForm.options[opt] && (
                  <div className="mt-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                    <LatexRenderer text={qForm.options[opt]} />
                  </div>
                )}
              </FormField>
            ))}

            {/* Correct Answer */}
            <FormField label="Correct Answer" required>
              <select className={inputCls} value={qForm.correct_answer} onChange={e => setQForm(f => ({ ...f, correct_answer: e.target.value }))}>
                {['A', 'B', 'C', 'D', 'E'].map(o => (
                  (o !== 'E' || (qForm.options.E && String(qForm.options.E).trim() !== '')) && (
                    <option key={o} value={o}>Option {o}</option>
                  )
                ))}
              </select>
            </FormField>

            {/* Image Upload */}
            <FormField label="Question Image (optional)">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
              />
              {qForm.image_url ? (
                <div className="relative">
                  <img
                    src={`${BASE_URL}${qForm.image_url}`}
                    alt="Question"
                    className="w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                  <button
                    onClick={() => setQForm(f => ({ ...f, image_url: '' }))}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow transition-colors"
                  >
                    <X size={13} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 w-full py-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-600 border border-dashed border-gray-300 hover:border-emerald-400 rounded-lg transition-colors"
                  >
                    Replace image
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  {imageUploading ? (
                    <><Loader2 size={24} className="animate-spin text-emerald-500" /><p className="text-xs text-gray-500 font-medium">Uploading…</p></>
                  ) : (
                    <><ImageIcon size={24} className="text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-600">Drop image here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF, WebP · Max 10MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !qForm.question_text.trim() || imageUploading} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold text-sm transition-colors">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {modal === 'create' ? 'Add Question' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk Import Modal */}
      {modal === 'bulk' && (
        <Modal title="Bulk Import Questions" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium space-y-1">
              <p className="font-bold">Format (separate questions with blank line):</p>
              <pre className="mt-1 font-mono text-xs text-blue-800 leading-relaxed">{`Q: What is 2+2?\nA: 1\nB: 2\nC: 4\nD: 8\nANS: C\n\nQ: What is 3+3?\nA: 5\nB: 6\nC: 7\nD: 8\nANS: B`}</pre>
            </div>
            <FormField label="Questions (text format)">
              <textarea className={inputCls + ' resize-y font-mono text-xs'} rows={14} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="Paste questions here..." />
            </FormField>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm">Cancel</button>
              <button onClick={handleBulkSave} disabled={saving || !bulkText.trim()} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold text-sm transition-colors">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Import Questions
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <Modal title="Delete Question?" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-gray-600 font-medium mb-6">This question will be permanently removed. Continue?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm">Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm">Yes, Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════════════════════════════════════
const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'edit' | 'create' | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'student', password: '' });
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setUsers(await adminApi.getUsers()); } finally { setLoading(false); }
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, password: '' });
    setModal('edit');
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'student', password: '' });
    setModal('create');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (modal === 'edit' && editing) {
        await adminApi.updateUser(editing.id, { name: form.name, email: form.email, role: form.role });
      } else {
        if (form.role === 'student') {
          await adminApi.addStudent({ name: form.name, email: form.email });
        } else {
          const { authApi: api } = await import('../api');
          await api.register(form.name, form.email, form.password || 'admin123', form.role);
        }
      }
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const handleRegenerateCode = async (id: number) => {
    try {
      await adminApi.regenerateAccessCode(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate code');
    }
  };

  const handleResetAttempt = async (id: number) => {
    try {
      await adminApi.resetAttempt(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to reset attempt');
    }
  };

  const handleDelete = async (id: number) => {
    await adminApi.deleteUser(id);
    setDeleteConfirm(null);
    load();
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSaving(true);
    try {
      const res = await adminApi.bulkUploadUsers(file);
      alert(`Upload complete!\nSuccess: ${res.success}\nFailed: ${res.failed}${res.errors.length > 0 ? '\n\nErrors: ' + res.errors.join(', ') : ''}`);
      load();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <LoadingCenter />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 font-medium">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className={inputCls + ' w-64'}
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-xl text-sm transition-colors"
          >
            <Upload size={15} /> Import CSV
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
            onChange={handleBulkUpload}
          />
          <button
            onClick={() =>
              downloadExcel(
                'users.csv',
                ['ID', 'Name', 'Email', 'Role', 'Access Code', 'Joined'],
                users.map(u => [
                  u.id, u.name, u.email, u.role,
                  u.access_code || '',
                  u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
                ])
              )
            }
            className="flex items-center gap-2 px-4 py-2.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-xl text-sm transition-colors"
          >
            <Download size={15} /> Export Excel
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm">
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Users size={40} />} message="No users found." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                {['Name & Profile', 'Email', 'Role', 'Access Code', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900 block">{u.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Joined: {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-600">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border
                      ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                      {u.role === 'admin' ? <Shield size={10} className="mr-1" /> : null}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {u.role === 'student' ? (
                      <div className="flex items-center gap-2 group">
                        <code className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-bold font-mono border border-emerald-100 uppercase letter-spacing-1">
                          {u.access_code || '---'}
                        </code>
                        <button 
                          onClick={() => handleRegenerateCode(u.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-emerald-600 transition-all"
                          title="Regenerate Code"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button 
                          onClick={() => { if(window.confirm('Reset this student\'s attempt? They will be able to start the exam again.')) handleResetAttempt(u.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-orange-600 transition-all"
                          title="Reset Exam Attempt"
                        >
                          <RefreshCw size={14} className="rotate-180" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Static Password</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setDeleteConfirm(u.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <Modal title={modal === 'create' ? 'Onboard New User' : 'Edit User'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="flex gap-4 p-1 bg-gray-50 rounded-xl border border-gray-100 mb-2">
              <button
                onClick={() => setForm(f => ({ ...f, role: 'student' }))}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.role === 'student' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}
              >
                Student
              </button>
              <button
                onClick={() => setForm(f => ({ ...f, role: 'admin' }))}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.role === 'admin' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400'}`}
              >
                Admin / Staff
              </button>
            </div>

            <FormField label="Full Name" required>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe" />
            </FormField>
            <FormField label="Email Address" required>
              <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@university.edu" />
            </FormField>
            
            {form.role === 'admin' && (
              <FormField label="Admin Password" required>
                <input className={inputCls} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Enter a secure password" />
              </FormField>
            )}

            {form.role === 'student' && modal === 'create' && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <p className="text-xs text-emerald-800 font-semibold leading-relaxed">
                  Students will be onboarded with a unique 8-character access code automatically generated for them. They will use their email and this code to login.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-colors">Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={saving || !form.name.trim() || !form.email.trim() || (form.role === 'admin' && !form.password && modal === 'create')} 
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-100"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {modal === 'create' ? `Add ${form.role === 'student' ? 'Student' : 'Admin'}` : 'Update Profile'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Delete User?" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-gray-600 font-medium mb-8">This user and all their data will be permanently removed. This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm">Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm)} className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-100">Yes, Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING TAB
// ═══════════════════════════════════════════════════════════════════════════
const MonitoringTab: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<ExamWithStats[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [filterExamId, setFilterExamId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [scoreOverride, setScoreOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showFeed, setShowFeed] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      adminApi.getExams(), 
      adminApi.getSubmissions(), 
      fetch(`${BASE_URL}/admin/violations`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('lms_token')}` } }).then(r => r.json())
    ])
      .then(([e, s, v]) => { setExams(e); setSubmissions(s); setViolations(v); })
      .finally(() => setLoading(false));
  };

  const handleClearViolations = async () => {
    if (!window.confirm('Are you sure you want to delete all recorded evidence?')) return;
    try {
      await adminApi.clearViolations();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to clear evidence');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Poll for violations every 15s instead of bare sockets for simplicity/resilience
    return () => clearInterval(interval);
  }, []);

  const loadSubmissions = async (examId?: number) => {
    setLoading(true);
    try { setSubmissions(await adminApi.getSubmissions(examId)); } finally { setLoading(false); }
  };

  const openDetail = async (sub: Submission) => {
    try {
      const d = await adminApi.getSubmissionDetail(sub.id);
      setDetail(d);
      setScoreOverride(d.final_score?.toString() ?? '');
    } catch { setDetail(sub); }
  };

  const handleOverride = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await adminApi.overrideScore(detail.id, parseFloat(scoreOverride));
      setDetail(null);
      loadSubmissions(filterExamId ? parseInt(filterExamId) : undefined);
    } finally { setSaving(false); }
  };

  const filtered = submissions.filter(s => {
    const name = s.user?.name?.toLowerCase() ?? '';
    const title = s.exam?.title?.toLowerCase() ?? '';
    return name.includes(search.toLowerCase()) || title.includes(search.toLowerCase());
  });

  if (loading) return <LoadingCenter />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Exam Monitoring</h2>
          <p className="text-sm text-gray-500 font-medium">{submissions.length} total submission{submissions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className={inputCls + ' w-52'}
            placeholder="Search by student / exam..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={inputCls + ' w-52'}
            value={filterExamId}
            onChange={e => { setFilterExamId(e.target.value); loadSubmissions(e.target.value ? +e.target.value : undefined); }}
          >
            <option value="">All Exams</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <button
            onClick={() =>
              downloadExcel(
                'submissions.csv',
                ['Student', 'Email', 'Access Code', 'Exam', 'Score', 'Flags', 'Submitted At', 'Status'],
                submissions.map(s => [
                  s.user?.name ?? `User #${s.user_id}`,
                  s.user?.email ?? '',
                  s.user?.access_code ?? '',
                  s.exam?.title ?? `Exam #${s.exam_id}`,
                  s.final_score ?? 'Not Scored',
                  s.user?.warning_count ?? 0,
                  new Date(s.submitted_at).toLocaleString(),
                  s.user?.has_completed_exam ? 'Finished' : s.user?.is_exam_active ? 'In Progress' : 'Unknown',
                ])
              )
            }
            className="flex items-center gap-2 px-3 py-2.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold rounded-xl text-sm transition-colors"
          >
            <Download size={15} /> Excel
          </button>
          <button
            onClick={async () => {
              const pendingCount = submissions.filter(s => s.final_score == null).length;
              if (pendingCount === 0) { alert('No pending submissions found.'); return; }
              if (window.confirm(`Force calculate scores for all ${pendingCount} pending submissions? This process might take a moment.`)) {
                try {
                  const res = await adminApi.bulkForceCalculateScores(filterExamId ? +filterExamId : undefined);
                  alert(res.message);
                  loadSubmissions(filterExamId ? +filterExamId : undefined);
                } catch (err: any) {
                  alert(err.message);
                }
              }
            }}
            className="flex items-center gap-2 px-3 py-2.5 border border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-bold rounded-xl text-xs transition-colors shadow-sm"
          >
            <FlaskConical size={14} /> Bulk Calculate Pending
          </button>
          <button onClick={() => loadSubmissions(filterExamId ? +filterExamId : undefined)} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* toggle btn */}
          {!showFeed && (
            <div className="flex justify-end px-4 pt-3">
              <button
                onClick={() => setShowFeed(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 transition-colors"
              >
                <Camera size={13} /> Show Evidence Feed
              </button>
            </div>
          )}
          {filtered.length === 0 ? (
            <EmptyState icon={<Activity size={40} />} message="No submissions to display." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {['Student', 'Exam', 'Score', 'Submitted At', 'Flags', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(sub => {
                  const warnings = sub.user?.warning_count || 0;
                  const forceTerminated = warnings >= 3;
                  const completed = sub.user?.has_completed_exam;
                  
                  return (
                    <tr key={sub.id} className={`hover:bg-slate-50/40 transition-colors ${forceTerminated ? 'bg-red-50/20' : ''}`}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">{sub.user?.name ?? `User #${sub.user_id}`}</p>
                        <p className="text-xs text-gray-400">{sub.user?.email}</p>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Code: <span className="text-emerald-500 font-mono tracking-widest">{sub.user?.access_code || '—'}</span></p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 font-medium">{sub.exam?.title ?? `Exam #${sub.exam_id}`}</td>
                      <td className="px-5 py-4">
                        {sub.final_score != null ? (
                          <span className={`text-sm font-bold ${forceTerminated ? 'text-red-600' : 'text-gray-900'}`}>{sub.final_score}</span>
                        ) : (
                          <span className="text-xs font-semibold text-orange-500">Not scored</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-gray-500">{new Date(sub.submitted_at).toLocaleString()}</td>
                      <td className="px-5 py-4">
                        {warnings > 0 ? (
                           <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${forceTerminated ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                             <AlertTriangle size={12} /> {warnings} Violations
                           </span>
                        ) : (
                           <span className="text-xs text-gray-400 font-bold">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {completed ? (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 border border-gray-200">
                               Finished
                             </span>
                          ) : sub.user?.is_exam_active ? (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-blue-50 text-blue-600 border border-blue-200 animate-pulse">
                               In Progress
                             </span>
                          ) : (
                             <span className="text-xs text-gray-400 font-medium">Unknown</span>
                          )}
                          
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border
                            ${sub.final_score != null ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                            {sub.final_score != null ? '✓ Graded' : '⏳ Pending'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => openDetail(sub)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Reset this student\'s attempt? They will be able to start the exam again.')) {
                              await adminApi.resetAttempt(sub.user_id);
                              loadSubmissions(filterExamId ? +filterExamId : undefined);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
                          title="Reset Attempt"
                        >
                          <RefreshCw size={13} /> Reset
                        </button>
                        {sub.final_score == null && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Force calculate score for this abandoned attempt?')) {
                                try {
                                  await adminApi.forceCalculateScore(sub.id);
                                  loadSubmissions(filterExamId ? +filterExamId : undefined);
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                            title="Calculate Score"
                          >
                            <FlaskConical size={13} /> Calculate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Live Alerts Feed Side Panel */}
        {showFeed && (
        <div className="w-80 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center">
          <div className="p-4 border-b border-gray-100 w-full flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
               <Camera className="text-red-500" size={18} /> Live Evidence Feed
            </h3>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleClearViolations}
                disabled={!violations || violations.length === 0}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mr-1"
                title="Clear all evidence"
              >
                <Trash2 size={13} />
                Clean All
              </button>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <button
                onClick={() => setShowFeed(false)}
                title="Close Feed"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="w-full h-[600px] overflow-y-auto custom-scrollbar p-0">
            {violations && violations.length > 0 ? violations.map(v => (
              <div key={v.id} className="p-4 border-b border-gray-50 hover:bg-slate-50 transition-colors">
                 <div className="flex items-start justify-between mb-2">
                   <div>
                     <p className="text-sm font-bold text-gray-900">{v.user?.name}</p>
                     <p className="text-[10px] uppercase font-bold text-red-600 tracking-wider">
                       {v.type.replace('_', ' ')}
                     </p>
                   </div>
                   <span className="text-[10px] text-gray-400 font-bold">{new Date(v.created_at).toLocaleTimeString()}</span>
                 </div>
                 {v.snapshot_url && (
                   <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                      <img src={v.snapshot_url} alt="Evidence" className="w-full h-auto object-cover" />
                   </div>
                 )}
              </div>
            )) : (
              <div className="p-8 text-center text-gray-400 text-sm font-medium">No violations recorded.</div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <Modal 
          title={`Submission Report - ${detail.user?.name}`} 
          onClose={() => setDetail(null)}
          wide
          actions={
            <button
              onClick={() => {
                const headers = ['Q#', 'Question', 'Student Answer', 'Correct Answer', 'Result', 'Score'];
                const rows = (detail.answers || []).map((ans, idx) => {
                  const isCorrect = ans.selected_option === ans.question?.correct_answer;
                  return [
                    idx + 1,
                    ans.question?.question_text || '',
                    ans.selected_option || 'N/A',
                    ans.question?.correct_answer || '',
                    isCorrect ? 'CORRECT' : 'WRONG',
                    isCorrect ? '+4' : '-1'
                  ];
                });
                downloadExcel(`Analysis_${detail.user?.name}_${detail.id}.csv`, headers, rows);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95"
            >
              <Download size={14} /> Download Analysis Report
            </button>
          }
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Header Info */}
            <div className="grid grid-cols-5 gap-3">
              <div className={`rounded-xl p-3 border ${detail.user?.warning_count && detail.user?.warning_count >= 3 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Score</p>
                <p className={`text-lg font-black ${(detail.user?.warning_count ?? 0) >= 3 ? 'text-red-600' : 'text-emerald-600'}`}>{detail.final_score ?? 'N/A'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exam</p>
                <p className="text-sm font-bold text-slate-700 truncate" title={detail.exam?.title}>{detail.exam?.title}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Answered</p>
                <p className="text-sm font-bold text-slate-700">{detail.answers?.length || 0} Questions</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm font-bold text-slate-700 truncate">{new Date(detail.submitted_at).toLocaleDateString()}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Flags</p>
                <p className={`text-sm font-bold ${(detail.user?.warning_count ?? 0) >= 3 ? 'text-red-600' : 'text-orange-500'}`}>{detail.user?.warning_count || 0} / 3</p>
              </div>
            </div>

            {/* Question Wise List */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Detailed Analysis</h3>
              {detail.answers && detail.answers.length > 0 ? (
                detail.answers.map((ans, idx) => {
                  const isCorrect = ans.selected_option === ans.question?.correct_answer;
                  return (
                    <div key={ans.id} className={`p-4 rounded-xl border transition-all ${isCorrect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 
                          ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800 mb-3 leading-relaxed">{ans.question?.question_text || 'Removed Question'}</p>
                          
                          <div className="grid grid-cols-2 gap-2">
                             {ans.question?.options && Object.entries(ans.question.options).map(([key, text]) => {
                               const isActualCorrect = key === ans.question?.correct_answer;
                               const isStudentPick = key === ans.selected_option;
                               
                               let labelClass = "text-gray-500 border-gray-100 bg-white";
                               if (isActualCorrect) labelClass = "text-emerald-700 border-emerald-200 bg-emerald-50 font-bold";
                               else if (isStudentPick && !isCorrect) labelClass = "text-red-700 border-red-200 bg-red-50 font-bold";

                               return (
                                 <div key={key} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] ${labelClass}`}>
                                   <span className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px]
                                     ${isActualCorrect ? 'bg-emerald-200 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                                     {key}
                                   </span>
                                   <span className="truncate">{text as string}</span>
                                   {isStudentPick && <span className="ml-auto text-[9px] uppercase tracking-tighter opacity-70">Student Pick</span>}
                                 </div>
                               );
                             })}
                          </div>
                        </div>
                        <div className={`text-xs font-black uppercase tracking-widest mt-1 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isCorrect ? '+4' : '-1'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-medium tracking-tight">No detailed answers recorded for this session.</p>
                </div>
              )}
            </div>

            {/* Manual Override */}
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Override Score Manually</label>
              <div className="flex gap-2">
                <input
                  className={inputCls + ' flex-1 text-sm font-bold'}
                  type="number"
                  value={scoreOverride}
                  onChange={e => setScoreOverride(e.target.value)}
                  placeholder="Set final score..."
                />
                <button
                  onClick={handleOverride}
                  disabled={saving || !scoreOverride}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold text-xs transition-all"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Update Score
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default AdminDashboard;
