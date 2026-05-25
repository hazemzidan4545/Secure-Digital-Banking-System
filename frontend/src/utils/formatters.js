export function formatCurrency(value, currency = 'EGP') {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export function getStatusTone(status) {
  const normalized = String(status || 'completed').toLowerCase()
  if (['rejected', 'failed', 'error', 'cancelled', 'reversed', 'lost', 'inactive', 'blocked'].includes(normalized)) return 'danger'
  if (['pending', 'queued', 'scheduled', 'in_progress', 'frozen'].includes(normalized)) return 'warning'
  return 'success'
}
