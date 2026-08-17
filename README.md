# LMS Frontend

Single-page React application for the Tensors online examination platform. It provides the student exam experience (login, terms, timed test, result analysis) and the administrator console (exams, questions, users, submissions and live monitoring).

The app is a pure frontend — it talks to a separate LMS backend over REST and is served in production as static files behind Nginx.

## Features

### Students

- **Two ways to sign in** — email + password, or email + a one-time **access code** issued during registration.
- **Self-registration with OTP** — request an OTP by name/email/phone/institution, verify it, and receive an access code.
- **Terms & instructions screen** that must be acknowledged before an attempt starts.
- **Timed exam runner** with a live countdown that auto-submits when the clock hits zero.
- **KaTeX-rendered questions** so mathematical notation displays correctly (includes a small CSS patch that stops Tailwind's SVG reset from breaking radical symbols).
- **Answer autosave** every 30 seconds, plus answer restore — reopening an in-progress attempt reloads previously saved answers from the server.
- **Question palette** tracking visited, answered and flagged questions, with flags persisted server-side.
- **Paginated question loading** that prefetches the next page as the student nears the end of the current one.
- **Result analysis** per submission, reachable from the dashboard.

### Administrators

- **Dashboard stats** — exam, question, user and submission totals plus average score.
- **Exam CRUD** and **question CRUD**, including bulk question creation and image upload for question figures.
- **User management** — add students individually or via bulk file upload, regenerate access codes, reset a student's attempt, edit or delete users.
- **Submission tools** — inspect submissions, override a score, force-recalculate one or all scores, and export a CSV of results.
- **Live monitoring tab** that polls every 15 seconds for exam violations and warning counts, sortable by score or violations, with a bulk "clear violations" action.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 (via `@tailwindcss/vite`) |
| Icons | lucide-react |
| Math rendering | KaTeX |
| Linting | ESLint 9 + typescript-eslint |
| Runtime image | Node 20 (build) → Nginx alpine (serve) |

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

The dev server prints a local URL (Vite's default is <http://localhost:5173>).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check with `tsc -b`, then produce a production build in `dist/` |
| `npm run lint` | Run ESLint over the project |
| `npm run preview` | Serve the built `dist/` locally |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the LMS backend API |

`VITE_API_URL` is read in `src/api.ts` and falls back to `http://localhost:3000` when unset, which is the usual local-development setup. In production it is baked into the bundle at build time — the Dockerfile accepts it as a `--build-arg`, and it is normally pointed at the Nginx-proxied `/api` path rather than at the backend directly.

Vite only exposes variables prefixed with `VITE_` to client code. Everything in this file ships to the browser, so never put secrets in it.

## Project structure

```
src/
├── api.ts                 # Fetch wrapper, API modules, shared types, session helpers
├── App.tsx                # Router and auth guards
├── main.tsx               # Entry point
├── components/
│   └── Navbar.tsx
└── pages/
    ├── Login.tsx          # Password login, access-code login, OTP registration
    ├── Dashboard.tsx      # Available exams and recent submissions
    ├── Terms.tsx          # Instructions and consent before an attempt
    ├── Exam.tsx           # Timed exam runner
    ├── ResultAnalysis.tsx # Per-submission breakdown
    └── AdminDashboard.tsx # Admin console
```

### Routes

| Path | Access | Screen |
| --- | --- | --- |
| `/login` | Public | Login and registration |
| `/dashboard` | Authenticated | Exam list and recent submissions |
| `/terms` | Authenticated | Pre-exam instructions |
| `/exam` | Authenticated | Exam runner |
| `/analysis/:id` | Authenticated | Result analysis for a submission |
| `/admin` | Admin only | Admin console |

`/` and any unmatched path redirect to `/login`. Guards live in `App.tsx`: `RequireAuth` redirects anonymous visitors to `/login`, and `RequireAdmin` additionally bounces non-admins to `/dashboard`.

## API layer

`src/api.ts` is the single place the frontend talks to the backend. It exposes four grouped clients — `authApi`, `examApi`, `answerApi` and `adminApi` — over a shared `request()` helper that attaches the JSON content type, adds the bearer token when present, and converts a non-OK response into an `Error` carrying the backend's `message`.

Sessions are kept in `localStorage` under `lms_token` (JWT) and `lms_user` (the serialized user), managed through `saveSession()`, `getSession()`, `clearSession()` and `isAdmin()`.

Note that the guards are client-side only — they control what the UI shows, not what the API allows. The backend remains the authority on authorization.

## Deployment

The `Dockerfile` is a two-stage build: Node 20 installs dependencies and runs `npm run build`, then the static `dist/` output is copied into an `nginx:alpine` image alongside `nginx.conf`. The container listens on port 80.

```bash
docker build --build-arg VITE_API_URL=https://exam.tensors.in/api -t lms-frontend .
docker run -p 80:80 lms-frontend
```

`nginx.conf` handles three things:

1. **SPA routing** — `try_files $uri $uri/ /index.html`, so client-side routes survive a hard refresh.
2. **API proxying** — `/api/` is proxied to the `backend:3000` upstream with WebSocket upgrade headers. The upstream uses `ip_hash` for sticky sessions, which keeps a client pinned to one backend replica across the three-replica deployment.
3. **Uploads** — `/uploads/` is proxied to the backend so question images resolve.

The `server_name` is set to `exam.tensors.in`; change it if you deploy elsewhere.

---

## Appendix: Vite template notes

The notes below come from the original `create-vite` React + TypeScript template this project was scaffolded from.

### React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
