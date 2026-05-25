import clsx from 'clsx'

export default function Input({
  label,
  required = false,
  error,
  hint,
  id,
  className,
  ...props
}) {
  return (
    <label className="block space-y-2">
      {label ? (
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="ml-1 text-red-600">*</span> : null}
        </span>
      ) : null}
      <input
        id={id}
        className={clsx(
          'w-full rounded-2xl border bg-white/95 px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition duration-200 placeholder:text-slate-500',
          error
            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
            : 'border-blue-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </label>
  )
}
