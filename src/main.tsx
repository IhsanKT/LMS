import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Fix Tailwind v4 preflight overriding KaTeX SVG display.
// Must run before any component renders.
const _katexFix = document.createElement('style');
_katexFix.textContent = `
  .katex svg { display: inline !important; max-width: none !important; overflow: visible !important; }
  .katex .hide-tail { overflow: hidden !important; }
  .katex .hide-tail svg { display: block !important; max-width: none !important; width: 100% !important; height: 100% !important; }
  .katex svg path { fill: currentColor !important; }
`;
document.head.appendChild(_katexFix);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
