import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from './api'
import { APP_NAME } from './constants'
import { AppSidebar, NoticeStack } from './components/Layout'
import { PrivateRoute, AdminRoute, UserRoute } from './components/RouteGuards'
import { LoginPage, RegisterPage, MfaPage, ResetRequestPage, ResetConfirmPage } from './pages/AuthPages'
import { LandingPage, DashboardPage, AccountsPage, ProfilePage, TransferPage, TransactionsPage, StatementsPage, NotificationsPage, SecurityPage, VerifyEmailPage, SupportPage, CardsPage } from './pages/AccountPages'
import { LoanApplicationPage, LoanListPage, LoanDetailsPage } from './pages/LoanPages'
import {
  AdminDashboardPage,
  AdminAuditPage,
  AdminSuspiciousPage,
  AdminProviderStatusPage,
  AdminUsersPage,
  AdminCardsPage,
  AdminNotificationsPage,
  AdminTransactionsPage,
  AdminLoansPage,
} from './pages/AdminPages'
import { formatRemaining, getPasswordPolicyErrors, getPasswordStrength } from './utils/securityUi'
import RouteSkeleton from './components/RouteSkeleton'
import './App.css'

function ImpersonationReturnPage({ busy, onComplete }) {
  useEffect(() => {
    onComplete().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="pageWrap authPage pageEnter">
      <article className="card authCard cardEnter">
        <header>
          <h2>Returning to Admin Session</h2>
          <p>{busy ? 'Restoring your admin context...' : 'Completing impersonation exit...'}</p>
        </header>
      </article>
    </section>
  )
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [user, setUser] = useState(null)
  const [account, setAccount] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [registerForm, setRegisterForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', password: '' })
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [mfaCode, setMfaCode] = useState('')
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountNumber: '', amount: '', note: '' })
  const [ownTransferForm, setOwnTransferForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', note: '' })
  const [beneficiaryForm, setBeneficiaryForm] = useState({ nickname: '', accountNumber: '' })
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' })
  const [supportTickets, setSupportTickets] = useState([])
  const [loans, setLoans] = useState([])
  const [selectedLoanDetails, setSelectedLoanDetails] = useState(null)
  const [loanForm, setLoanForm] = useState({ amount: '', termMonths: '12', requestedInterestRate: '10', purpose: '', targetAccountId: '' })
  const [cards, setCards] = useState([])
  const [payments, setPayments] = useState([])
  const [recurringPayments, setRecurringPayments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationsFilter, setNotificationsFilter] = useState({ search: '', type: '', unreadOnly: false })
  const [notificationsPagination, setNotificationsPagination] = useState({ total: 0, limit: 20, offset: 0, hasNext: false, hasPrevious: false })
  const [notificationPreferences, setNotificationPreferences] = useState({
    inAppEnabled: true,
    emailEnabled: false,
    accountEnabled: true,
    transferEnabled: true,
    paymentEnabled: true,
    supportEnabled: true,
    securityEnabled: true,
    systemEnabled: true,
  })
  const [cardRequestForm, setCardRequestForm] = useState({ cardType: 'debit' })
  const [billForm, setBillForm] = useState({ billerName: '', reference: '', amount: '' })
  const [rechargeForm, setRechargeForm] = useState({ mobileNumber: '', amount: '' })
  const [scheduledForm, setScheduledForm] = useState({ payeeName: '', reference: '', amount: '', scheduleAt: '' })
  const [recurringForm, setRecurringForm] = useState({ payeeName: '', reference: '', amount: '', frequency: 'monthly', startAt: '', endAt: '' })
  const [statementFilters, setStatementFilters] = useState({ accountId: '', from: '', to: '' })
  const [statementTransactions, setStatementTransactions] = useState([])
  const [statementSummary, setStatementSummary] = useState({ transactionCount: 0, totalDebits: 0, totalCredits: 0, netFlow: 0 })
  const [resetRequestEmail, setResetRequestEmail] = useState('')
  const [resetConfirmForm, setResetConfirmForm] = useState({ token: '', newPassword: '' })
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', phoneNumber: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const [auditFilter, setAuditFilter] = useState({ eventType: '', actorUserId: '', from: '', to: '' })
  const [auditPagination, setAuditPagination] = useState({ total: 0, limit: 50, offset: 0, hasNext: false, hasPrevious: false })
  const [suspiciousFilter, setSuspiciousFilter] = useState({ lookbackMinutes: '60', minRiskScore: '3' })
  const [suspiciousActivity, setSuspiciousActivity] = useState([])
  const [adminProviderStatus, setAdminProviderStatus] = useState(null)
  const [adminProviderTimeline, setAdminProviderTimeline] = useState([])
  const [adminProviderTimelinePagination, setAdminProviderTimelinePagination] = useState({ total: 0, limit: 30, offset: 0, hasNext: false, hasPrevious: false })
  const [adminUsers, setAdminUsers] = useState([])
  const [adminUsersPagination, setAdminUsersPagination] = useState({ total: 0, limit: 50, offset: 0, hasNext: false, hasPrevious: false })
  const [adminUserFilters, setAdminUserFilters] = useState({ search: '', accountStatus: '' })
  const [adminSelectedUserDetail, setAdminSelectedUserDetail] = useState(null)
  const [adminCards, setAdminCards] = useState([])
  const [adminCardFilters, setAdminCardFilters] = useState({ userId: '', status: '', providerStatus: '' })
  const [adminNotificationForm, setAdminNotificationForm] = useState({ userId: '', type: 'system', title: '', body: '', broadcast: false })
  const [adminTransactions, setAdminTransactions] = useState([])
  const [adminTransactionFilters, setAdminTransactionFilters] = useState({ userId: '', status: '' })
  const [adminActivity, setAdminActivity] = useState([])
  const [adminActivityFilters, setAdminActivityFilters] = useState({ userId: '', from: '', to: '' })
  const [adminLoans, setAdminLoans] = useState([])
  const [adminLoansPagination, setAdminLoansPagination] = useState({ total: 0, limit: 50, offset: 0, hasNext: false, hasPrevious: false })
  const [adminLoanFilters, setAdminLoanFilters] = useState({ search: '', status: '' })
  const [adminLoanDecisionForm, setAdminLoanDecisionForm] = useState({})

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(10)
  const [remainingSeconds, setRemainingSeconds] = useState(10 * 60)
  const [busyKey, setBusyKey] = useState('')
  const [transactionQuery, setTransactionQuery] = useState('')
  const [showMetadataJson, setShowMetadataJson] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [oauthProviders, setOauthProviders] = useState({ github: false })
  const [mfaEnabled, setMfaEnabled] = useState(true)
  const [providerStatusSummary, setProviderStatusSummary] = useState({
    payments: { pendingCount: 0, lastSyncedAt: null },
    cards: { pendingCount: 0, lastSyncedAt: null },
  })
  const [providerPollingSeconds, setProviderPollingSeconds] = useState(15)

  const lastActivityAt = useRef(Date.now())
  const sessionEnding = useRef(false)

  const registerStrength = getPasswordStrength(registerForm.password)
  const resetStrength = getPasswordStrength(resetConfirmForm.newPassword)
  const changePasswordStrength = getPasswordStrength(passwordForm.newPassword)

  const filteredTransactions = useMemo(() => {
    const q = transactionQuery.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter((tx) => {
      return [tx.from_account, tx.to_account, tx.note || '', String(tx.amount)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [transactions, transactionQuery])


  async function runBusy(key, fn) {
    setBusyKey(key)
    try {
      await fn()
    } finally {
      setBusyKey('')
    }
  }

  async function copyText(value, label) {
    try {
      await navigator.clipboard.writeText(String(value || ''))
      setMessage(`${label} copied to clipboard.`)
      setError('')
    } catch {
      setError(`Could not copy ${label.toLowerCase()}.`)
    }
  }

  async function refreshProviderStatusSummary() {
    const data = await apiFetch('/api/providers/status')
    setProviderStatusSummary({
      payments: data.payments || { pendingCount: 0, lastSyncedAt: null },
      cards: data.cards || { pendingCount: 0, lastSyncedAt: null },
    })
  }

  async function loadProfile() {
    let me
    try {
      me = await apiFetch('/api/auth/me')
    } catch {
      setUser(null)
      setAccount(null)
      setAccounts([])
      setTransactions([])
      setBeneficiaries([])
      setSupportTickets([])
      setLoans([])
      setSelectedLoanDetails(null)
      setCards([])
      setPayments([])
      setProviderStatusSummary({
        payments: { pendingCount: 0, lastSyncedAt: null },
        cards: { pendingCount: 0, lastSyncedAt: null },
      })
      setRecurringPayments([])
      setNotifications([])
      setUnreadNotifications(0)
      setNotificationsPagination({ total: 0, limit: 20, offset: 0, hasNext: false, hasPrevious: false })
      setNotificationPreferences({
        inAppEnabled: true,
        emailEnabled: false,
        accountEnabled: true,
        transferEnabled: true,
        paymentEnabled: true,
        supportEnabled: true,
        securityEnabled: true,
        systemEnabled: true,
      })
      setStatementTransactions([])
      setStatementSummary({ transactionCount: 0, totalDebits: 0, totalCredits: 0, netFlow: 0 })
      return false
    }

    try {
      setUser(me.user)
      setProfileForm({
        fullName: me.user.full_name || '',
        email: me.user.email || '',
        phoneNumber: me.user.phone_number || '',
      })
      setMfaEnabled(Boolean(me.user.mfa_enabled ?? true))
      setSessionTimeoutMinutes(Number(me.sessionIdleTimeoutMinutes || 10))
      lastActivityAt.current = Date.now()
      sessionEnding.current = false

      const data = await apiFetch('/api/accounts/me')
      const accountCollection = data.accounts || (data.account ? [data.account] : [])
      setAccount(data.account)
      setAccounts(accountCollection)
      setTransferForm((prev) => ({
        ...prev,
        fromAccountId: prev.fromAccountId || data.account?.id || '',
      }))
      setOwnTransferForm((prev) => ({
        ...prev,
        fromAccountId: prev.fromAccountId || data.account?.id || '',
      }))
      setStatementFilters((prev) => ({
        ...prev,
        accountId: prev.accountId || data.account?.id || '',
      }))
      setTransactions(data.transactions)
      const beneficiaryData = await apiFetch('/api/beneficiaries')
      setBeneficiaries(beneficiaryData.beneficiaries || [])
      const supportData = await apiFetch('/api/support/tickets')
      setSupportTickets(supportData.tickets || [])
      const loansData = await apiFetch('/api/loans/me')
      setLoans(loansData.loans || [])
      const cardsData = await apiFetch('/api/cards')
      setCards(cardsData.cards || [])
      setPayments([])
      await refreshProviderStatusSummary()
      setRecurringPayments([])
      const notificationsData = await apiFetch('/api/notifications')
      setNotifications(notificationsData.notifications || [])
      setUnreadNotifications(Number(notificationsData.unreadCount || 0))
      setNotificationsPagination(notificationsData.pagination || { total: 0, limit: 20, offset: 0, hasNext: false, hasPrevious: false })
      const notificationPreferencesData = await apiFetch('/api/notifications/preferences')
      setNotificationPreferences(notificationPreferencesData.preferences || {
        inAppEnabled: true,
        emailEnabled: false,
        accountEnabled: true,
        transferEnabled: true,
        paymentEnabled: true,
        supportEnabled: true,
        securityEnabled: true,
        systemEnabled: true,
      })

      const defaultStatementAccountId = data.account?.id || accountCollection[0]?.id || ''
      if (defaultStatementAccountId) {
        const statementData = await apiFetch(`/api/statements/transactions?accountId=${encodeURIComponent(defaultStatementAccountId)}`)
        setStatementTransactions(statementData.transactions || [])
        setStatementSummary(statementData.summary || { transactionCount: 0, totalDebits: 0, totalCredits: 0, netFlow: 0 })
      } else {
        setStatementTransactions([])
        setStatementSummary({ transactionCount: 0, totalDebits: 0, totalCredits: 0, netFlow: 0 })
      }
      setError('')
    } catch (bootstrapError) {
      // Keep the authenticated session active even if a non-critical data request fails.
      // Avoid showing a global error toast for transient partial-load issues.
      console.warn('Profile bootstrap partially failed:', bootstrapError)
      setError('')
    }

    return true
  }

  async function loadOauthProviders() {
    try {
      const data = await apiFetch('/api/auth/oauth/providers')
      setOauthProviders({ github: Boolean(data?.github?.enabled) })
    } catch {
      setOauthProviders({ github: false })
    }
  }

  async function loadAuditLogs(nextOffset = auditPagination.offset) {
    setError('')
    const params = new URLSearchParams()
    if (auditFilter.eventType.trim()) params.set('eventType', auditFilter.eventType.trim())
    if (auditFilter.actorUserId.trim()) params.set('actorUserId', auditFilter.actorUserId.trim())
    if (auditFilter.from) params.set('from', new Date(auditFilter.from).toISOString())
    if (auditFilter.to) params.set('to', new Date(auditFilter.to).toISOString())
    params.set('limit', String(auditPagination.limit))
    params.set('offset', String(nextOffset))

    const query = params.toString() ? `?${params.toString()}` : ''
    const data = await apiFetch(`/api/admin/audit-logs${query}`)
    setAuditLogs(data.logs)
    if (data.pagination) setAuditPagination(data.pagination)
  }

  async function loadSuspiciousActivity() {
    setError('')
    const params = new URLSearchParams()
    params.set('lookbackMinutes', String(Number(suspiciousFilter.lookbackMinutes) || 60))
    params.set('minRiskScore', String(Number(suspiciousFilter.minRiskScore) || 3))
    const data = await apiFetch(`/api/admin/suspicious-activity?${params.toString()}`)
    setSuspiciousActivity(data.items || [])
  }

  async function loadAdminProviderStatus() {
    setError('')
    const data = await apiFetch('/api/admin/providers/status')
    setAdminProviderStatus(data || null)
  }

  async function loadAdminProviderTimeline(filters = {}) {
    setError('')
    const params = new URLSearchParams()
    const eventType = String(filters.eventType || '').trim()
    const actorUserId = String(filters.actorUserId || '').trim()
    if (eventType) params.set('eventType', eventType)
    if (actorUserId) params.set('actorUserId', actorUserId)
    if (filters.from) params.set('from', new Date(filters.from).toISOString())
    if (filters.to) params.set('to', new Date(filters.to).toISOString())
    params.set('limit', String(Number(filters.limit || 30)))
    params.set('offset', String(Number(filters.offset || 0)))

    const data = await apiFetch(`/api/admin/providers/timeline?${params.toString()}`)
    setAdminProviderTimeline(data.items || [])
    setAdminProviderTimelinePagination(data.pagination || { total: 0, limit: 30, offset: 0, hasNext: false, hasPrevious: false })
  }

  async function loadAdminProviderDiagnostics(filters = {}) {
    await Promise.all([
      loadAdminProviderStatus(),
      loadAdminProviderTimeline(filters),
    ])
  }

  async function handleExportProviderTimelineCsv(filters = {}) {
    setError('')
    try {
      const params = new URLSearchParams()
      const eventType = String(filters.eventType || '').trim()
      const actorUserId = String(filters.actorUserId || '').trim()
      if (eventType) params.set('eventType', eventType)
      if (actorUserId) params.set('actorUserId', actorUserId)
      if (filters.from) params.set('from', new Date(filters.from).toISOString())
      if (filters.to) params.set('to', new Date(filters.to).toISOString())

      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(`/api/admin/providers/timeline.csv${query}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to export provider timeline CSV.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'provider-timeline.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function loadAdminUsers(nextOffset = adminUsersPagination.offset) {
    const params = new URLSearchParams()
    if (adminUserFilters.search.trim()) params.set('search', adminUserFilters.search.trim())
    if (adminUserFilters.accountStatus.trim()) params.set('accountStatus', adminUserFilters.accountStatus.trim())
    params.set('limit', String(adminUsersPagination.limit))
    params.set('offset', String(nextOffset))
    const data = await apiFetch(`/api/admin/users?${params.toString()}`)
    setAdminUsers(data.users || [])
    setAdminUsersPagination(data.pagination || { total: 0, limit: 50, offset: 0, hasNext: false, hasPrevious: false })
  }

  async function loadAdminUserDetail(userId) {
    const data = await apiFetch(`/api/admin/users/${userId}`)
    setAdminSelectedUserDetail(data || null)
  }

  async function updateAdminUserStatus(userId, action) {
    const endpoint = action === 'deactivate' ? 'deactivate' : 'reactivate'
    const data = await apiFetch(`/api/admin/users/${userId}/${endpoint}`, { method: 'POST' })
    setMessage(data.message)
    await Promise.all([loadAdminUsers(adminUsersPagination.offset), loadAdminUserDetail(userId)])
  }

  async function handleAdminResetPassword(userId) {
    const data = await apiFetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
    setMessage(`${data.message} Temporary password: ${data.temporaryPassword}`)
  }

  async function handleAdminDeleteUser(userId) {
    const data = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    setMessage(data.message)
    if (adminSelectedUserDetail?.user?.id === userId) {
      setAdminSelectedUserDetail(null)
    }
    await loadAdminUsers(adminUsersPagination.offset)
  }

  async function handleAdminImpersonateUser(userId) {
    setError('')
    await runBusy('impersonationStart', async () => {
      try {
        const data = await apiFetch(`/api/admin/users/${userId}/impersonate`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await loadProfile()
        setMessage(data.message || 'Impersonation session started.')
        navigate('/dashboard', { replace: true })
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleStopImpersonation() {
    setError('')
    await runBusy('impersonationReturn', async () => {
      try {
        const data = await apiFetch('/api/auth/impersonation/stop', {
          method: 'POST',
          body: JSON.stringify({}),
        })
        let restored = false
        for (let attempt = 0; attempt < 4; attempt += 1) {
          // Cookie updates may lag by a tick in some browsers after Set-Cookie responses.
          // Retry auth bootstrap briefly before considering restore failed.
          // eslint-disable-next-line no-await-in-loop
          restored = await loadProfile()
          if (restored) break
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => window.setTimeout(resolve, 200))
        }
        if (!restored) {
          throw new Error('Could not restore admin session. Please retry return to admin.')
        }
        setMessage(data.message || 'Returned to admin session.')
        navigate('/admin/users', { replace: true })
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function loadAdminCards() {
    const params = new URLSearchParams()
    if (adminCardFilters.userId.trim()) params.set('userId', adminCardFilters.userId.trim())
    if (adminCardFilters.status.trim()) params.set('status', adminCardFilters.status.trim())
    if (adminCardFilters.providerStatus.trim()) params.set('providerStatus', adminCardFilters.providerStatus.trim())
    const data = await apiFetch(`/api/admin/cards?${params.toString()}`)
    setAdminCards(data.cards || [])
  }

  async function runAdminCardAction(cardId, action) {
    const data = await apiFetch(`/api/admin/cards/${cardId}/${action}`, { method: 'POST' })
    setMessage(data.message)
    await loadAdminCards()
  }

  async function handleAdminSendNotification(event) {
    event.preventDefault()
    const data = await apiFetch('/api/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify(adminNotificationForm),
    })
    setMessage(`${data.message} (${data.recipientCount})`)
    setAdminNotificationForm({ userId: '', type: 'system', title: '', body: '', broadcast: false })
  }

  async function loadAdminTransactions() {
    const params = new URLSearchParams()
    if (adminTransactionFilters.userId.trim()) params.set('userId', adminTransactionFilters.userId.trim())
    if (adminTransactionFilters.status.trim()) params.set('status', adminTransactionFilters.status.trim())
    const data = await apiFetch(`/api/admin/transactions?${params.toString()}`)
    setAdminTransactions(data.transactions || [])
  }

  async function handleAdminReverseTransaction(transactionId) {
    const data = await apiFetch(`/api/admin/transactions/${transactionId}/reverse`, { method: 'POST' })
    setMessage(data.message)
    await loadAdminTransactions()
  }

  async function loadAdminActivity() {
    const params = new URLSearchParams()
    if (adminActivityFilters.userId.trim()) params.set('userId', adminActivityFilters.userId.trim())
    if (adminActivityFilters.from) params.set('from', new Date(adminActivityFilters.from).toISOString())
    if (adminActivityFilters.to) params.set('to', new Date(adminActivityFilters.to).toISOString())
    const data = await apiFetch(`/api/admin/activity?${params.toString()}`)
    setAdminActivity(data.items || [])
  }

  async function loadLoans() {
    const data = await apiFetch('/api/loans/me')
    setLoans(data.loans || [])
  }

  async function loadLoanDetails(loanId) {
    const data = await apiFetch(`/api/loans/${loanId}`)
    setSelectedLoanDetails({ loan: data.loan, repayments: data.repayments || [] })
  }

  async function handleApplyLoan(event) {
    event.preventDefault()
    setError('')

    await runBusy('loanApply', async () => {
      try {
        const data = await apiFetch('/api/loans/apply', {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(loanForm.amount),
            termMonths: Number(loanForm.termMonths),
            requestedInterestRate: Number(loanForm.requestedInterestRate),
            purpose: loanForm.purpose,
            targetAccountId: loanForm.targetAccountId,
          }),
        })
        setMessage(data.message)
        setLoanForm((prev) => ({ ...prev, amount: '', purpose: '' }))
        await loadLoans()
        navigate('/loans')
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function loadAdminLoans(nextOffset = adminLoansPagination.offset) {
    const params = new URLSearchParams()
    if (adminLoanFilters.search.trim()) params.set('search', adminLoanFilters.search.trim())
    if (adminLoanFilters.status.trim()) params.set('status', adminLoanFilters.status.trim())
    params.set('limit', String(adminLoansPagination.limit))
    params.set('offset', String(nextOffset))
    const data = await apiFetch(`/api/admin/loans?${params.toString()}`)
    setAdminLoans(data.loans || [])
    setAdminLoansPagination(data.pagination || { total: 0, limit: 50, offset: 0, hasNext: false, hasPrevious: false })
  }

  async function handleAdminApproveLoan(loanId) {
    const form = adminLoanDecisionForm[loanId] || {}
    const payload = {}
    if (form.term) payload.approvedTermMonths = Number(form.term)
    if (form.rate) payload.approvedInterestRate = Number(form.rate)

    const data = await apiFetch(`/api/admin/loans/${loanId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setMessage(data.message)
    await Promise.all([
      loadAdminLoans(adminLoansPagination.offset),
      loadLoans(),
      loadProfile(),
    ])

    if (statementFilters.accountId) {
      await loadStatements(statementFilters)
    }
  }

  async function handleAdminRejectLoan(loanId) {
    const reason = String(adminLoanDecisionForm[loanId]?.reason || '').trim()
    if (reason.length < 3) {
      setError('Please provide a rejection reason with at least 3 characters.')
      return
    }

    const data = await apiFetch(`/api/admin/loans/${loanId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    setMessage(data.message)
    await Promise.all([loadAdminLoans(adminLoansPagination.offset), loadLoans()])
  }

  const publicPaths = ['/', '/login', '/register', '/mfa', '/reset-request', '/reset-confirm']
  const isPublicPath = publicPaths.includes(location.pathname)

  useEffect(() => {
    loadOauthProviders().catch(() => {})
    loadProfile().then((ok) => {
      if (ok && publicPaths.includes(location.pathname)) {
        navigate('/dashboard', { replace: true })
      }
      if (!ok && !publicPaths.includes(location.pathname)) {
        navigate('/', { replace: true })
      }
      setAuthReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAuditLogs(0).catch(() => {})
      loadSuspiciousActivity().catch(() => {})
      loadAdminProviderDiagnostics().catch(() => {})
      loadAdminUsers(0).catch(() => {})
      loadAdminCards().catch(() => {})
      loadAdminTransactions().catch(() => {})
      loadAdminActivity().catch(() => {})
      loadAdminLoans(0).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (location.pathname !== '/reset-confirm') return
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (!token) return
    setResetConfirmForm((prev) => ({ ...prev, token }))
    navigate('/reset-confirm', { replace: true })
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!user) return
    const match = location.pathname.match(/^\/loans\/([0-9a-fA-F-]+)$/)
    if (!match) return
    loadLoanDetails(match[1]).catch((requestError) => setError(requestError.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user])

  useEffect(() => {
    if (!user) return undefined
    const path = location.pathname
    if (path !== '/cards') return undefined
    if (providerPollingSeconds <= 0) return undefined

    const poll = async () => {
      await refreshCards()
    }

    poll().catch(() => {})
    const timer = window.setInterval(() => {
      poll().catch(() => {})
    }, providerPollingSeconds * 1000)

    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname, providerPollingSeconds])

  useEffect(() => {
    setMobileNavOpen(false)
    setRouteLoading(true)
    const timer = window.setTimeout(() => setRouteLoading(false), 220)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 4500)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!error) return undefined
    const timer = window.setTimeout(() => setError(''), 6500)
    return () => window.clearTimeout(timer)
  }, [error])

  useEffect(() => {
    if (!user) return undefined

    const markActivity = () => {
      lastActivityAt.current = Date.now()
    }

    const onTick = async () => {
      const limitMs = Math.max(sessionTimeoutMinutes, 1) * 60 * 1000
      const elapsedMs = Date.now() - lastActivityAt.current
      const remaining = Math.max(0, Math.floor((limitMs - elapsedMs) / 1000))
      setRemainingSeconds(remaining)
      if (remaining > 0 || sessionEnding.current) return

      sessionEnding.current = true
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // Session may already be invalid server-side.
      }

      setUser(null)
      setAccount(null)
      setAccounts([])
      setTransactions([])
      setBeneficiaries([])
      setSupportTickets([])
      setLoans([])
      setSelectedLoanDetails(null)
      setCards([])
      setPayments([])
      setRecurringPayments([])
      setNotifications([])
      setUnreadNotifications(0)
      setNotificationPreferences({
        inAppEnabled: true,
        emailEnabled: false,
        accountEnabled: true,
        transferEnabled: true,
        paymentEnabled: true,
        supportEnabled: true,
        securityEnabled: true,
        systemEnabled: true,
      })
      setStatementTransactions([])
      setAuditLogs([])
      setSuspiciousActivity([])
      setAdminProviderStatus(null)
      setAdminProviderTimeline([])
      setAdminProviderTimelinePagination({ total: 0, limit: 30, offset: 0, hasNext: false, hasPrevious: false })
      setMessage('Session timed out due to inactivity. Please sign in again.')
      navigate('/login', { replace: true })
    }

    const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll']
    events.forEach((name) => window.addEventListener(name, markActivity, { passive: true }))
    const timer = window.setInterval(() => {
      onTick().catch(() => {})
    }, 5000)

    return () => {
      events.forEach((name) => window.removeEventListener(name, markActivity))
      window.clearInterval(timer)
    }
  }, [user, sessionTimeoutMinutes, navigate])

  async function handleRegister(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const passwordErrors = getPasswordPolicyErrors(registerForm.password)
    if (passwordErrors.length) {
      setError(`Password must include ${passwordErrors.join(', ')}.`)
      return
    }

    await runBusy('register', async () => {
      try {
        const fullName = `${registerForm.firstName} ${registerForm.lastName}`.trim()
        const payload = {
          fullName,
          email: registerForm.email,
          password: registerForm.password,
        }
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage(data.message)
        navigate('/login')
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    await runBusy('login', async () => {
      try {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(loginForm),
        })
        if (data.requiresMfa === false) {
          if (data?.session?.idleTimeoutMinutes) {
            setSessionTimeoutMinutes(Number(data.session.idleTimeoutMinutes))
          }
          lastActivityAt.current = Date.now()
          sessionEnding.current = false
          setMessage('Authentication complete.')
          await loadProfile()
          navigate('/dashboard')
        } else {
          setMessage(data.message)
          navigate('/mfa')
        }
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleVerifyMfa(event) {
    event.preventDefault()
    setError('')

    await runBusy('mfa', async () => {
      try {
        const data = await apiFetch('/api/auth/mfa/verify', {
          method: 'POST',
          body: JSON.stringify({ code: mfaCode }),
        })
        if (data?.session?.idleTimeoutMinutes) {
          setSessionTimeoutMinutes(Number(data.session.idleTimeoutMinutes))
        }
        lastActivityAt.current = Date.now()
        sessionEnding.current = false
        setMessage('Authentication complete.')
        setMfaCode('')
        await loadProfile()
        navigate('/dashboard')
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  function handleOAuthGithub() {
    setBusyKey('oauthGithub')
    window.location.assign('/api/auth/oauth/github/start')
  }

  async function handleRequestReset(event) {
    event.preventDefault()
    setError('')

    await runBusy('resetRequest', async () => {
      try {
        const data = await apiFetch('/api/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email: resetRequestEmail }),
        })
        setResetRequestEmail('')
        setMessage(data.message)
        navigate('/reset-confirm')
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleConfirmReset(event) {
    event.preventDefault()
    setError('')

    const passwordErrors = getPasswordPolicyErrors(resetConfirmForm.newPassword)
    if (passwordErrors.length) {
      setError(`Password must include ${passwordErrors.join(', ')}.`)
      return
    }

    await runBusy('resetConfirm', async () => {
      try {
        const data = await apiFetch('/api/auth/password-reset/confirm', {
          method: 'POST',
          body: JSON.stringify(resetConfirmForm),
        })
        setMessage(data.message)
        setResetConfirmForm({ token: '', newPassword: '' })
        navigate('/login')
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleTransfer(event) {
    event.preventDefault()
    setError('')

    const amount = Number(transferForm.amount || 0)
    const accountNumber = (transferForm.toAccountNumber || '').trim()

    if (!accountNumber || accountNumber.length < 5) {
      setError('Please enter a valid account number (at least 5 characters).')
      return
    }

    if (!amount || amount <= 0 || amount > 10000000) {
      setError('Amount must be between 0.01 EGP and 10,000,000 EGP.')
      return
    }

    await runBusy('transfer', async () => {
      try {
        const data = await apiFetch('/api/transfers', {
          method: 'POST',
          body: JSON.stringify({
            fromAccountId: transferForm.fromAccountId,
            toAccountNumber: transferForm.toAccountNumber,
            amount: Number(transferForm.amount),
            note: transferForm.note,
          }),
        })
        setMessage(data.message)
        setTransferForm((prev) => ({ ...prev, toAccountNumber: '', amount: '', note: '' }))
        const fresh = await apiFetch('/api/accounts/me')
        setAccount(fresh.account)
        setAccounts(fresh.accounts || (fresh.account ? [fresh.account] : []))
        setTransactions(fresh.transactions)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleAddBeneficiary(event) {
    event.preventDefault()
    setError('')

    await runBusy('beneficiaryAdd', async () => {
      try {
        const data = await apiFetch('/api/beneficiaries', {
          method: 'POST',
          body: JSON.stringify(beneficiaryForm),
        })
        setBeneficiaryForm({ nickname: '', accountNumber: '' })
        const refreshed = await apiFetch('/api/beneficiaries')
        setBeneficiaries(refreshed.beneficiaries || [])
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleOwnTransfer(event) {
    event.preventDefault()
    setError('')

    if (!ownTransferForm.fromAccountId || !ownTransferForm.toAccountId) {
      setError('Please choose both source and destination accounts.')
      return
    }

    if (ownTransferForm.fromAccountId === ownTransferForm.toAccountId) {
      setError('Source and destination accounts must be different.')
      return
    }

    const amount = Number(ownTransferForm.amount || 0)
    if (!amount || amount <= 0) {
      setError('Enter a valid transfer amount.')
      return
    }

    const destination = accounts.find((item) => item.id === ownTransferForm.toAccountId)
    if (!destination?.account_number) {
      setError('Destination account could not be resolved.')
      return
    }

    await runBusy('transfer', async () => {
      try {
        const data = await apiFetch('/api/transfers', {
          method: 'POST',
          body: JSON.stringify({
            fromAccountId: ownTransferForm.fromAccountId,
            toAccountNumber: destination.account_number,
            amount,
            note: ownTransferForm.note,
          }),
        })
        setOwnTransferForm((prev) => ({ ...prev, amount: '', note: '' }))
        const fresh = await apiFetch('/api/accounts/me')
        setAccount(fresh.account)
        setAccounts(fresh.accounts || (fresh.account ? [fresh.account] : []))
        setTransactions(fresh.transactions)
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleDeleteBeneficiary(id) {
    setError('')
    await runBusy('beneficiaryDelete', async () => {
      try {
        const data = await apiFetch(`/api/beneficiaries/${id}`, {
          method: 'DELETE',
        })
        setBeneficiaries((prev) => prev.filter((item) => item.id !== id))
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleDeactivateAccount(accountId) {
    setError('')
    await runBusy('accountAction', async () => {
      try {
        const data = await apiFetch(`/api/accounts/${accountId}/deactivate`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        const refreshed = await apiFetch('/api/accounts/me')
        setAccount(refreshed.account)
        setAccounts(refreshed.accounts || (refreshed.account ? [refreshed.account] : []))
        setTransactions(refreshed.transactions)
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleReactivateAccount(accountId) {
    setError('')
    await runBusy('accountAction', async () => {
      try {
        const data = await apiFetch(`/api/accounts/${accountId}/reactivate`, {
          method: 'POST',
        })
        const refreshed = await apiFetch('/api/accounts/me')
        const accountCollection = refreshed.accounts || (refreshed.account ? [refreshed.account] : [])
        setAccount(refreshed.account)
        setAccounts(accountCollection)
        setTransactions(refreshed.transactions || [])
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleCreateAccount(accountType) {
    setError('')
    await runBusy('accountAction', async () => {
      try {
        const data = await apiFetch('/api/accounts', {
          method: 'POST',
          body: JSON.stringify({ accountType }),
        })
        const refreshed = await apiFetch('/api/accounts/me')
        const accountCollection = refreshed.accounts || (refreshed.account ? [refreshed.account] : [])
        setAccount(refreshed.account)
        setAccounts(accountCollection)
        setTransactions(refreshed.transactions || [])
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleCloseAccount(accountId) {
    setError('')
    await runBusy('accountAction', async () => {
      try {
        const data = await apiFetch(`/api/accounts/${accountId}/close`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        const refreshed = await apiFetch('/api/accounts/me')
        setAccount(refreshed.account)
        setAccounts(refreshed.accounts || (refreshed.account ? [refreshed.account] : []))
        setTransactions(refreshed.transactions)
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleDownloadStatement() {
    setError('')
    if (!transferForm.fromAccountId) {
      setError('Select a source account first to download its statement.')
      return
    }

    await runBusy('statementDownload', async () => {
      try {
        const response = await fetch(`/api/statements/transactions.csv?accountId=${encodeURIComponent(transferForm.fromAccountId)}`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'Failed to download statement.')
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleApplyStatementFilters() {
    setError('')
    await runBusy('statementApply', async () => {
      try {
        await loadStatements(statementFilters)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleDownloadStatementFromFilters() {
    setError('')
    if (!statementFilters.accountId) {
      setError('Select an account before downloading a statement.')
      return
    }

    await runBusy('statementDownload', async () => {
      try {
        const params = new URLSearchParams({ accountId: statementFilters.accountId })
        if (statementFilters.from) {
          params.set('from', new Date(`${statementFilters.from}T00:00:00`).toISOString())
        }
        if (statementFilters.to) {
          params.set('to', new Date(`${statementFilters.to}T23:59:59`).toISOString())
        }

        const response = await fetch(`/api/statements/transactions.csv?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(text || 'Failed to download statement.')
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleSubmitSupport(event) {
    event.preventDefault()
    setError('')
    await runBusy('supportTicket', async () => {
      try {
        const data = await apiFetch('/api/support/tickets', {
          method: 'POST',
          body: JSON.stringify(supportForm),
        })
        setSupportForm({ subject: '', message: '' })
        const refreshed = await apiFetch('/api/support/tickets')
        setSupportTickets(refreshed.tickets || [])
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function refreshCards() {
    const [cardsData] = await Promise.all([
      apiFetch('/api/cards'),
      refreshProviderStatusSummary(),
    ])
    setCards(cardsData.cards || [])
  }

  async function refreshPayments() {
    const [paymentsData] = await Promise.all([
      apiFetch('/api/payments'),
      refreshProviderStatusSummary(),
    ])
    setPayments(paymentsData.payments || [])
  }

  async function refreshRecurringPayments() {
    const data = await apiFetch('/api/payments/recurring')
    setRecurringPayments(data.recurringPayments || [])
  }

  async function loadStatements(filters = statementFilters) {
    if (!filters.accountId) {
      setError('Select an account to load statement transactions.')
      return
    }

    const params = new URLSearchParams({ accountId: filters.accountId })
    if (filters.from) {
      params.set('from', new Date(`${filters.from}T00:00:00`).toISOString())
    }
    if (filters.to) {
      params.set('to', new Date(`${filters.to}T23:59:59`).toISOString())
    }

    const data = await apiFetch(`/api/statements/transactions?${params.toString()}`)
    setStatementTransactions(data.transactions || [])
    setStatementSummary(data.summary || { transactionCount: 0, totalDebits: 0, totalCredits: 0, netFlow: 0 })
  }

  async function refreshNotifications(filterOverrides = notificationsFilter, nextOffset = notificationsPagination.offset) {
    const params = new URLSearchParams()
    if (filterOverrides.search.trim()) params.set('search', filterOverrides.search.trim())
    if (filterOverrides.type) params.set('type', filterOverrides.type)
    if (filterOverrides.unreadOnly) params.set('unreadOnly', 'true')
    params.set('limit', String(notificationsPagination.limit || 20))
    params.set('offset', String(Math.max(nextOffset, 0)))

    const data = await apiFetch(`/api/notifications?${params.toString()}`)
    setNotifications(data.notifications || [])
    setUnreadNotifications(Number(data.unreadCount || 0))
    setNotificationsPagination(data.pagination || { total: 0, limit: 20, offset: 0, hasNext: false, hasPrevious: false })
  }

  async function handleApplyNotificationFilters() {
    setError('')
    await runBusy('notifications', async () => {
      try {
        await refreshNotifications(notificationsFilter, 0)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handlePreviousNotificationsPage() {
    setError('')
    await runBusy('notifications', async () => {
      try {
        await refreshNotifications(notificationsFilter, Math.max(notificationsPagination.offset - notificationsPagination.limit, 0))
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleNextNotificationsPage() {
    setError('')
    await runBusy('notifications', async () => {
      try {
        await refreshNotifications(notificationsFilter, notificationsPagination.offset + notificationsPagination.limit)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleMarkNotificationRead(notificationId) {
    setError('')
    await runBusy('notifications', async () => {
      try {
        const data = await apiFetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await refreshNotifications()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleMarkAllNotificationsRead() {
    setError('')
    await runBusy('notifications', async () => {
      try {
        const data = await apiFetch('/api/notifications/read-all', {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await refreshNotifications()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleSaveNotificationPreferences() {
    setError('')
    await runBusy('notificationPreferences', async () => {
      try {
        const data = await apiFetch('/api/notifications/preferences', {
          method: 'PUT',
          body: JSON.stringify(notificationPreferences),
        })
        setNotificationPreferences(data.preferences || notificationPreferences)
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleRequestCard(event) {
    event.preventDefault()
    setError('')
    await runBusy('cards', async () => {
      try {
        const data = await apiFetch('/api/cards/request', {
          method: 'POST',
          body: JSON.stringify(cardRequestForm),
        })
        await refreshCards()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleFreezeCard(id) {
    setError('')
    await runBusy('cards', async () => {
      try {
        const data = await apiFetch(`/api/cards/${id}/freeze`, { method: 'POST', body: JSON.stringify({}) })
        await refreshCards()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleUnfreezeCard(id) {
    setError('')
    await runBusy('cards', async () => {
      try {
        const data = await apiFetch(`/api/cards/${id}/unfreeze`, { method: 'POST', body: JSON.stringify({}) })
        await refreshCards()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleReportLostCard(id) {
    setError('')
    await runBusy('cards', async () => {
      try {
        const data = await apiFetch(`/api/cards/${id}/report-lost`, { method: 'POST', body: JSON.stringify({}) })
        await refreshCards()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleRetryCard(id) {
    setError('')
    await runBusy('cards', async () => {
      try {
        const data = await apiFetch(`/api/cards/${id}/retry`, { method: 'POST', body: JSON.stringify({}) })
        await refreshCards()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleSyncCardProviders() {
    setError('')
    await runBusy('cards', async () => {
      try {
        const data = await apiFetch('/api/providers/cards/sync', { method: 'POST', body: JSON.stringify({}) })
        await refreshCards()
        const count = Number(data?.summary?.updatedCount || 0)
        setMessage(`Card provider sync completed. Updated ${count} card(s).`)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handlePayBill(event) {
    event.preventDefault()
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch('/api/payments/bills', {
          method: 'POST',
          body: JSON.stringify(billForm),
        })
        setBillForm({ billerName: '', reference: '', amount: '' })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleRecharge(event) {
    event.preventDefault()
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch('/api/payments/recharge', {
          method: 'POST',
          body: JSON.stringify(rechargeForm),
        })
        setRechargeForm({ mobileNumber: '', amount: '' })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleSchedulePayment(event) {
    event.preventDefault()
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch('/api/payments/scheduled', {
          method: 'POST',
          body: JSON.stringify(scheduledForm),
        })
        setScheduledForm({ payeeName: '', reference: '', amount: '', scheduleAt: '' })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleCreateRecurring(event) {
    event.preventDefault()
    setError('')
    await runBusy('payments', async () => {
      try {
        const payload = {
          payeeName: recurringForm.payeeName,
          reference: recurringForm.reference,
          amount: recurringForm.amount,
          frequency: recurringForm.frequency,
          startAt: recurringForm.startAt ? new Date(recurringForm.startAt).toISOString() : '',
          endAt: recurringForm.endAt ? new Date(recurringForm.endAt).toISOString() : null,
        }
        const data = await apiFetch('/api/payments/recurring', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setRecurringForm({ payeeName: '', reference: '', amount: '', frequency: 'monthly', startAt: '', endAt: '' })
        await refreshRecurringPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleToggleRecurring(recurringId, active) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch(`/api/payments/recurring/${recurringId}/toggle`, {
          method: 'POST',
          body: JSON.stringify({ active }),
        })
        await refreshRecurringPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleRunRecurring(recurringId) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch(`/api/payments/recurring/${recurringId}/run`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await Promise.all([refreshPayments(), refreshRecurringPayments()])
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleUpdateRecurring(recurringId, payload) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const request = {
          payeeName: payload.payeeName,
          reference: payload.reference,
          amount: Number(payload.amount),
          frequency: payload.frequency,
          startAt: payload.startAt ? new Date(payload.startAt).toISOString() : undefined,
          endAt: payload.endAt ? new Date(payload.endAt).toISOString() : null,
        }
        const data = await apiFetch(`/api/payments/recurring/${recurringId}`, {
          method: 'PUT',
          body: JSON.stringify(request),
        })
        await refreshRecurringPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleDeleteRecurring(recurringId) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch(`/api/payments/recurring/${recurringId}`, {
          method: 'DELETE',
        })
        await refreshRecurringPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleUpdatePayment(paymentId, payload) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const request = {
          payeeName: payload.payeeName,
          reference: payload.reference,
          amount: Number(payload.amount),
          scheduleAt: payload.scheduleAt ? new Date(payload.scheduleAt).toISOString() : undefined,
        }
        const data = await apiFetch(`/api/payments/${paymentId}`, {
          method: 'PUT',
          body: JSON.stringify(request),
        })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleCancelPayment(paymentId) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch(`/api/payments/${paymentId}/cancel`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleUpdatePaymentStatus(paymentId, status) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch(`/api/payments/${paymentId}`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleRetryPayment(paymentId) {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch(`/api/payments/${paymentId}/retry`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await refreshPayments()
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleSyncPaymentProviders() {
    setError('')
    await runBusy('payments', async () => {
      try {
        const data = await apiFetch('/api/providers/payments/sync', {
          method: 'POST',
          body: JSON.stringify({}),
        })
        await refreshPayments()
        const count = Number(data?.summary?.updatedCount || 0)
        setMessage(`Payment provider sync completed. Updated ${count} payment(s).`)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleSaveProfile(event) {
    event.preventDefault()
    setError('')

    await runBusy('profile', async () => {
      try {
        const data = await apiFetch('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({
            fullName: profileForm.fullName,
            phoneNumber: profileForm.phoneNumber,
          }),
        })
        setUser(data.user)
        setProfileForm({
          fullName: data.user.full_name || '',
          email: data.user.email || '',
          phoneNumber: data.user.phone_number || '',
        })
        setMfaEnabled(Boolean(data.user.mfa_enabled ?? true))
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setError('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    const passwordErrors = getPasswordPolicyErrors(passwordForm.newPassword)
    if (passwordErrors.length) {
      setError(`Password must include ${passwordErrors.join(', ')}.`)
      return
    }

    await runBusy('changePassword', async () => {
      try {
        const data = await apiFetch('/api/auth/password/change', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        })
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleToggleMfa(enabled) {
    setError('')
    await runBusy('mfaSettings', async () => {
      try {
        const data = await apiFetch('/api/security/mfa-settings', {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        })
        setMfaEnabled(Boolean(data.enabled))
        setMessage(data.message)
      } catch (requestError) {
        setError(requestError.message)
      }
    })
  }

  async function handleDownloadAuditCsv() {
    setError('')
    try {
      const params = new URLSearchParams()
      if (auditFilter.eventType.trim()) params.set('eventType', auditFilter.eventType.trim())
      if (auditFilter.actorUserId.trim()) params.set('actorUserId', auditFilter.actorUserId.trim())
      if (auditFilter.from) params.set('from', new Date(auditFilter.from).toISOString())
      if (auditFilter.to) params.set('to', new Date(auditFilter.to).toISOString())
      const query = params.toString() ? `?${params.toString()}` : ''

      const response = await fetch(`/api/admin/audit-logs.csv${query}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to export CSV.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'audit-logs.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function handleLogout() {
    setError('')
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // already expired
    }
    sessionEnding.current = false
    setUser(null)
    setAccount(null)
    setAccounts([])
    setTransactions([])
    setBeneficiaries([])
    setSupportTickets([])
    setLoans([])
    setSelectedLoanDetails(null)
    setCards([])
    setPayments([])
    setProviderStatusSummary({
      payments: { pendingCount: 0, lastSyncedAt: null },
      cards: { pendingCount: 0, lastSyncedAt: null },
    })
    setRecurringPayments([])
    setNotifications([])
    setUnreadNotifications(0)
    setNotificationsPagination({ total: 0, limit: 20, offset: 0, hasNext: false, hasPrevious: false })
    setNotificationsPagination({ total: 0, limit: 20, offset: 0, hasNext: false, hasPrevious: false })
    setNotificationPreferences({
      inAppEnabled: true,
      emailEnabled: false,
      accountEnabled: true,
      transferEnabled: true,
      paymentEnabled: true,
      supportEnabled: true,
      securityEnabled: true,
      systemEnabled: true,
    })
    setStatementTransactions([])
    setStatementSummary({ transactionCount: 0, totalDebits: 0, totalCredits: 0, netFlow: 0 })
    setAuditLogs([])
    setSuspiciousActivity([])
    setAdminProviderStatus(null)
    setAdminProviderTimeline([])
    setAdminProviderTimelinePagination({ total: 0, limit: 30, offset: 0, hasNext: false, hasPrevious: false })
    setAdminUsers([])
    setAdminSelectedUserDetail(null)
    setAdminCards([])
    setAdminTransactions([])
    setAdminActivity([])
    setAdminLoans([])
    setAdminLoansPagination({ total: 0, limit: 50, offset: 0, hasNext: false, hasPrevious: false })
    setMessage('Logged out.')
    navigate('/login')
  }

  const isAdminDirectSession = Boolean(user && user.role === 'admin' && !user.is_impersonating)

  const userNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
    { to: '/accounts', label: 'Accounts', icon: 'accounts' },
    { to: '/loans', label: 'Loans', icon: 'loans' },
    { to: '/transfers', label: 'Transfers', icon: 'transfer' },
    { to: '/transactions', label: 'Transactions', icon: 'transactions' },
    { to: '/statements', label: 'Statements', icon: 'statements' },
    { to: '/notifications', label: unreadNotifications > 0 ? `Notifications (${unreadNotifications})` : 'Notifications', icon: 'notifications' },
    { to: '/security', label: 'Security', icon: 'security' },
    { to: '/cards', label: 'Cards', icon: 'cards' },
    { to: '/support', label: 'Support', icon: 'support' },
  ]

  const adminNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
    { to: '/security', label: 'Security', icon: 'security' },
    { to: '/admin/audit', label: 'Audit Logs', icon: 'audit' },
    { to: '/admin/suspicious', label: 'Suspicious Activity', icon: 'suspicious' },
    { to: '/admin/providers', label: 'Provider Status', icon: 'providers' },
    { to: '/admin/users', label: 'Users', icon: 'adminUsers' },
    { to: '/admin/loans', label: 'Loans', icon: 'loans' },
    { to: '/admin/cards', label: 'Card Ops', icon: 'adminCards' },
    { to: '/admin/notifications', label: 'Notify Users', icon: 'adminNotifications' },
    { to: '/admin/transactions', label: 'Tx & Activity', icon: 'adminTransactions' },
  ]

  const navItems = user
    ? (
      isAdminDirectSession
        ? adminNavItems
        : [
            ...userNavItems,
            ...(user?.is_impersonating ? [{ to: '/admin/return', label: 'Return to Admin', icon: 'adminUsers' }] : []),
          ]
    )
    : [
        { to: '/', label: 'Home', icon: 'home' },
        { to: '/login', label: 'Login', icon: 'login' },
        { to: '/register', label: 'Register', icon: 'register' },
      ]

  return (
    <div className="appLayout">
      <a href="#main-content" className="skipLink">Skip to main content</a>

      <AppSidebar
        appName={APP_NAME}
        user={user}
        navItems={navItems}
        sessionLabel={formatRemaining(remainingSeconds)}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        onToggleMobile={() => setMobileNavOpen((prev) => !prev)}
        onNavigate={() => setMobileNavOpen(false)}
      />

      <main className="mainContent" id="main-content" tabIndex={-1}>
        <NoticeStack message={message} error={error} />

        {routeLoading || (!authReady && !isPublicPath) ? (
          <RouteSkeleton />
        ) : (
          <Routes>

            
          <Route path="/login" element={<LoginPage loginForm={loginForm} setLoginForm={setLoginForm} onSubmit={handleLogin} busy={busyKey === 'login'} onOAuthGithub={handleOAuthGithub} oauthGithubEnabled={oauthProviders.github} oauthBusy={busyKey === 'oauthGithub'} />} />
          <Route path="/register" element={<RegisterPage registerForm={registerForm} setRegisterForm={setRegisterForm} onSubmit={handleRegister} busy={busyKey === 'register'} strength={registerStrength} />} />
          <Route path="/mfa" element={<MfaPage mfaCode={mfaCode} setMfaCode={setMfaCode} onSubmit={handleVerifyMfa} busy={busyKey === 'mfa'} />} />
          <Route path="/reset-request" element={<ResetRequestPage email={resetRequestEmail} setEmail={setResetRequestEmail} onSubmit={handleRequestReset} busy={busyKey === 'resetRequest'} />} />
          <Route path="/reset-confirm" element={<ResetConfirmPage form={resetConfirmForm} setForm={setResetConfirmForm} onSubmit={handleConfirmReset} busy={busyKey === 'resetConfirm'} strength={resetStrength} />} />

          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute user={user}>
                {isAdminDirectSession ? (
                  <AdminDashboardPage
                    usersTotal={adminUsersPagination.total}
                    cardsTotal={adminCards.length}
                    suspiciousCount={suspiciousActivity.length}
                    transactionsTotal={adminTransactions.length}
                    auditTotal={auditPagination.total}
                  />
                ) : (
                  <DashboardPage user={user} accounts={accounts} transactions={transactions} onCopyAccount={() => copyText(account?.account_number, 'Account number')} />
                )}
              </PrivateRoute>
            }
          />
          <Route path="/profile" element={<PrivateRoute user={user}><ProfilePage profileForm={profileForm} setProfileForm={setProfileForm} onSaveProfile={handleSaveProfile} profileBusy={busyKey === 'profile'} /></PrivateRoute>} />
          <Route path="/accounts" element={<UserRoute user={user}><AccountsPage accounts={accounts} onCreateAccount={handleCreateAccount} onDeactivateAccount={handleDeactivateAccount} onReactivateAccount={handleReactivateAccount} onCloseAccount={handleCloseAccount} accountActionBusy={busyKey === 'accountAction'} /></UserRoute>} />
          <Route path="/loans/apply" element={<UserRoute user={user}><LoanApplicationPage form={loanForm} setForm={setLoanForm} accounts={accounts} onSubmit={handleApplyLoan} busy={busyKey === 'loanApply'} /></UserRoute>} />
          <Route path="/loans" element={<UserRoute user={user}><LoanListPage loans={loans} /></UserRoute>} />
          <Route path="/loans/:id" element={<UserRoute user={user}><LoanDetailsPage loan={selectedLoanDetails?.loan} repayments={selectedLoanDetails?.repayments || []} /></UserRoute>} />
          <Route path="/transfers" element={<UserRoute user={user}><TransferPage form={transferForm} setForm={setTransferForm} ownTransferForm={ownTransferForm} setOwnTransferForm={setOwnTransferForm} onSubmit={handleTransfer} onSubmitOwnTransfer={handleOwnTransfer} busy={busyKey === 'transfer'} accounts={accounts} beneficiaries={beneficiaries} beneficiaryForm={beneficiaryForm} setBeneficiaryForm={setBeneficiaryForm} onAddBeneficiary={handleAddBeneficiary} onDeleteBeneficiary={handleDeleteBeneficiary} beneficiaryBusy={busyKey === 'beneficiaryAdd' || busyKey === 'beneficiaryDelete'} /></UserRoute>} />
          <Route path="/transfer" element={<Navigate to="/transfers" replace />} />
          <Route path="/transactions" element={<UserRoute user={user}><TransactionsPage query={transactionQuery} setQuery={setTransactionQuery} items={filteredTransactions} currency={account?.currency || 'EGP'} onDownloadStatement={handleDownloadStatement} statementBusy={busyKey === 'statementDownload'} /></UserRoute>} />
          <Route path="/statements" element={<UserRoute user={user}><StatementsPage accounts={accounts} filters={statementFilters} setFilters={setStatementFilters} items={statementTransactions} summary={statementSummary} onApplyFilters={handleApplyStatementFilters} onDownloadCsv={handleDownloadStatementFromFilters} applyBusy={busyKey === 'statementApply'} downloadBusy={busyKey === 'statementDownload'} /></UserRoute>} />
          <Route path="/notifications" element={<UserRoute user={user}><NotificationsPage notifications={notifications} unreadCount={unreadNotifications} preferences={notificationPreferences} setPreferences={setNotificationPreferences} onSavePreferences={handleSaveNotificationPreferences} filters={notificationsFilter} setFilters={setNotificationsFilter} pagination={notificationsPagination} onApplyFilters={handleApplyNotificationFilters} onPrevPage={handlePreviousNotificationsPage} onNextPage={handleNextNotificationsPage} onRefresh={() => refreshNotifications(notificationsFilter, notificationsPagination.offset)} onMarkRead={handleMarkNotificationRead} onMarkAllRead={handleMarkAllNotificationsRead} busy={busyKey === 'notifications'} preferencesBusy={busyKey === 'notificationPreferences'} /></UserRoute>} />
          <Route path="/security" element={<PrivateRoute user={user}><SecurityPage user={user} sessionTimeoutMinutes={sessionTimeoutMinutes} oauthEnabled={oauthProviders.github} mfaEnabled={mfaEnabled} onToggleMfa={handleToggleMfa} mfaBusy={busyKey === 'mfaSettings'} passwordForm={passwordForm} setPasswordForm={setPasswordForm} onChangePassword={handleChangePassword} passwordBusy={busyKey === 'changePassword'} passwordStrength={changePasswordStrength} /></PrivateRoute>} />
          <Route path="/cards" element={<UserRoute user={user}><CardsPage cards={cards} providerSummary={providerStatusSummary.cards} providerPollingSeconds={providerPollingSeconds} setProviderPollingSeconds={setProviderPollingSeconds} cardRequestForm={cardRequestForm} setCardRequestForm={setCardRequestForm} onRequestCard={handleRequestCard} onFreezeCard={handleFreezeCard} onUnfreezeCard={handleUnfreezeCard} onReportLostCard={handleReportLostCard} onRetryCard={handleRetryCard} onSyncCardProviders={handleSyncCardProviders} busy={busyKey === 'cards'} /></UserRoute>} />
          <Route path="/support" element={<UserRoute user={user}><SupportPage supportForm={supportForm} setSupportForm={setSupportForm} onSubmitSupport={handleSubmitSupport} busy={busyKey === 'supportTicket'} tickets={supportTickets} /></UserRoute>} />
          <Route
            path="/admin/return"
            element={
              <PrivateRoute user={user}>
                {user?.is_impersonating
                  ? <ImpersonationReturnPage busy={busyKey === 'impersonationReturn'} onComplete={handleStopImpersonation} />
                  : <Navigate to="/dashboard" replace />}
              </PrivateRoute>
            }
          />
          <Route path="/verify-email" element={<PrivateRoute user={user}><VerifyEmailPage /></PrivateRoute>} />

          <Route
            path="/admin/audit"
            element={
              <AdminRoute user={user}>
                <AdminAuditPage
                  auditFilter={auditFilter}
                  setAuditFilter={setAuditFilter}
                  auditPagination={auditPagination}
                  auditLogs={auditLogs}
                  showMetadataJson={showMetadataJson}
                  setShowMetadataJson={setShowMetadataJson}
                  onRefresh={() => loadAuditLogs(0).catch((e) => setError(e.message))}
                  onPrev={() => loadAuditLogs(Math.max(auditPagination.offset - auditPagination.limit, 0)).catch((e) => setError(e.message))}
                  onNext={() => loadAuditLogs(auditPagination.offset + auditPagination.limit).catch((e) => setError(e.message))}
                  onExport={handleDownloadAuditCsv}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/suspicious"
            element={
              <AdminRoute user={user}>
                <AdminSuspiciousPage
                  suspiciousFilter={suspiciousFilter}
                  setSuspiciousFilter={setSuspiciousFilter}
                  suspiciousActivity={suspiciousActivity}
                  onRefresh={() => loadSuspiciousActivity().catch((e) => setError(e.message))}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <AdminRoute user={user}>
                <AdminUsersPage
                  users={adminUsers}
                  pagination={adminUsersPagination}
                  filters={adminUserFilters}
                  setFilters={setAdminUserFilters}
                  selectedUserDetail={adminSelectedUserDetail}
                  onRefresh={() => loadAdminUsers(0).catch((e) => setError(e.message))}
                  onViewUser={(id) => handleAdminImpersonateUser(id).catch((e) => setError(e.message))}
                  onInspectUser={(id) => loadAdminUserDetail(id).catch((e) => setError(e.message))}
                  onDeactivateUser={(id) => updateAdminUserStatus(id, 'deactivate').catch((e) => setError(e.message))}
                  onReactivateUser={(id) => updateAdminUserStatus(id, 'reactivate').catch((e) => setError(e.message))}
                  onResetPassword={(id) => handleAdminResetPassword(id).catch((e) => setError(e.message))}
                  onDeleteUser={(id) => handleAdminDeleteUser(id).catch((e) => setError(e.message))}
                  onPrev={() => loadAdminUsers(Math.max(adminUsersPagination.offset - adminUsersPagination.limit, 0)).catch((e) => setError(e.message))}
                  onNext={() => loadAdminUsers(adminUsersPagination.offset + adminUsersPagination.limit).catch((e) => setError(e.message))}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/loans"
            element={
              <AdminRoute user={user}>
                <AdminLoansPage
                  loans={adminLoans}
                  pagination={adminLoansPagination}
                  filters={adminLoanFilters}
                  setFilters={setAdminLoanFilters}
                  decisionForm={adminLoanDecisionForm}
                  setDecisionForm={setAdminLoanDecisionForm}
                  onRefresh={() => loadAdminLoans(0).catch((e) => setError(e.message))}
                  onApprove={(id) => handleAdminApproveLoan(id).catch((e) => setError(e.message))}
                  onReject={(id) => handleAdminRejectLoan(id).catch((e) => setError(e.message))}
                  onPrev={() => loadAdminLoans(Math.max(adminLoansPagination.offset - adminLoansPagination.limit, 0)).catch((e) => setError(e.message))}
                  onNext={() => loadAdminLoans(adminLoansPagination.offset + adminLoansPagination.limit).catch((e) => setError(e.message))}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/cards"
            element={
              <AdminRoute user={user}>
                <AdminCardsPage
                  cards={adminCards}
                  filters={adminCardFilters}
                  setFilters={setAdminCardFilters}
                  onRefresh={() => loadAdminCards().catch((e) => setError(e.message))}
                  onFreeze={(id) => runAdminCardAction(id, 'freeze').catch((e) => setError(e.message))}
                  onUnfreeze={(id) => runAdminCardAction(id, 'unfreeze').catch((e) => setError(e.message))}
                  onReportLost={(id) => runAdminCardAction(id, 'report-lost').catch((e) => setError(e.message))}
                  onRetry={(id) => runAdminCardAction(id, 'retry').catch((e) => setError(e.message))}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/notifications"
            element={
              <AdminRoute user={user}>
                <AdminNotificationsPage
                  form={adminNotificationForm}
                  setForm={setAdminNotificationForm}
                  onSend={(event) => handleAdminSendNotification(event).catch((e) => setError(e.message))}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/transactions"
            element={
              <AdminRoute user={user}>
                <AdminTransactionsPage
                  transactions={adminTransactions}
                  activity={adminActivity}
                  transactionFilters={adminTransactionFilters}
                  setTransactionFilters={setAdminTransactionFilters}
                  activityFilters={adminActivityFilters}
                  setActivityFilters={setAdminActivityFilters}
                  onRefreshTransactions={() => loadAdminTransactions().catch((e) => setError(e.message))}
                  onReverse={(id) => handleAdminReverseTransaction(id).catch((e) => setError(e.message))}
                  onRefreshActivity={() => loadAdminActivity().catch((e) => setError(e.message))}
                />
              </AdminRoute>
            }
          />

          <Route
            path="/admin/providers"
            element={
              <AdminRoute user={user}>
                <AdminProviderStatusPage
                  providerStatus={adminProviderStatus}
                  providerTimeline={adminProviderTimeline}
                  pagination={adminProviderTimelinePagination}
                  onRefresh={(filters) => loadAdminProviderDiagnostics(filters).catch((e) => setError(e.message))}
                  onExport={handleExportProviderTimelineCsv}
                />
              </AdminRoute>
            }
          />

          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
          </Routes>
        )}
      </main>
    </div>
  )
}

export default App
