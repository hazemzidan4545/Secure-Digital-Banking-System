import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { formatDate } from '../utils/formatters'

export function AdminDashboardPage({
  usersTotal = 0,
  cardsTotal = 0,
  suspiciousCount = 0,
  transactionsTotal = 0,
  auditTotal = 0,
}) {
  const statItems = [
    ['Users', String(usersTotal)],
    ['Cards', String(cardsTotal)],
    ['Suspicious Signals', String(suspiciousCount)],
    ['Transactions', String(transactionsTotal)],
    ['Audit Events', String(auditTotal)],
  ]

  const quickLinks = [
    ['/admin/users', 'Manage Users'],
    ['/admin/loans', 'Review Loans'],
    ['/admin/cards', 'Card Operations'],
    ['/admin/suspicious', 'Review Suspicious Activity'],
    ['/admin/audit', 'Inspect Audit Logs'],
    ['/admin/transactions', 'Transactions & Activity'],
    ['/admin/notifications', 'Notify Users'],
  ]

  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Operational overview and direct access to administrative actions.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statItems.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          </Card>
        ))}
      </section>

      <Card title="Quick Links" subtitle="Go directly to common admin workflows.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(([path, label]) => (
            <Link key={path} to={path}>
              <Button className="w-full">{label}</Button>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function AdminAuditPage({
  auditFilter,
  setAuditFilter,
  auditPagination,
  auditLogs,
  showMetadataJson,
  setShowMetadataJson,
  onRefresh,
  onPrev,
  onNext,
  onExport,
}) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-600">Read-only view of security and activity events with full audit trail.</p>
      </header>

      <Card title="Filter Events" subtitle="Refine audit results by event type, actor, and time range.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Event Type"
            placeholder="e.g., auth.login.failed"
            value={auditFilter.eventType}
            onChange={(event) => setAuditFilter({ ...auditFilter, eventType: event.target.value })}
            hint="Partial match on event type string."
          />
          <Input
            label="Actor (Name or Email)"
            placeholder="e.g., sara@bank.com or Sara"
            value={auditFilter.actorUserId}
            onChange={(event) => setAuditFilter({ ...auditFilter, actorUserId: event.target.value })}
            hint="Search actor by email, name, or exact user ID."
          />
          <Input
            label="From Date/Time"
            type="datetime-local"
            value={auditFilter.from}
            onChange={(event) => setAuditFilter({ ...auditFilter, from: event.target.value })}
          />
          <Input
            label="To Date/Time"
            type="datetime-local"
            value={auditFilter.to}
            onChange={(event) => setAuditFilter({ ...auditFilter, to: event.target.value })}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>
          <Button variant="secondary" size="sm" onClick={onExport}>Export CSV</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowMetadataJson((prev) => !prev)}>
            {showMetadataJson ? 'Compact' : 'Expand'} Metadata
          </Button>
        </div>
      </Card>

      <Card title="Event Log">
        <div className="space-y-3 border-b border-slate-200 pb-4 mb-4">
          <p className="text-sm text-slate-600">
            {auditPagination.total === 0
              ? 'No matching audit events'
              : `Showing ${auditPagination.offset + 1} – ${Math.min(auditPagination.offset + auditPagination.limit, auditPagination.total)} of ${auditPagination.total}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onPrev} disabled={!auditPagination.hasPrevious}>
              ← Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={onNext} disabled={!auditPagination.hasNext}>
              Next →
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">When</th>
                <th className="py-3 pr-4">Event</th>
                <th className="py-3 pr-4">Actor</th>
                <th className="py-3 pr-4">{showMetadataJson ? 'Metadata (Expanded)' : 'Metadata'}</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-600">{formatDate(log.created_at)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-sky-700">{log.event_type}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{log.actor_user_id ? log.actor_user_id.slice(0, 8) : '—'}</td>
                  <td className="py-3 pr-4">
                    {showMetadataJson ? (
                      <pre className="rounded bg-slate-50 p-2 text-xs text-slate-700 overflow-x-auto max-h-48">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : (
                      <code className="text-xs text-slate-600">{JSON.stringify(log.metadata)}</code>
                    )}
                  </td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-slate-500">No audit events loaded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function AdminSuspiciousPage({ suspiciousFilter, setSuspiciousFilter, suspiciousActivity, onRefresh }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Suspicious Activity</h1>
        <p className="mt-1 text-sm text-slate-600">Risk scoring for repeated authentication failures and anomalous patterns.</p>
      </header>

      <Card title="Filter Settings" subtitle="Adjust sensitivity and lookback window.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Lookback Window (minutes)"
            type="number"
            min="1"
            max="1440"
            value={suspiciousFilter.lookbackMinutes}
            onChange={(event) => setSuspiciousFilter({ ...suspiciousFilter, lookbackMinutes: event.target.value })}
            hint="Events within this period are considered."
          />
          <Input
            label="Minimum Risk Score"
            type="number"
            min="1"
            max="50"
            value={suspiciousFilter.minRiskScore}
            onChange={(event) => setSuspiciousFilter({ ...suspiciousFilter, minRiskScore: event.target.value })}
            hint="Show items with score ≥ this threshold."
          />
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={onRefresh} className="w-full">
              Refresh Results
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Activity Results">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Failed Logins</th>
                <th className="py-3 pr-4">Failed MFA</th>
                <th className="py-3 pr-4">Lock Events</th>
                <th className="py-3 pr-4">Risk Score</th>
                <th className="py-3 pr-4">Last Event</th>
              </tr>
            </thead>
            <tbody>
              {suspiciousActivity.map((item) => {
                const riskLevel = item.risk_score >= 7 ? 'error' : item.risk_score >= 4 ? 'warning' : 'success'
                return (
                  <tr key={item.user_id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-900">{item.full_name}</td>
                    <td className="py-3 pr-4 text-slate-600">{item.email}</td>
                    <td className="py-3 pr-4 text-center font-semibold text-slate-900">{item.login_failed_count}</td>
                    <td className="py-3 pr-4 text-center font-semibold text-slate-900">{item.mfa_failed_count}</td>
                    <td className="py-3 pr-4 text-center font-semibold text-slate-900">{item.lock_count}</td>
                    <td className="py-3 pr-4">
                      <span className={`status-pill ${riskLevel}`}>{item.risk_score}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 text-xs">{formatDate(item.last_event_at)}</td>
                  </tr>
                )
              })}
              {suspiciousActivity.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-slate-500">No suspicious activity detected for current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function AdminProviderStatusPage({ providerStatus, providerTimeline = [], pagination = {}, onRefresh, onExport }) {
  const [timelineFilter, setTimelineFilter] = useState({ eventType: '', actorUserId: '', from: '', to: '', limit: 30, offset: 0 })
  const worker = providerStatus?.worker || {}
  const cards = providerStatus?.cards || {}

  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Provider Status</h1>
        <p className="mt-1 text-sm text-slate-600">Operational snapshot of provider queues, failures, and background sync worker settings.</p>
      </header>

      <Card title="Worker Health">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Enabled</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{worker.enabled ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Busy</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{worker.busy ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Interval</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{worker.intervalSeconds || 0}s</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs uppercase text-slate-500">Batch Size</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{worker.batchSize || 0}</p>
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>Refresh Snapshot</Button>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-1">
        <Card title="Card Providers">
          <p className="text-sm text-slate-700">Pending: <span className="font-semibold">{Number(cards.pendingCount || 0)}</span></p>
          <p className="text-sm text-slate-700">Failed: <span className="font-semibold">{Number(cards.failedCount || 0)}</span></p>
          <p className="text-xs text-slate-500 mt-2">Last Synced: {formatDate(cards.lastSyncedAt)}</p>
        </Card>
      </section>

      <Card title="Recent Provider Timeline" subtitle="Latest sync, webhook, and retry events from audit logs.">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Event Type</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={timelineFilter.eventType}
              onChange={(event) => setTimelineFilter({ ...timelineFilter, eventType: event.target.value })}
            >
              <option value="">All provider events</option>
              <option value="provider.card.sync.requested">provider.card.sync.requested</option>
              <option value="provider.card.webhook.processed">provider.card.webhook.processed</option>
              <option value="user.card.retry_requested">user.card.retry_requested</option>
            </select>
          </label>
          <Input
            label="Actor (Name or Email)"
            placeholder="e.g., sara@bank.com or Sara"
            value={timelineFilter.actorUserId}
            onChange={(event) => setTimelineFilter({ ...timelineFilter, actorUserId: event.target.value })}
          />
          <Input
            label="Limit"
            type="number"
            min="1"
            max="100"
            value={timelineFilter.limit}
            onChange={(event) => setTimelineFilter({ ...timelineFilter, limit: Number(event.target.value || 30) })}
          />
          <Input
            label="From Date/Time"
            type="datetime-local"
            value={timelineFilter.from}
            onChange={(event) => setTimelineFilter({ ...timelineFilter, from: event.target.value })}
          />
          <Input
            label="To Date/Time"
            type="datetime-local"
            value={timelineFilter.to}
            onChange={(event) => setTimelineFilter({ ...timelineFilter, to: event.target.value })}
          />
          <div className="flex items-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => onRefresh({ ...timelineFilter, offset: 0 })}>Apply</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => onExport(timelineFilter)}>Export CSV</Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Showing {providerTimeline.length} items · Total {Number(pagination.total || 0)}
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">When</th>
                <th className="py-3 pr-4">Event</th>
                <th className="py-3 pr-4">Actor</th>
                <th className="py-3 pr-4">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {providerTimeline.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-600 text-xs">{formatDate(item.created_at)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-sky-700">{item.event_type}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{item.actor_user_id ? item.actor_user_id.slice(0, 8) : '—'}</td>
                  <td className="py-3 pr-4 text-xs text-slate-600"><code>{JSON.stringify(item.metadata || {})}</code></td>
                </tr>
              ))}
              {providerTimeline.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-slate-500">No provider timeline events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function AdminUsersPage({
  users = [],
  pagination = {},
  filters,
  setFilters,
  selectedUserDetail,
  onRefresh,
  onViewUser,
  onInspectUser,
  onDeactivateUser,
  onReactivateUser,
  onResetPassword,
  onDeleteUser,
  onPrev,
  onNext,
}) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-600">View and manage user profiles, login status, accounts, cards, and activity.</p>
      </header>

      <Card title="Search Users">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Search"
            placeholder="Name or email"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Account Status</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={filters.accountStatus}
              onChange={(event) => setFilters({ ...filters, accountStatus: event.target.value })}
            >
              <option value="">All</option>
              <option value="active">active</option>
              <option value="deactivated">deactivated</option>
              <option value="closed">closed</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button variant="secondary" size="sm" className="w-full" onClick={onRefresh}>Refresh</Button>
          </div>
        </div>
      </Card>

      <Card title="Users">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>Total: {Number(pagination.total || 0)}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onPrev} disabled={!pagination.hasPrevious}>Previous</Button>
            <Button type="button" variant="secondary" size="sm" onClick={onNext} disabled={!pagination.hasNext}>Next</Button>
          </div>
        </div>
        <div className="space-y-2">
          {users.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{item.full_name}</p>
                  <p className="text-xs text-slate-600">{item.email} · {item.role}</p>
                  <p className="text-xs font-mono text-slate-500">ID: {item.id}</p>
                </div>
                <span className={`status-pill ${item.account_status === 'active' ? 'success' : 'warning'}`}>{item.account_status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Accounts: {item.account_count} · Cards: {item.card_count}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onViewUser(item.id)}>View as User</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onInspectUser(item.id)}>Details</Button>
                <Button type="button" size="sm" variant="secondary" disabled={item.account_status !== 'active'} onClick={() => onDeactivateUser(item.id)}>Deactivate</Button>
                <Button type="button" size="sm" variant="secondary" disabled={item.account_status === 'active'} onClick={() => onReactivateUser(item.id)}>Reactivate</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onResetPassword(item.id)}>Reset Password</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onDeleteUser(item.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {users.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : null}
        </div>
      </Card>

      {selectedUserDetail?.user ? (
        <Card title="Selected User Details">
          <p className="text-sm text-slate-700">{selectedUserDetail.user.full_name} · {selectedUserDetail.user.email}</p>
          <p className="mt-1 text-xs font-mono text-slate-500">ID: {selectedUserDetail.user.id}</p>
          <p className="text-xs text-slate-500 mt-1">Accounts: {selectedUserDetail.accounts?.length || 0} · Cards: {selectedUserDetail.cards?.length || 0} · Transactions: {selectedUserDetail.transactions?.length || 0}</p>
        </Card>
      ) : null}
    </div>
  )
}

export function AdminCardsPage({ cards = [], filters, setFilters, onRefresh, onFreeze, onUnfreeze, onReportLost, onRetry }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Card Management</h1>
        <p className="mt-1 text-sm text-slate-600">Manage all user cards across statuses and providers.</p>
      </header>

      <Card title="Filters">
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="User (Name or Email)" placeholder="e.g., sara@bank.com or Sara" value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value })} />
          <Input label="Card Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} />
          <Input label="Provider Status" value={filters.providerStatus} onChange={(event) => setFilters({ ...filters, providerStatus: event.target.value })} />
          <div className="flex items-end"><Button variant="secondary" size="sm" className="w-full" onClick={onRefresh}>Refresh</Button></div>
        </div>
      </Card>

      <Card title="Cards">
        <div className="space-y-2">
          {cards.map((card) => (
            <div key={card.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="font-semibold text-slate-900">{card.full_name} · {card.card_type} •••• {card.card_last4}</p>
              <p className="text-xs text-slate-600">{card.email} · status: {card.status} · provider: {card.provider_status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onFreeze(card.id)}>Freeze</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onUnfreeze(card.id)}>Unfreeze</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onReportLost(card.id)}>Report Lost</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onRetry(card.id)}>Retry</Button>
              </div>
            </div>
          ))}
          {cards.length === 0 ? <p className="text-sm text-slate-500">No cards found.</p> : null}
        </div>
      </Card>
    </div>
  )
}

export function AdminNotificationsPage({ form, setForm, onSend }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Send Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">Send in-app notifications to one user or broadcast to all active users.</p>
      </header>

      <Card title="Compose Notification">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSend}>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.broadcast}
              onChange={(event) => setForm({ ...form, broadcast: event.target.checked })}
            />
            Broadcast to all active users
          </label>
          <Input label="User ID" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} disabled={form.broadcast} />
          <Input label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Input label="Body" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          <div className="sm:col-span-2">
            <Button type="submit">Send Notification</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export function AdminTransactionsPage({ transactions = [], activity = [], transactionFilters, setTransactionFilters, activityFilters, setActivityFilters, onRefreshTransactions, onReverse, onRefreshActivity }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Transactions & Activity</h1>
        <p className="mt-1 text-sm text-slate-600">Review transfer activity and reverse completed transfers when required.</p>
      </header>

      <Card title="Transaction Filters">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="User (Name or Email)" placeholder="e.g., sara@bank.com or Sara" value={transactionFilters.userId} onChange={(event) => setTransactionFilters({ ...transactionFilters, userId: event.target.value })} />
          <Input label="Status" value={transactionFilters.status} onChange={(event) => setTransactionFilters({ ...transactionFilters, status: event.target.value })} />
          <div className="flex items-end"><Button variant="secondary" size="sm" className="w-full" onClick={onRefreshTransactions}>Refresh Transactions</Button></div>
        </div>
      </Card>

      <Card title="Transactions">
        <div className="space-y-2">
          {transactions.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="font-semibold text-slate-900">{item.from_user_name} → {item.to_user_name}</p>
              <p className="text-xs text-slate-600">Amount: {item.amount} · Status: {item.status} · {formatDate(item.created_at)}</p>
              <div className="mt-2">
                <Button type="button" size="sm" variant="secondary" disabled={item.status !== 'completed'} onClick={() => onReverse(item.id)}>Reverse</Button>
              </div>
            </div>
          ))}
          {transactions.length === 0 ? <p className="text-sm text-slate-500">No transactions found.</p> : null}
        </div>
      </Card>

      <Card title="User Activity">
        <div className="grid gap-4 sm:grid-cols-4 mb-3">
          <Input label="Actor (Name or Email)" placeholder="e.g., sara@bank.com or Sara" value={activityFilters.userId} onChange={(event) => setActivityFilters({ ...activityFilters, userId: event.target.value })} />
          <Input label="From" type="datetime-local" value={activityFilters.from} onChange={(event) => setActivityFilters({ ...activityFilters, from: event.target.value })} />
          <Input label="To" type="datetime-local" value={activityFilters.to} onChange={(event) => setActivityFilters({ ...activityFilters, to: event.target.value })} />
          <div className="flex items-end"><Button variant="secondary" size="sm" className="w-full" onClick={onRefreshActivity}>Refresh Activity</Button></div>
        </div>
        <div className="space-y-2">
          {activity.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="font-mono text-xs text-sky-700">{item.event_type}</p>
              <p className="text-xs text-slate-600">{item.email || item.actor_user_id || 'system'} · {formatDate(item.created_at)}</p>
            </div>
          ))}
          {activity.length === 0 ? <p className="text-sm text-slate-500">No activity records found.</p> : null}
        </div>
      </Card>
    </div>
  )
}

export function AdminLoansPage({
  loans = [],
  pagination = {},
  filters,
  setFilters,
  decisionForm,
  setDecisionForm,
  onRefresh,
  onApprove,
  onReject,
  onPrev,
  onNext,
}) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Loan Management</h1>
        <p className="mt-1 text-sm text-slate-600">Review loan applications and approve or reject requests.</p>
      </header>

      <Card title="Loan Filters">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Search User" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <Input label="Status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} />
          <div className="flex items-end"><Button variant="secondary" size="sm" className="w-full" onClick={onRefresh}>Refresh</Button></div>
        </div>
      </Card>

      <Card title="Loan Applications">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>Total: {Number(pagination.total || 0)}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onPrev} disabled={!pagination.hasPrevious}>Previous</Button>
            <Button type="button" variant="secondary" size="sm" onClick={onNext} disabled={!pagination.hasNext}>Next</Button>
          </div>
        </div>
        <div className="space-y-2">
          {loans.map((loan) => (
            <div key={loan.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="font-semibold text-slate-900">{loan.full_name} · {loan.email}</p>
              <p className="text-xs text-slate-600">Amount: {loan.amount} · Status: {loan.status} · Applied: {formatDate(loan.applied_at)}</p>
              <p className="text-xs text-slate-600">Requested term/rate: {loan.requested_term_months} months / {loan.requested_interest_rate}%</p>
              <p className="text-xs text-slate-600">Target account: {loan.target_account_number}</p>
              {loan.status === 'pending' ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Input
                    label="Override Term"
                    type="number"
                    min="6"
                    max="60"
                    value={decisionForm[loan.id]?.term || ''}
                    onChange={(event) => setDecisionForm({ ...decisionForm, [loan.id]: { ...(decisionForm[loan.id] || {}), term: event.target.value, rate: decisionForm[loan.id]?.rate || '', reason: decisionForm[loan.id]?.reason || '' } })}
                  />
                  <Input
                    label="Override Rate"
                    type="number"
                    min="0"
                    max="36"
                    step="0.01"
                    value={decisionForm[loan.id]?.rate || ''}
                    onChange={(event) => setDecisionForm({ ...decisionForm, [loan.id]: { ...(decisionForm[loan.id] || {}), rate: event.target.value, term: decisionForm[loan.id]?.term || '', reason: decisionForm[loan.id]?.reason || '' } })}
                  />
                  <Input
                    label="Reject Reason"
                    value={decisionForm[loan.id]?.reason || ''}
                    onChange={(event) => setDecisionForm({ ...decisionForm, [loan.id]: { ...(decisionForm[loan.id] || {}), reason: event.target.value, term: decisionForm[loan.id]?.term || '', rate: decisionForm[loan.id]?.rate || '' } })}
                  />
                  <div className="flex items-end gap-2">
                    <Button type="button" size="sm" onClick={() => onApprove(loan.id)}>Approve</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => onReject(loan.id)}>Reject</Button>
                  </div>
                </div>
              ) : null}
              {loan.status === 'rejected' && loan.rejection_reason ? <p className="mt-1 text-xs text-rose-700">Reason: {loan.rejection_reason}</p> : null}
            </div>
          ))}
          {loans.length === 0 ? <p className="text-sm text-slate-500">No loans found.</p> : null}
        </div>
      </Card>
    </div>
  )
}
