import { NavLink } from 'react-router-dom'
import { FeatureIcon } from './Icons'

export function AuthLayout({ title, subtitle, children }) {
  return (
    <section className="pageWrap authPage pageEnter" aria-labelledby="auth-page-title">
      <article className="card authCard cardEnter">
        <header>
          <h2 id="auth-page-title">{title}</h2>
          <p>{subtitle}</p>
        </header>
        {children}
      </article>
    </section>
  )
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <header className="pageHeader">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </header>
  )
}

export function AppSidebar({ appName, user, navItems, sessionLabel, onLogout, mobileOpen, onToggleMobile, onNavigate }) {
  return (
    <>
      <div className="mobileTopbar">
        <button type="button" className="secondary mobileMenuBtn" onClick={onToggleMobile} aria-label="Toggle navigation menu" aria-expanded={mobileOpen}>
          Menu
        </button>
        <div className="mobileBrand">{appName}</div>
      </div>
      <button type="button" className={`drawerBackdrop ${mobileOpen ? 'show' : ''}`} onClick={onToggleMobile} aria-label="Close navigation menu" />
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Primary navigation">
      <div className="brand">
        <h1>{appName}</h1>
        <p>Secure Digital Banking</p>
      </div>

      <nav className="flex-1" aria-label="Feature pages">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              const baseClasses = 'navLink flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all duration-180'
              const activeClasses = 'bg-sky-50 border-sky-300 text-slate-900'
              const inactiveClasses = 'text-slate-700 hover:bg-slate-100 border-transparent'
              return isActive ? `${baseClasses} ${activeClasses} border` : `${baseClasses} ${inactiveClasses} border`
            }}
            onClick={onNavigate}
          >
            <FeatureIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="sidebarFooter">
          <p className="sessionHint text-xs font-semibold text-slate-600 mb-3">Session: {sessionLabel}</p>
          <button type="button" onClick={onLogout} className="fullBtn w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm transition-colors duration-150" aria-label="Logout">
            Sign Out
          </button>
        </div>
      )}
      </aside>
    </>
  )
}

export function NoticeStack({ message, error }) {
  if (!message && !error) return null
  return (
    <section className="toastArea" aria-live="polite" aria-atomic="true">
      {message && <p className="notice success">{message}</p>}
      {error && <p className="notice error">{error}</p>}
    </section>
  )
}

export function DevHelpers({ devResetToken, onCopy }) {
  if (!devResetToken) return null

  return (
    <section className="card devPanel cardEnter" aria-label="Development helpers">
      <h2>Development Helpers</h2>
      {devResetToken && (
        <div className="devItem">
          <span>Dev Reset Token</span>
          <code>{devResetToken}</code>
          <button type="button" className="secondary" onClick={() => onCopy(devResetToken, 'Reset token')}>Copy token</button>
        </div>
      )}
    </section>
  )
}
