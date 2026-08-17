const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return localStorage.getItem('lms_token');
}

function getHeaders(auth = true): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── AUTH ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: getHeaders(false),
    }),

  studentLogin: (email: string, access_code: string) =>
    request<{ access_token: string; user: User }>('/auth/student-login', {
      method: 'POST',
      body: JSON.stringify({ email, access_code }),
      headers: getHeaders(false),
    }),

  register: (name: string, email: string, password: string, role = 'student') =>
    request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
      headers: getHeaders(false),
    }),

  getProfile: () => request<User>('/auth/profile'),

  requestOtp: (name: string, email: string, phone: string, institution?: string) => 
    request<{ message: string; access_code: string; name: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, institution }),
      headers: getHeaders(false),
    }),

  verifyOtp: (email: string, phone: string, otp: string) => 
    request<{ message: string; access_code: string; name: string; email: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, phone, otp }),
      headers: getHeaders(false),
    }),
};

// ── EXAM (student) ────────────────────────────────────────────────────────
export const examApi = {
  listExams: () => request<ExamWithStats[]>('/exam'),

  startExam: (examId: number) =>
    request<{ message: string; submissionId: number; duration: number; answers?: Record<string, string> }>(`/exam/${examId}/start`, { method: 'POST' }),

  getQuestions: (examId: number, page = 1, limit = 10) =>
    request<{ data: Question[]; total: number; page: number; lastPage: number }>(
      `/exam/${examId}/questions?page=${page}&limit=${limit}`,
    ),

  submitExam: (examId: number) =>
    request<{ message: string; score: number; submissionId: number }>(`/exam/${examId}/submit`, { method: 'POST' }),

  toggleFlag: (examId: number, questionId: number) =>
    request<{ flagged: boolean }>(`/exam/${examId}/questions/${questionId}/toggle-flag`, { method: 'POST' }),

  reportViolation: (type: string, snapshot?: string) =>
    request<{ warnings: number; paused: boolean }>('/exam/violation', { 
      method: 'POST',
      body: JSON.stringify({ type, snapshot })
    }),

  getRecentSubmissions: () => request<Submission[]>('/exam/recent-submissions'),

  getSubmissionAnalysis: (submissionId: number) => 
    request<{ submission: Submission; analysis: any[] }>(`/exam/submissions/${submissionId}/analysis`),
};

// ── ANSWER ────────────────────────────────────────────────────────────────
export const answerApi = {
  saveAnswers: (examId: number, answers: Record<string, string>) =>
    request('/answer/save-answer', {
      method: 'POST',
      body: JSON.stringify({ examId, answers }),
    }),
};

// ── ADMIN ─────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => request<AdminStats>('/admin/stats'),

  // Exams
  getExams: () => request<ExamWithStats[]>('/admin/exams'),
  getExam: (id: number) => request<Exam>(`/admin/exams/${id}`),
  createExam: (data: Partial<Exam>) =>
    request<Exam>('/admin/exams', { method: 'POST', body: JSON.stringify(data) }),
  updateExam: (id: number, data: Partial<Exam>) =>
    request<Exam>(`/admin/exams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExam: (id: number) =>
    request<{ message: string }>(`/admin/exams/${id}`, { method: 'DELETE' }),

  // Questions
  getQuestions: (examId: number) => request<Question[]>(`/admin/exams/${examId}/questions`),
  createQuestion: (data: Partial<Question>) =>
    request<Question>('/admin/questions', { method: 'POST', body: JSON.stringify(data) }),
  bulkCreateQuestions: (examId: number, questions: Partial<Question>[]) =>
    request<Question[]>(`/admin/exams/${examId}/questions/bulk`, {
      method: 'POST',
      body: JSON.stringify({ questions }),
    }),
  updateQuestion: (id: number, data: Partial<Question>) =>
    request<Question>(`/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuestion: (id: number) =>
    request<{ message: string }>(`/admin/questions/${id}`, { method: 'DELETE' }),

  // Image Upload
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const token = localStorage.getItem('lms_token');
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE_URL}/admin/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const d = await res.json(); msg = d.message || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  // Users
  getUsers: () => request<User[]>('/admin/users'),
  getUser: (id: number) => request<User>(`/admin/users/${id}`),
  updateUser: (id: number, data: Partial<User>) =>
    request<User>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    request<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),

  addStudent: (data: { name: string; email: string }) =>
    request<User>('/admin/users/student', { method: 'POST', body: JSON.stringify(data) }),

  bulkUploadUsers: async (file: File): Promise<any> => {
    const token = localStorage.getItem('lms_token');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/admin/users/bulk-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const d = await res.json(); msg = d.message || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  regenerateAccessCode: (id: number) =>
    request<User>(`/admin/users/${id}/regenerate-code`, { method: 'POST' }),

  resetAttempt: (id: number) =>
    request<User>(`/admin/users/${id}/reset-attempt`, { method: 'POST' }),

  // Submissions / Monitoring
  getSubmissions: (examId?: number) =>
    request<Submission[]>(`/admin/submissions${examId ? `?examId=${examId}` : ''}`),
  getSubmissionDetail: (id: number) => request<Submission>(`/admin/submissions/${id}`),
  overrideScore: (id: number, score: number) =>
    request(`/admin/submissions/${id}/score`, { method: 'PATCH', body: JSON.stringify({ score }) }),
  forceCalculateScore: (id: number) =>
    request<{ message: string; score: number }>(`/admin/submissions/${id}/calculate`, { method: 'POST' }),
  bulkForceCalculateScores: (examId?: number) =>
    request<{ message: string; success: number; failed: number }>(`/admin/submissions/bulk-calculate${examId ? `?examId=${examId}` : ''}`, { method: 'POST' }),
  clearViolations: () => request<{ message: string }>('/admin/violations', { method: 'DELETE' }),

  getQuestionFlags: () => request<QuestionFlag[]>('/admin/question-flags'),
};

// ── TYPES ─────────────────────────────────────────────────────────────────
export interface QuestionFlag {
  id: number;
  user_id: number;
  question_id: number;
  exam_id: number;
  created_at: string;
  user?: User;
  question?: Question;
  exam?: Exam;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  access_code?: string;
  institution?: string;
  warning_count?: number;
  is_exam_active?: boolean;
  has_completed_exam?: boolean;
  created_at?: string;
}

export interface Exam {
  id: number;
  title: string;
  description?: string;
  duration: number;
  is_active: boolean;
  created_at?: string;
}

export interface ExamWithStats extends Exam {
  questionCount: number;
  submissionCount: number;
}

export interface Question {
  id: number;
  exam_id: number;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  image_url?: string | null;
}

export interface Submission {
  id: number;
  user_id: number;
  exam_id: number;
  final_score?: number;
  submitted_at: string;
  user?: User;
  exam?: Exam;
  answers?: any[];
}

export interface AdminStats {
  totalExams: number;
  totalQuestions: number;
  totalUsers: number;
  totalSubmissions: number;
  avgScore: number;
  recentSubmissions: Submission[];
}

// ── SESSION HELPERS ────────────────────────────────────────────────────────
export function saveSession(token: string, user: User) {
  localStorage.setItem('lms_token', token);
  localStorage.setItem('lms_user', JSON.stringify(user));
}

export function getSession(): User | null {
  try {
    const raw = localStorage.getItem('lms_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSession() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
}

export function isAdmin(): boolean {
  return getSession()?.role === 'admin';
}
