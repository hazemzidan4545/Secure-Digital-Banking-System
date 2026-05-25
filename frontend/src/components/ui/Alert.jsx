import { useState } from 'react'
import clsx from 'clsx'

const styleMap = {
  success: 'border-green-200 bg-green-50 text-green-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
}

const iconMap = {
  success: '✓',
  danger: '!',
  warning: '⚠',
  info: 'i',
}

export default function Alert({ type = 'info', title, children, dismissible = true }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', styleMap[type])} role="alert">
      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/20 bg-white/70 text-xs font-bold">
        {iconMap[type]}
      </span>
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
      {dismissible ? (
        <button
          type="button"
          aria-label="Dismiss alert"
          className="rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-black/5"
          onClick={() => setVisible(false)}
        >
          Close
        </button>
      ) : null}
    </div>
  )
}
