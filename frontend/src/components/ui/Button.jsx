import clsx from 'clsx'
import Spinner from './Spinner'

const variantClass = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 disabled:bg-sky-300',
  secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 active:bg-slate-400 disabled:bg-slate-100',
  success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-green-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
}

const sizeClass = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
        variantClass[variant],
        sizeClass[size],
        isDisabled && 'cursor-not-allowed',
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}
