import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { examApi, getSession, clearSession } from '../api';
import type { ExamWithStats } from '../api';
import { LogOut, BookOpen, Clock, GraduationCap, User, ArrowUpRight, ShieldCheck, MessageCircle, ChevronRight } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = getSession();
  const [exams, setExams] = useState<ExamWithStats[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<'active' | 'results'>('active');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsData, recentData] = await Promise.all([
          examApi.listExams(),
          examApi.getRecentSubmissions()
        ]);
        setExams(examsData);
        setRecentSubmissions(recentData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Infinite Auto-Scroll for Hero Carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % 2);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleStartExam = (exam: ExamWithStats) => {
    navigate('/terms', { state: { exam } });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Outfit'] pb-20">
      
      {/* Premium Header */}
      <div className="bg-white/80 border-b border-slate-200/60 sticky top-0 z-50 backdrop-blur-xl">
        <header className="max-w-[1400px] mx-auto px-8 py-4 flex justify-between items-center text-slate-900 font-bold">
          <div className="flex items-center gap-4 text-slate-900">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shadow-xl shadow-slate-900/10 text-white">
              <GraduationCap size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none uppercase italic">Tensors<span className="text-emerald-600">LMS</span></h1>
              <p className="text-[9px] uppercase tracking-[0.3em] font-black text-slate-400 mt-1">Assessment Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3 border-r border-slate-200 pr-6 group cursor-default">
                <div className="text-right hidden sm:block font-bold">
                  <p className="text-[11px] font-black text-slate-900 uppercase italic leading-none">{user?.name}</p>
                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">Verified Candidate</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:border-emerald-300 transition-all">
                   <User size={18} />
                </div>
             </div>
             <button
               onClick={handleLogout}
               className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-black text-slate-600 hover:text-white bg-white hover:bg-slate-900 rounded-xl transition-all border border-slate-200 hover:border-slate-900 uppercase tracking-widest shadow-sm shadow-slate-200/50"
             >
               <LogOut size={14} /> Sign Out
             </button>
          </div>
        </header>
      </div>

      <main className="max-w-[1400px] mx-auto px-8 pt-12">
        
        {/* BIG GREEN VIBE HERO BLOCK */}
        <div className="relative mb-14 group animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-[3rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
          <div className="relative bg-slate-900 rounded-[3rem] p-8 sm:p-14 overflow-hidden shadow-2xl shadow-emerald-900/10 flex">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex flex-col lg:flex-row justify-between w-full relative z-10 font-black">
               <div className="max-w-xl flex flex-col justify-center py-4">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                        <span className="text-emerald-400 text-[9px] font-medium uppercase tracking-[0.3em]">Master your potential</span>
                     </div>
                     <span className="text-slate-500 text-[9px] font-medium uppercase tracking-[0.3em]">Session active</span>
                  </div>
                  <h2 className="text-5xl sm:text-7xl font-black text-white mb-6 tracking-tighter uppercase italic leading-[0.85]">
                    Welcome back, <br/><span className="text-emerald-500 group-hover:text-emerald-400 transition-colors"> {user?.name?.split(' ')[0]}</span>
                  </h2>
                  <p className="text-slate-400 text-lg leading-relaxed max-w-sm font-medium">
                    Experience the most authentic evaluation environment designed by IIT Madras students.
                  </p>
               </div>
               
               {/* INFINITE SLIDER SECTION */}
               <div className="hidden lg:flex flex-1 relative items-center justify-end pr-10 overflow-hidden ml-10">
                  <div className="relative w-full h-[260px] flex items-center justify-end">
                    
                    {/* Slide 1: KEAM 2026 */}
                    <div className={`absolute inset-0 flex flex-col items-end justify-center transition-all duration-700 transform ${currentSlide === 0 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                        {/* Curvy Strips for Slide 1 */}
                        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 400">
                           <path d="M450 100C350 150 250 50 150 100C50 150 -50 250 -150 200" stroke="#10B981" strokeWidth="2" strokeDasharray="10 10" className="animate-[pulse_4s_infinite]" />
                           <path d="M450 200C350 250 250 150 150 200C50 250 -50 350 -150 300" stroke="#10B981" strokeWidth="1" strokeDasharray="5 5" />
                        </svg>
                        
                        <div className="text-right">
                           <div className="flex items-center gap-3 justify-end mb-4">
                              <div className="h-[1px] w-12 bg-emerald-500/50"></div>
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Current Release</span>
                           </div>
                           <h4 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">
                              KEAM<span className="text-emerald-500">2026</span>
                           </h4>
                           <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] max-w-[280px] leading-relaxed">
                              Kerala's most authentic entrance simulation <br/>designed by IIT Madras experts.
                           </p>
                        </div>
                    </div>

                    {/* Slide 2: Coming Soon */}
                    <div className={`absolute inset-0 flex flex-col items-end justify-center transition-all duration-700 transform ${currentSlide === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                        <div className="text-right">
                           <div className="flex items-center gap-3 justify-end mb-4">
                              <div className="h-[1px] w-12 bg-white/20"></div>
                              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Next Release</span>
                           </div>
                           <h4 className="text-6xl font-black text-white/20 italic tracking-tighter uppercase leading-none mb-4 flex flex-col items-end">
                              COMING <span className="text-emerald-500/30">SOON</span>
                           </h4>
                           <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.2em] max-w-[280px] leading-relaxed">
                              Olympiad & JEE Advance <br/>Standardized Mock Tests
                           </p>
                        </div>
                    </div>

                  </div>

                  {/* Infinite Dots Indicator */}
                  <div className="absolute bottom-4 flex gap-3 pr-10">
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === 0 ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-800'}`}></div>
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === 1 ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-800'}`}></div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* LEFT: ASSESSMENT LIST & RESULTS */}
          <div className="flex-1 w-full lg:max-w-none">
            
            {/* Tab Switcher */}
            <div className="flex items-center gap-6 mb-12 px-2 border-b border-slate-200 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
               <button 
                 onClick={() => setActiveTab('active')}
                 className={`pb-4 text-[11px] sm:text-sm font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'active' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Active Assessments
                 {activeTab === 'active' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-600 rounded-full"></div>}
               </button>
               <button 
                 onClick={() => setActiveTab('results')}
                 className={`pb-4 text-[11px] sm:text-sm font-black uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'results' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Recent Results
                 {activeTab === 'results' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-600 rounded-full"></div>}
               </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                {[1, 2].map(i => (
                  <div key={i} className="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse shadow-sm"></div>
                ))}
              </div>
            ) : activeTab === 'active' ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 font-black">
                {exams.map((exam, i) => (
                  <div key={exam.id} className="group relative bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[3.5rem] p-8 sm:p-12 text-white overflow-hidden shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] transition-all duration-500 animate-fade-in-up" style={{animationDelay: `${i * 100}ms`}}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-16 -translate-x-16 blur-2xl"></div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-12">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white group-hover:text-emerald-600 transition-all duration-500 shadow-xl">
                          <BookOpen size={28} />
                        </div>
                        <div className="flex items-center gap-2 italic">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Live</span>
                        </div>
                      </div>
                      
                      <div className="mb-14">
                        <h3 className="text-3xl sm:text-4xl font-black mb-4 tracking-tighter uppercase italic leading-none">{exam.title}</h3>
                        <p className="text-[14px] font-bold text-emerald-50/70 leading-relaxed max-w-sm">Standard KEAM evaluation protocol. Maintain camera focus throughout the active session.</p>
                      </div>
                      
                      <div className="mt-auto flex gap-4 mb-10">
                        <div className="flex-1 bg-white/10 backdrop-blur-sm border border-white/10 rounded-[2rem] p-5 flex flex-col gap-1 hover:bg-white/20 transition-all">
                          <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] flex items-center gap-2 mb-1">
                            <Clock size={12} /> Duration
                          </span>
                          <span className="text-xl font-black text-white italic">{exam.duration} Min</span>
                        </div>
                        <div className="flex-1 bg-white/10 backdrop-blur-sm border border-white/10 rounded-[2rem] p-5 flex flex-col gap-1 hover:bg-white/20 transition-all">
                          <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] flex items-center gap-2 mb-1">
                            <BookOpen size={12} /> Items
                          </span>
                          <span className="text-xl font-black text-white italic">{exam.questionCount} Qs</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleStartExam(exam)}
                        className="w-full py-6 bg-white text-emerald-700 hover:bg-slate-900 hover:text-white font-black text-[12px] uppercase tracking-[0.4em] rounded-[2rem] transition-all shadow-2xl shadow-black/20 active:scale-95 group/btn flex items-center justify-center gap-4 relative overflow-hidden"
                      >
                         BEGIN EVALUATION <ChevronRight size={18} className="group-hover/btn:translate-x-2 transition-transform duration-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* RECENT RESULTS VIEW */
              <div className="space-y-6 font-black">
                {recentSubmissions.length === 0 ? (
                  <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-200 shadow-sm border-dashed">
                    <p className="text-slate-400 uppercase tracking-widest text-xs">No examination history found.</p>
                  </div>
                ) : (
                  recentSubmissions.map((sub, i) => (
                    <div key={sub.id} className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 group hover:border-emerald-200 transition-all animate-fade-in-up" style={{animationDelay: `${i * 100}ms`}}>
                       <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex flex-col items-center justify-center border border-emerald-100 group-hover:bg-slate-900 group-hover:text-emerald-400 transition-all duration-500">
                          <span className="text-[10px] uppercase text-emerald-600 group-hover:text-emerald-500/50 leading-none mb-1">Score</span>
                          <span className="text-2xl italic font-black">{sub.final_score ?? 'N/A'}</span>
                       </div>
                       <div className="flex-1 text-center md:text-left">
                          <h4 className="text-xl sm:text-2xl text-slate-900 uppercase italic tracking-tighter mb-2">{sub.exam?.title}</h4>
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                             <span className="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <Clock size={12} /> {new Date(sub.submitted_at).toLocaleDateString()} at {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] text-slate-500 uppercase tracking-widest border border-slate-200">Attempt ID: #{sub.id}</span>
                          </div>
                       </div>
                       <button 
                         onClick={() => navigate(`/analysis/${sub.id}`)}
                         className="px-8 py-4 bg-slate-50 hover:bg-slate-900 text-slate-600 hover:text-white border border-slate-200 hover:border-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 active:scale-95"
                       >
                         View Analysis <ChevronRight size={16} />
                       </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* RIGHT: DYNAMIC HUB SIDEBAR */}
          <div className="w-full lg:w-[420px] shrink-0 animate-fade-in font-black" style={{animationDelay: '300ms'}}>
            <div className="space-y-8 sticky top-32">
              
              {/* Topper's Roadmap Card */}
              <div className="bg-white rounded-[3.5rem] p-10 border border-slate-200 shadow-sm group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full -translate-y-16 translate-x-16"></div>
                
                <div className="flex items-center gap-4 mb-8 relative z-10 transition-transform group-hover:translate-x-2">
                   <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100 group-hover:bg-slate-900 group-hover:text-emerald-400 transition-all duration-500">
                      <ShieldCheck size={22} />
                   </div>
                   <div className="font-black">
                      <h5 className="text-[12px] text-slate-900 uppercase tracking-widest italic leading-none">Topper's Roadmap</h5>
                      <p className="text-[9px] text-emerald-600 uppercase tracking-widest mt-2">Last 72 Hours Strategy</p>
                   </div>
                </div>

                <div className="space-y-6 relative z-10">
                  {[
                    { t: 'Phase Strategy', d: 'Sweep easy questions first. Leave tough ones for Round 2.' },
                    { t: 'Time Management', d: 'Strict 1-minute rule. Skip if you hit the 90-second mark.' },
                    { t: 'Elimination Tactic', d: 'Rule out obviously wrong options before guessing to boost odds.' },
                    { t: 'Panic Control', d: 'Tough sections are tough for everyone. Shift to your strong subject.' }
                  ].map((tip, idx) => (
                    <div key={idx} className="flex gap-4 group/tip">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 group-hover/tip:scale-150 transition-transform"></div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase italic leading-none mb-1 group-hover/tip:text-emerald-600 transition-colors">{tip.t}</p>
                        <p className="text-[11px] font-bold text-slate-400 leading-snug">{tip.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Community Link */}
              <div onClick={() => window.open('https://chat.whatsapp.com/HkuPHoJKRYF8txORB4Eswm?mode=gi_t', '_blank')} className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[3.5rem] p-12 text-white relative overflow-hidden group shadow-2xl shadow-emerald-500/20 cursor-pointer">
                <MessageCircle size={100} className="text-white/10 absolute -bottom-8 -right-8 -rotate-12 group-hover:scale-110 transition-transform duration-700" />
                <div className="relative z-10 font-black">
                   <h5 className="text-3xl uppercase italic tracking-tighter mb-4 leading-none">IITM <br/>Cohort</h5>
                   <p className="text-[12px] font-bold text-emerald-100/60 leading-relaxed mb-10 max-w-[180px]">Real-time prep materials directly from IITians.</p>
                   <button className="flex items-center gap-3 text-[11px] uppercase tracking-widest hover:translate-x-2 transition-transform">
                      Join Community <ArrowUpRight size={16} />
                   </button>
                </div>
              </div>

              {/* Global Signature */}
              <div className="pt-10 border-t border-slate-100 text-center font-black">
                 <p 
                  onClick={() => window.open('https://tensors.in', '_blank')}
                  className="text-[11px] text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-[0.3em] cursor-pointer"
                 >
                   TENSORS.IN
                 </p>
                 <p className="text-[9px] text-slate-300 uppercase tracking-[0.2em] mt-5 italic">© 2026 Tensors WebOps · Student Driven</p>
              </div>

            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default Dashboard;