// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Background surfaces ─────────────────────────────────
        'bg-deepest':  '#1e1f22',   // outermost shell / page bg
        'bg-sidebar':  '#2b2d31',   // chat list, modals, popovers
        'bg-chat':     '#313338',   // chat window, main content
        'bg-hover':    '#35373c',   // list row hover
        'bg-active':   '#404249',   // selected list row

        // ── Text ────────────────────────────────────────────────
        'text-normal': '#dbdee1',   // body text
        'text-muted':  '#949ba4',   // secondary text, timestamps

        // ── Brand ───────────────────────────────────────────────
        accent:  '#5865f2',         // primary buttons, links, active
        danger:  '#da373c',         // destructive actions

        // ── Presence dots ───────────────────────────────────────
        online:  '#23a55a',
        idle:    '#f0b232',
        dnd:     '#f23f43',
        offline: '#80848e',
      },
      borderRadius: {
        card:   '8px',
        modal:  '12px',
        avatar: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;