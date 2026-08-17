import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Loader2, Key, User as UserIcon, BookOpen, ShieldCheck, ArrowRight, Phone, Mail, UserPlus, CheckCircle2 } from 'lucide-react';
import { authApi, saveSession } from '../api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loginMode, setLoginMode] = useState<'student' | 'admin' | 'register'>('student');
  
  // Registration States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regInstitution, setRegInstitution] = useState('');
  const [registeredCode, setRegisteredCode] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (loginMode === 'admin') {
        res = await authApi.login(email.trim(), password);
      } else {
        res = await authApi.studentLogin(email.trim(), accessCode.trim());
      }
      
      saveSession(res.access_token, res.user);
      if (res.user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.requestOtp(regName, regEmail, regPhone, regInstitution);
      setRegisteredCode(res.access_code);
      setSuccess('Registration successful! Please save your access code below.');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Removed handleVerifyOtp as registration is immediate

  const handleCopyToLogin = () => {
    setEmail(regEmail);
    setAccessCode(registeredCode);
    setLoginMode('student');
    setRegisteredCode('');
    setRegName('');
    setRegEmail('');
    setRegPhone('');
    setRegInstitution('');
    setSuccess('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex font-['Outfit'] relative overflow-hidden">
      
      {/* Decorative Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1600px] h-[1600px] bg-emerald-500/5 rounded-full blur-[200px] pointer-events-none"></div>

      {/* LEFT SECTION */}
      <div className="hidden lg:flex w-[45%] flex-col justify-between p-20 relative z-10 bg-slate-900/20 border-r border-white/5 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-4 mb-20 animate-fade-in">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl group cursor-pointer transition-transform hover:scale-105">
              <GraduationCap size={24} className="text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
                Tensors<span className="text-emerald-500">LMS</span>
              </h1>
              <p className="text-[8px] uppercase font-black tracking-[0.4em] text-slate-500 mt-1">Assessment Portal</p>
            </div>
          </div>
          
          <div className="animate-fade-in-up" style={{animationDelay: '200ms'}}>
            <div className="flex items-center gap-3 mb-8">
               <div className="h-[1px] w-12 bg-emerald-600"></div>
               <span className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.4em]">Official Entrance Prep</span>
            </div>
            <h2 className="text-5xl xl:text-7xl font-black text-white leading-[0.9] mb-10 tracking-tighter uppercase italic">
              KEAM 2026 <br/><span className="text-emerald-500">Online</span> <br/>Mock Exam.
            </h2>
            <p className="text-slate-400 text-lg font-bold max-w-sm leading-relaxed mb-12">
               Access codes are generated instantly. Enter your details and start your examination immediately.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 animate-fade-in" style={{animationDelay: '1000ms'}}>
          <div className="flex flex-col items-start gap-1.5">
             <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Powered By</span>
             <img src="/eduport.png" alt="Eduport" className="h-6 object-contain opacity-70 hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-3 text-slate-600 text-[9px] font-black uppercase tracking-[0.3em]">
            <BookOpen size={14} />
            <span>© 2026 Tensors WebOps. LMS Core.</span>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="w-full lg:w-[55%] flex flex-col items-center justify-center p-8 relative z-10">
        
        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-10 xl:p-14 shadow-[0_32px_128px_-32px_rgba(0,0,0,0.8)] animate-fade-in">
          
          <div className="flex flex-col items-center text-center mb-10">
            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-3">
               {loginMode === 'register' ? 'Register' : 'Login'}
            </h2>
            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 bg-emerald-500/5 rounded-full border border-emerald-500/20">
               <ShieldCheck size={12} /> Secure Access Protocol
            </div>
          </div>

          {(error || success) && (
            <div className={`mb-8 p-4 border rounded-2xl text-[11px] font-black uppercase tracking-widest text-center animate-fade-in ${error ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
              {error || success}
            </div>
          )}

          {loginMode === 'register' ? (
             registeredCode ? (
                <div className="space-y-8 animate-fade-in">
                   <div className="p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-center relative group">
                      <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-6" />
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 leading-none">Your Access Code</p>
                      <h3 className="text-3xl md:text-5xl font-black text-white italic tracking-[0.1em] md:tracking-[0.2em] mb-4 leading-none">{registeredCode}</h3>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(registeredCode);
                          setSuccess('Code copied to clipboard!');
                        }}
                        className="text-[9px] font-black text-emerald-500 hover:text-white uppercase tracking-widest underline underline-offset-4 cursor-pointer"
                      >
                         Click to Copy Code
                      </button>
                      <p className="text-slate-500 text-[10px] font-bold leading-relaxed mt-6">
                         IMPORTANT: Use this code to login for your KEAM Mock Exams.
                      </p>
                   </div>
                   <button 
                     onClick={handleCopyToLogin}
                     className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95"
                   >
                     Continue to Login <ArrowRight size={18} />
                   </button>
                </div>
             ) : (
                <form onSubmit={handleRequestOtp} className="space-y-4 animate-fade-in">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <input 
                          type="text" 
                          placeholder="YOUR FULL NAME" 
                          value={regName}
                          onChange={e => setRegName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/5 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-bold text-[11px] uppercase"
                          required
                        />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <input 
                          type="email" 
                          placeholder="EMAIL@EXAMPLE.COM" 
                          value={regEmail}
                          onChange={e => setRegEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/5 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-bold text-[11px] lowercase"
                          required
                        />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Mobile Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <input 
                          type="tel" 
                          placeholder="PHONE NUMBER" 
                          value={regPhone}
                          onChange={e => setRegPhone(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/5 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-bold text-[11px]"
                          required
                        />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Institution / School (Optional)</label>
                      <div className="relative">
                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <input 
                          type="text" 
                          placeholder="SCHOOL OR COLLEGE NAME" 
                          value={regInstitution}
                          onChange={e => setRegInstitution(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/5 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-bold text-[11px] uppercase"
                        />
                      </div>
                   </div>
                   <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl transition-all shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] active:scale-95 mt-4"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <>Register & Get Passcode <ArrowRight size={18} /></>}
                    </button>
                    <button type="button" onClick={() => setLoginMode('student')} className="w-full text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-widest mt-2">Already registered? Login here</button>
                </form>
             )
          ) : (
            /* LOGIN FLOW */
            <>
              {/* Mode Switcher */}
              <div className="flex bg-black/40 rounded-2xl p-1.5 mb-10 border border-white/5">
                <button
                  onClick={() => { setLoginMode('student'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    loginMode === 'student' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  <UserIcon size={14} /> Student
                </button>
                <button
                  onClick={() => { setLoginMode('admin'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    loginMode === 'admin' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  <Key size={14} /> Admin
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Account Email</label>
                  <input 
                    type="email" 
                    placeholder="EMAIL@EXAMPLE.COM" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-6 py-5 bg-black/30 border border-white/5 rounded-2xl text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-bold text-sm lowercase"
                    required
                  />
                </div>
                
                {loginMode === 'admin' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Account Password</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        placeholder="PASSWORD" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-6 py-5 bg-black/30 border border-white/5 rounded-2xl text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-bold text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-700 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entry Code</label>
                    </div>
                    <input 
                      type="text"
                      placeholder="ENTRY CODE" 
                      value={accessCode}
                      onChange={e => setAccessCode(e.target.value.toUpperCase())}
                      className="w-full px-6 py-5 bg-black/30 border border-white/5 rounded-2xl text-emerald-500 focus:outline-none focus:border-emerald-500 transition-all font-black tracking-widest text-center text-xl placeholder:text-slate-800 placeholder:text-xs placeholder:tracking-[0.2em] uppercase shadow-inner"
                      maxLength={10}
                      required
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-6 rounded-2xl transition-all shadow-2xl flex items-center justify-center gap-3 mt-12 text-xs uppercase tracking-[0.3em] active:scale-95"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Sign In Securely <ArrowRight size={18} /></>}
                </button>

                {loginMode === 'student' && (
                   <button 
                     type="button"
                     onClick={() => { setLoginMode('register'); setError(''); setSuccess(''); }}
                     className="w-full mt-6 py-4 border border-white/5 rounded-2xl text-[10px] font-black text-slate-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                   >
                     <UserPlus size={14} /> New Student? Register Yourself
                   </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
