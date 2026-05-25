import clsx from 'clsx'

export default function Card({ title, subtitle, footer, className, children }) {
  return (
    <section className={clsx('rounded-2xl border border-slate-200/75 bg-white/90 p-6 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm', className)}>
      {title || subtitle ? (
        <header className="mb-5">
          {title ? <h3 className="text-lg font-semibold text-slate-900">{title}</h3> : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </header>
      ) : null}
      <div>{children}</div>
      {footer ? <footer className="mt-5 border-t border-slate-100 pt-4">{footer}</footer> : null}
    </section>
  )
}
