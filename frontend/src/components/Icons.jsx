export function FeatureIcon({ name }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.9', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

  if (name === 'dashboard') return <svg {...common}><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></svg>
  if (name === 'home') return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>
  if (name === 'accounts') return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><path d="M7 14h4" /></svg>
  if (name === 'profile') return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></svg>
  if (name === 'security') return <svg {...common}><path d="M12 3 5 6v6c0 5 3.6 8.7 7 9.8 3.4-1.1 7-4.8 7-9.8V6l-7-3z" /><path d="m9 12 2 2 4-4" /></svg>
  if (name === 'support') return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>
  if (name === 'cards') return <svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /><path d="M6 14h4" /></svg>
  if (name === 'loans') return <svg {...common}><path d="M4 7h16" /><path d="M4 12h10" /><path d="M4 17h6" /><circle cx="18" cy="16" r="3" /><path d="M18 13v6" /><path d="M15 16h6" /></svg>
  if (name === 'bills') return <svg {...common}><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" /><path d="M9 8h6" /><path d="M9 12h6" /></svg>
  if (name === 'transfer') return <svg {...common}><path d="M5 7h14" /><path d="M15 3l4 4-4 4" /><path d="M19 17H5" /><path d="M9 13l-4 4 4 4" /></svg>
  if (name === 'transactions') return <svg {...common}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /></svg>
  if (name === 'statements') return <svg {...common}><path d="M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>
  if (name === 'notifications') return <svg {...common}><path d="M15 17H5.5a2.5 2.5 0 0 1-2.5-2.5V10a9 9 0 1 1 18 0v4.5a2.5 2.5 0 0 1-2.5 2.5H15" /><path d="M9 17a3 3 0 0 0 6 0" /></svg>
  if (name === 'audit') return <svg {...common}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 13h6" /><path d="M9 17h6" /></svg>
  if (name === 'suspicious') return <svg {...common}><path d="M12 3 2 21h20L12 3z" /><path d="M12 9v5" /><circle cx="12" cy="17" r="1" /></svg>
  if (name === 'providers') return <svg {...common}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="12" cy="17" r="2" /></svg>
  if (name === 'adminUsers') return <svg {...common}><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M2 20c0-3 2.7-5 6-5" /><path d="M10 20c0-3 2.7-5 6-5" /></svg>
  if (name === 'adminCards') return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 14h4" /><path d="M18 3v4" /></svg>
  if (name === 'adminNotifications') return <svg {...common}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  if (name === 'adminTransactions') return <svg {...common}><path d="M5 7h14" /><path d="M15 3l4 4-4 4" /><path d="M19 17H5" /><path d="M9 13l-4 4 4 4" /></svg>
  if (name === 'login') return <svg {...common}><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></svg>
  if (name === 'register') return <svg {...common}><circle cx="9" cy="8" r="4" /><path d="M3 21c0-3.3 2.7-6 6-6" /><path d="M16 11v8" /><path d="M12 15h8" /></svg>
  if (name === 'mfa') return <svg {...common}><rect x="6" y="10" width="12" height="10" rx="2" /><path d="M8 10V8a4 4 0 0 1 8 0v2" /></svg>
  if (name === 'reset') return <svg {...common}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
  return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
}

export function SecurityIllustration() {
  return (
    <svg className="securityIllustration" viewBox="0 0 280 120" aria-hidden="true">
      <rect x="8" y="22" width="264" height="90" rx="16" fill="rgba(255,255,255,0.85)" stroke="rgba(148,163,184,0.5)" />
      <rect x="26" y="40" width="70" height="52" rx="10" fill="rgba(14,116,144,0.15)" />
      <path d="M61 52a9 9 0 0 1 9 9v5h-6v-5a3 3 0 0 0-6 0v5h-6v-5a9 9 0 0 1 9-9z" fill="rgba(14,116,144,0.7)" />
      <rect x="50" y="66" width="22" height="18" rx="4" fill="rgba(14,116,144,0.8)" />
      <circle cx="61" cy="75" r="2.4" fill="#e2e8f0" />
      <rect x="112" y="42" width="146" height="10" rx="5" fill="rgba(148,163,184,0.45)" />
      <rect x="112" y="59" width="118" height="10" rx="5" fill="rgba(148,163,184,0.35)" />
      <rect x="112" y="76" width="94" height="10" rx="5" fill="rgba(148,163,184,0.28)" />
      <circle cx="242" cy="83" r="10" fill="rgba(34,197,94,0.2)" />
      <path d="m237 83 3 3 6-6" stroke="rgba(22,163,74,0.9)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
