export function getPasswordPolicyErrors(password) {
  const value = String(password || '')
  const errors = []
  if (value.length < 10) errors.push('at least 10 characters')
  if (!/[a-z]/.test(value)) errors.push('one lowercase letter')
  if (!/[A-Z]/.test(value)) errors.push('one uppercase letter')
  if (!/[0-9]/.test(value)) errors.push('one number')
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('one special character')
  return errors
}

export function getPasswordStrength(password) {
  const value = String(password || '')
  let score = 0
  if (value.length >= 10) score += 1
  if (/[a-z]/.test(value)) score += 1
  if (/[A-Z]/.test(value)) score += 1
  if (/[0-9]/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}

export function strengthLabel(score) {
  if (score <= 2) return 'Weak'
  if (score <= 4) return 'Medium'
  return 'Strong'
}

export function formatRemaining(seconds) {
  const safe = Math.max(0, Number(seconds || 0))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
