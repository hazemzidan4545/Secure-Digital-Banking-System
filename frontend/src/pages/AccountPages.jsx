import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { formatCurrency, formatDate, getStatusTone } from '../utils/formatters'
import { strengthLabel } from '../utils/securityUi'

export function LandingPage() {
  const coreServices = [
    ['Personal Banking', 'Current and savings accounts built for daily confidence.'],
    ['Business Banking', 'Payment flows and account controls tailored for operations.'],
    ['Secure Digital Access', 'MFA, CSRF protection, and trusted-session controls by default.'],
  ]

  const editorialStats = [
    ['24/7', 'Digital banking availability'],
    ['MFA', 'Hardened sign-in and session checks'],
    ['Instant', 'Domestic transfer execution'],
  ]

  return (
    <div className="banking-container py-12 sm:py-20">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
        <article className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-white/90 p-7 shadow-[0_22px_60px_-34px_rgba(30,64,175,0.55)] sm:p-10">
          <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-sky-300/40 to-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-400/20 to-cyan-300/20 blur-3xl" />
          <div className="relative space-y-7">
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800">
              The Egyptian British bank
            </p>
            <h1 className="text-display text-slate-950">Stable Banking. Bold Digital Experience.</h1>
            <p className="max-w-2xl text-base text-slate-700 sm:text-lg">
              The Egyptian British bank combines trusted financial operations with secure-by-design digital services for personal and business customers.
            </p>

            <div className="flex flex-wrap gap-2.5">
              <Link to="/login"><Button size="lg">Sign In</Button></Link>
              <Link to="/register"><Button variant="secondary" size="lg">Open New Account</Button></Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {editorialStats.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                  <p className="text-xl font-black tracking-tight text-blue-900">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-white/45 bg-white/55 p-6 shadow-[0_25px_45px_-35px_rgba(14,116,144,0.8)] backdrop-blur-md sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">Editorial View</p>
          <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-slate-900">Built for clarity under pressure.</h2>
          <p className="mt-4 text-sm text-slate-700">
            Risk controls, transaction transparency, and responsive support come together in one interface that feels clean and decisive.
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="font-semibold text-slate-900">Security intelligence in real time</p>
              <p className="text-slate-600">Alerts, sessions, and trusted-device visibility from one control path.</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <p className="font-semibold text-slate-900">Performance that keeps up</p>
              <p className="text-slate-600">Fast login, smooth account actions, and immediate transfer feedback.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {coreServices.map(([title, text], index) => (
          <Card key={title} title={title}>
            <p className="text-sm text-slate-700">{text}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Track {index + 1}</p>
          </Card>
        ))}
      </section>

      <section className="mt-12 rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 px-6 py-8 text-white shadow-soft sm:px-10">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Start with The Egyptian British bank today</h2>
            <p className="mt-2 text-sm text-blue-100">Create your account and experience secure, modern banking in minutes.</p>
          </div>
          <Link to="/register"><Button variant="secondary" size="lg">Create Account</Button></Link>
        </div>
      </section>
    </div>
  )
}

export function DashboardPage({ user, accounts = [], transactions, onCopyAccount }) {
  // Filter out closed accounts for calculations
  const activeAccounts = accounts.filter(a => a.account_status === 'active')
  const nonClosedAccounts = accounts.filter(a => a.account_status !== 'closed')
  
  const totalBalance = nonClosedAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  const totalAccountCount = nonClosedAccounts.length
  const activeAccountCount = activeAccounts.length
  const securityStatus = 'Protected'

  const statItems = [
    ['Total Balance', formatCurrency(totalBalance, accounts[0]?.currency || 'EGP')],
    ['Total Accounts', String(totalAccountCount)],
    ['Active Accounts', String(activeAccountCount)],
    ['Security Status', securityStatus],
  ]

  // Get primary account for the card display
  const primaryAccount = accounts.find(a => a.is_primary) || accounts[0]

  return (
    <div className="banking-container space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user?.full_name || 'Customer'}</h1>
        <p className="text-sm text-slate-600">Track balances, move funds, and monitor your account security.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statItems.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card title="Accounts Overview" subtitle="Primary active account">
          {primaryAccount ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-900">Account:</span> {primaryAccount.account_number}</p>
              <p><span className="font-semibold text-slate-900">Currency:</span> {primaryAccount.currency}</p>
              <p><span className="font-semibold text-slate-900">Balance:</span> {formatCurrency(primaryAccount.balance, primaryAccount.currency)}</p>
              <Button variant="secondary" size="sm" onClick={onCopyAccount}>Copy Account Number</Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No account data available.</p>
          )}
        </Card>

        <Card title="Quick Actions" subtitle="Most-used banking actions">
          <div className="grid gap-3">
            <Link to="/accounts"><Button className="w-full">View All Accounts</Button></Link>
            <Link to="/transfers"><Button variant="secondary" className="w-full">Send Money</Button></Link>
            <Link to="/loans/apply"><Button variant="secondary" className="w-full">Apply for Loan</Button></Link>
            <Link to="/security"><Button variant="secondary" className="w-full">Security Settings</Button></Link>
          </div>
        </Card>

        <Card title="Profile" subtitle="Authenticated identity">
          <div className="space-y-2 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-900">Name:</span> {user?.full_name}</p>
            <p><span className="font-semibold text-slate-900">Email:</span> {user?.email}</p>
            <p><span className="font-semibold text-slate-900">Role:</span> {user?.role}</p>
          </div>
        </Card>
      </section>

      <Card title="Recent Transactions" subtitle="Latest account activity">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">From</th>
                <th className="py-3 pr-4">To</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 8).map((tx) => {
                const tone = getStatusTone(tx.status)
                return (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 text-slate-600">{formatDate(tx.created_at)}</td>
                    <td className="py-3 pr-4">{tx.from_account}</td>
                    <td className="py-3 pr-4">{tx.to_account}</td>
                    <td className="py-3 pr-4 font-semibold text-slate-900">{formatCurrency(tx.amount, primaryAccount?.currency || 'EGP')}</td>
                    <td className="py-3 pr-4"><span className={`status-pill ${tone}`}>{tx.status || 'completed'}</span></td>
                  </tr>
                )
              })}
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-500">No recent transactions yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function AccountsPage({ accounts = [], onCreateAccount, onDeactivateAccount, onReactivateAccount, onCloseAccount, accountActionBusy = false }) {
  const [pendingCloseId, setPendingCloseId] = useState('')
  const [closePhrase, setClosePhrase] = useState('')
  const [ackOne, setAckOne] = useState(false)
  const [ackTwo, setAckTwo] = useState(false)

  const canConfirmClose = closePhrase === 'CLOSE ACCOUNT' && ackOne && ackTwo

  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Accounts</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your banking accounts and balances.</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={() => onCreateAccount?.('checking')} disabled={accountActionBusy}>+ New Checking</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => onCreateAccount?.('savings')} disabled={accountActionBusy}>+ New Savings</Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.filter(item => item.account_status !== 'closed').map((item) => (
          <Card
            key={item.account_number}
            title={item.account_number}
            subtitle={`${item.is_primary ? 'Primary' : 'Secondary'} ${item.account_type ? item.account_type[0].toUpperCase() + item.account_type.slice(1) : 'Checking'}`}
          >
            <p className="text-sm text-slate-600">Available Balance</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(item.balance, item.currency)}</p>
            <p className="mt-1 text-xs text-slate-500">Currency: {item.currency} · Status: {item.account_status || 'active'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={accountActionBusy || item.account_status !== 'active'}
                onClick={() => onDeactivateAccount(item.id)}
              >
                Deactivate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={accountActionBusy || item.account_status !== 'deactivated'}
                onClick={() => onReactivateAccount(item.id)}
              >
                Reactivate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={accountActionBusy || item.account_status === 'closed' || Number(item.balance) !== 0}
                onClick={() => {
                  setPendingCloseId(item.id)
                  setClosePhrase('')
                  setAckOne(false)
                  setAckTwo(false)
                }}
              >
                Close
              </Button>
            </div>

            {pendingCloseId === item.id ? (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">Account closure confirmation required</p>
                <label className="flex items-start gap-2 text-xs text-amber-900">
                  <input type="checkbox" checked={ackOne} onChange={(event) => setAckOne(event.target.checked)} />
                  I understand this account will be marked closed and cannot be used for transfers.
                </label>
                <label className="flex items-start gap-2 text-xs text-amber-900">
                  <input type="checkbox" checked={ackTwo} onChange={(event) => setAckTwo(event.target.checked)} />
                  I confirm the balance is zero and all pending operations are resolved.
                </label>
                <Input
                  label="Type CLOSE ACCOUNT to confirm"
                  value={closePhrase}
                  onChange={(event) => setClosePhrase(event.target.value)}
                  placeholder="CLOSE ACCOUNT"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canConfirmClose || accountActionBusy}
                    onClick={() => {
                      onCloseAccount(item.id)
                      setPendingCloseId('')
                    }}
                  >
                    Confirm Close
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setPendingCloseId('')}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        ))}
        {accounts.length === 0 ? <Card title="No account data" subtitle="Account details will appear after authentication." /> : null}
      </section>
    </div>
  )
}

export function ProfilePage({ profileForm, setProfileForm, onSaveProfile, profileBusy }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your personal information and account identity details.</p>
      </header>

      <Card title="Personal Information" subtitle="Update your contact information securely.">
        <form onSubmit={onSaveProfile} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              label="Full Name"
              required
              value={profileForm.fullName}
              onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
            />
          </div>
          <Input
            label="Email"
            value={profileForm.email}
            disabled
            hint="Email updates are managed by support for security reasons."
          />
          <Input
            label="Phone Number"
            value={profileForm.phoneNumber}
            onChange={(event) => setProfileForm({ ...profileForm, phoneNumber: event.target.value })}
            placeholder="+20 10 1234 5678"
          />
          <div className="md:col-span-2">
            <Button type="submit" loading={profileBusy}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export function TransferPage({
  form,
  setForm,
  onSubmit,
  ownTransferForm,
  setOwnTransferForm,
  onSubmitOwnTransfer,
  busy,
  formErrors = {},
  accounts = [],
  beneficiaries = [],
  beneficiaryForm,
  setBeneficiaryForm,
  onAddBeneficiary,
  onDeleteBeneficiary,
  beneficiaryBusy,
}) {
  const isAmountValid = form.amount && Number(form.amount) > 0
  const isAccountValid = form.toAccountNumber && form.toAccountNumber.trim().length >= 5
  const isFormValid = isAmountValid && isAccountValid

  return (
    <div className="banking-container py-8">
      <Card title="Send Money" subtitle="Transfer funds securely with real-time fraud and policy checks.">
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">From Account</span>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value={form.fromAccountId || ''}
                onChange={(event) => setForm({ ...form, fromAccountId: event.target.value })}
              >
                {accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.account_number} ({item.account_type}) - {formatCurrency(item.balance, item.currency)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Input
            label="Recipient Account Number"
            required
            value={form.toAccountNumber}
            onChange={(event) => setForm({ ...form, toAccountNumber: event.target.value })}
            error={formErrors.toAccountNumber}
            hint="10-12 digit account number. Example: 1234567890"
          />
          <div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Choose Beneficiary</span>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value=""
                onChange={(event) => {
                  if (!event.target.value) return
                  setForm({ ...form, toAccountNumber: event.target.value })
                }}
              >
                <option value="">Select saved beneficiary (optional)</option>
                {beneficiaries.map((item) => (
                  <option key={item.id} value={item.account_number}>
                    {item.nickname} - {item.account_number}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Input
            label="Amount"
            type="number"
            min="1"
            step="0.01"
            required
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            error={formErrors.amount}
            hint={form.amount ? `You will transfer ${Number(form.amount).toFixed(2)} EGP` : 'Amount must be greater than 0'}
          />
          <div className="md:col-span-2">
            <Input
              label="Transfer Note"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              hint="Optional note, encrypted at rest."
            />
          </div>
          {formErrors.general && (
            <div className="md:col-span-2 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800 font-medium">⚠ {formErrors.general}</p>
            </div>
          )}
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" loading={busy} disabled={!isFormValid || busy}>Send Transfer</Button>
            <Button type="button" variant="secondary" onClick={() => setForm({ toAccountNumber: '', amount: '', note: '' })}>Clear</Button>
          </div>
        </form>
      </Card>

      <Card title="Transfer Between My Accounts" subtitle="Dedicated flow for moving funds across your own accounts.">
        <form onSubmit={onSubmitOwnTransfer} className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">From Account</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={ownTransferForm.fromAccountId}
              onChange={(event) => setOwnTransferForm({ ...ownTransferForm, fromAccountId: event.target.value })}
            >
              <option value="">Select source account</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.account_number} ({item.account_type})</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">To Account</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={ownTransferForm.toAccountId}
              onChange={(event) => setOwnTransferForm({ ...ownTransferForm, toAccountId: event.target.value })}
            >
              <option value="">Select destination account</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.account_number} ({item.account_type})</option>
              ))}
            </select>
          </label>
          <Input
            label="Amount"
            type="number"
            min="1"
            step="0.01"
            required
            value={ownTransferForm.amount}
            onChange={(event) => setOwnTransferForm({ ...ownTransferForm, amount: event.target.value })}
          />
          <Input
            label="Note"
            value={ownTransferForm.note}
            onChange={(event) => setOwnTransferForm({ ...ownTransferForm, note: event.target.value })}
          />
          <div className="md:col-span-2">
            <Button type="submit" loading={busy}>Transfer Between Accounts</Button>
          </div>
        </form>
      </Card>

      <Card title="Beneficiaries" subtitle="Save frequently used recipients for faster transfers.">
        <form onSubmit={onAddBeneficiary} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            label="Nickname"
            required
            value={beneficiaryForm.nickname}
            onChange={(event) => setBeneficiaryForm({ ...beneficiaryForm, nickname: event.target.value })}
          />
          <Input
            label="Account Number"
            required
            value={beneficiaryForm.accountNumber}
            onChange={(event) => setBeneficiaryForm({ ...beneficiaryForm, accountNumber: event.target.value })}
          />
          <div className="md:pt-8">
            <Button type="submit" loading={beneficiaryBusy}>Add</Button>
          </div>
        </form>

        <div className="mt-5 space-y-2">
          {beneficiaries.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.nickname}</p>
                <p className="text-xs text-slate-600">{item.account_number}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => onDeleteBeneficiary(item.id)}>
                Remove
              </Button>
            </div>
          ))}
          {beneficiaries.length === 0 ? <p className="text-sm text-slate-500">No beneficiaries saved yet.</p> : null}
        </div>
      </Card>
    </div>
  )
}

export function SecurityPage({ user, sessionTimeoutMinutes, oauthEnabled, mfaEnabled, onToggleMfa, mfaBusy, passwordForm, setPasswordForm, onChangePassword, passwordBusy, passwordStrength }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Security Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Review authentication posture and active controls.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="MFA" subtitle="Multi-factor authentication status">
          <p className="text-sm text-slate-600">Control whether login requires a second verification factor.</p>
          <p className="mt-2"><span className={`status-pill ${mfaEnabled ? 'success' : 'warning'}`}>{mfaEnabled ? 'Enabled' : 'Disabled'}</span></p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" loading={mfaBusy} onClick={() => onToggleMfa(!mfaEnabled)}>
              {mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
            </Button>
          </div>
        </Card>
        <Card title="Session Policy" subtitle="Inactivity timeout">
          <p className="text-sm text-slate-600">Current timeout: {sessionTimeoutMinutes} minutes</p>
          <p className="mt-2 text-xs text-slate-500">User: {user?.email}</p>
        </Card>
        <Card title="OAuth2 Login" subtitle="External provider access">
          <p className="text-sm text-slate-600">GitHub OAuth provider availability.</p>
          <p className="mt-2"><span className={`status-pill ${oauthEnabled ? 'success' : 'warning'}`}>{oauthEnabled ? 'Enabled' : 'Disabled'}</span></p>
        </Card>
        <Card title="Security Alerts" subtitle="Realtime event visibility">
          <p className="text-sm text-slate-600">Security events are available through audit and suspicious activity modules.</p>
        </Card>
      </section>

      <Card title="Change Password" subtitle="Use a strong password that meets policy requirements.">
        <form onSubmit={onChangePassword} className="grid gap-4 md:grid-cols-2">
          <Input
            label="Current Password"
            type="password"
            required
            value={passwordForm.currentPassword}
            onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
          />
          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <Input
              label="New Password"
              type="password"
              required
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
              hint={`Strength: ${strengthLabel(passwordStrength)}`}
            />
            <Input
              label="Confirm New Password"
              type="password"
              required
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={passwordBusy}>Update Password</Button>
          </div>
        </form>
      </Card>

      <Card title="Account Status" subtitle="Current account lifecycle state">
        <p className="text-sm text-slate-600">Status: <span className="font-semibold text-slate-900 capitalize">{user?.account_status || 'active'}</span></p>
      </Card>
    </div>
  )
}

export function VerifyEmailPage() {
  return (
    <div className="banking-container py-12">
      <Card title="Verify Email" subtitle="Email verification flow entry point.">
        <p className="text-sm text-slate-600">Verification is currently managed by the backend identity flow. This page is ready for token-based verification extension.</p>
      </Card>
    </div>
  )
}

export function TransactionsPage({ query, setQuery, items, currency = 'EGP', onDownloadStatement, statementBusy }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Transaction History</h1>
          <p className="mt-1 text-sm text-slate-600">Search and monitor your latest activity.</p>
        </div>
        <div className="w-full sm:w-96 space-y-2">
          <Input
            label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by account, amount, or note"
          />
          <Button type="button" size="sm" variant="secondary" loading={statementBusy} onClick={onDownloadStatement}>
            Download CSV Statement
          </Button>
        </div>
      </header>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">When</th>
                <th className="py-3 pr-4">From</th>
                <th className="py-3 pr-4">To</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-600">{formatDate(tx.created_at)}</td>
                  <td className="py-3 pr-4">{tx.from_account}</td>
                  <td className="py-3 pr-4">{tx.to_account}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{formatCurrency(tx.amount, currency)}</td>
                  <td className="py-3 pr-4 text-slate-600">{tx.note || '-'}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-500">No transactions match your search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function StatementsPage({ accounts = [], filters, setFilters, items = [], summary, onApplyFilters, onDownloadCsv, applyBusy, downloadBusy }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Statements</h1>
        <p className="mt-1 text-sm text-slate-600">Filter by account and date range, preview transactions, then export CSV.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Transactions</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary?.transactionCount || 0}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Debits</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{formatCurrency(summary?.totalDebits || 0, 'EGP')}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Credits</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(summary?.totalCredits || 0, 'EGP')}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Net Flow</p>
          <p className={`mt-2 text-2xl font-bold ${(summary?.netFlow || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(summary?.netFlow || 0, 'EGP')}
          </p>
        </Card>
      </section>

      <Card title="Statement Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Account</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={filters.accountId}
              onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}
            >
              <option value="">Select account</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>{item.account_number}</option>
              ))}
            </select>
          </label>
          <Input
            label="From"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
          <Input
            label="To"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
          <div className="flex items-end gap-2">
            <Button type="button" onClick={onApplyFilters} loading={applyBusy}>Apply</Button>
            <Button type="button" variant="secondary" onClick={onDownloadCsv} loading={downloadBusy}>Download CSV</Button>
          </div>
        </div>
      </Card>

      <Card title="Statement Preview">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">When</th>
                <th className="py-3 pr-4">From</th>
                <th className="py-3 pr-4">To</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-600">{formatDate(tx.created_at)}</td>
                  <td className="py-3 pr-4">{tx.from_account}</td>
                  <td className="py-3 pr-4">{tx.to_account}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{formatCurrency(tx.amount, 'EGP')}</td>
                  <td className="py-3 pr-4"><span className={`status-pill ${getStatusTone(tx.status)}`}>{tx.status || 'completed'}</span></td>
                  <td className="py-3 pr-4 text-slate-600">{tx.note || '-'}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-500">No statement transactions found for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function NotificationsPage({ notifications = [], unreadCount = 0, preferences, setPreferences, onSavePreferences, filters, setFilters, pagination, onApplyFilters, onPrevPage, onNextPage, onRefresh, onMarkRead, onMarkAllRead, busy, preferencesBusy }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">Stay updated with account, transfer, payment, and support events.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-pill warning">Unread: {unreadCount}</span>
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh} loading={busy}>Refresh</Button>
          <Button type="button" size="sm" onClick={onMarkAllRead} loading={busy} disabled={!unreadCount}>Mark All Read</Button>
        </div>
      </header>

      <Card title="Notification Preferences" subtitle="Control which updates you receive.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.inAppEnabled} onChange={(event) => setPreferences({ ...preferences, inAppEnabled: event.target.checked })} disabled={preferencesBusy} />
            In-App Notifications
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.emailEnabled} onChange={(event) => setPreferences({ ...preferences, emailEnabled: event.target.checked })} disabled={preferencesBusy} />
            Email Queue (Stub)
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.accountEnabled} onChange={(event) => setPreferences({ ...preferences, accountEnabled: event.target.checked })} disabled={preferencesBusy} />
            Account Updates
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.transferEnabled} onChange={(event) => setPreferences({ ...preferences, transferEnabled: event.target.checked })} disabled={preferencesBusy} />
            Transfer Updates
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.paymentEnabled} onChange={(event) => setPreferences({ ...preferences, paymentEnabled: event.target.checked })} disabled={preferencesBusy} />
            Payment Updates
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.supportEnabled} onChange={(event) => setPreferences({ ...preferences, supportEnabled: event.target.checked })} disabled={preferencesBusy} />
            Support Updates
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.securityEnabled} onChange={(event) => setPreferences({ ...preferences, securityEnabled: event.target.checked })} disabled={preferencesBusy} />
            Security Updates
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={preferences.systemEnabled} onChange={(event) => setPreferences({ ...preferences, systemEnabled: event.target.checked })} disabled={preferencesBusy} />
            System Updates
          </label>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={onSavePreferences} loading={preferencesBusy}>Save Preferences</Button>
        </div>
      </Card>

      <Card title="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Title or body"
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={filters.type}
              onChange={(event) => setFilters({ ...filters, type: event.target.value })}
            >
              <option value="">All</option>
              <option value="account">Account</option>
              <option value="transfer">Transfer</option>
              <option value="payment">Payment</option>
              <option value="support">Support</option>
              <option value="security">Security</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="inline-flex items-end gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(event) => setFilters({ ...filters, unreadOnly: event.target.checked })}
            />
            Unread only
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={onApplyFilters} loading={busy}>Apply Filters</Button>
          </div>
        </div>
      </Card>

      <Card title="Recent Notifications">
        <div className="space-y-3">
          {notifications.map((item) => (
            <div key={item.id} className={`rounded-lg border p-3 ${item.is_read ? 'border-slate-200 bg-white' : 'border-sky-300 bg-sky-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(item.created_at)} · {item.type}</p>
                </div>
                {!item.is_read ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => onMarkRead(item.id)} disabled={busy}>Mark Read</Button>
                ) : (
                  <span className="status-pill success">Read</span>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 ? <p className="text-sm text-slate-500">No notifications yet.</p> : null}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-500">Total: {pagination.total} · Page size: {pagination.limit}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onPrevPage} disabled={!pagination.hasPrevious || busy}>Previous</Button>
            <Button type="button" size="sm" variant="secondary" onClick={onNextPage} disabled={!pagination.hasNext || busy}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function SupportPage({ supportForm, setSupportForm, onSubmitSupport, busy, tickets = [] }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Support</h1>
        <p className="mt-1 text-sm text-slate-600">Contact support and track your submitted requests.</p>
      </header>

      <Card title="Contact Support" subtitle="Describe your issue and we will respond soon.">
        <form onSubmit={onSubmitSupport} className="grid gap-4">
          <Input
            label="Subject"
            required
            value={supportForm.subject}
            onChange={(event) => setSupportForm({ ...supportForm, subject: event.target.value })}
            placeholder="Account access issue"
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Message<span className="ml-1 text-red-600">*</span></span>
            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              rows={5}
              value={supportForm.message}
              onChange={(event) => setSupportForm({ ...supportForm, message: event.target.value })}
              placeholder="Please include relevant details, timestamps, and account context."
            />
          </label>
          <div>
            <Button type="submit" loading={busy}>Submit Ticket</Button>
          </div>
        </form>
      </Card>

      <Card title="Your Tickets">
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{ticket.subject}</p>
                <span className={`status-pill ${ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' : 'warning'}`}>
                  {ticket.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{ticket.message}</p>
              <p className="mt-2 text-xs text-slate-500">Created: {formatDate(ticket.created_at)}</p>
            </div>
          ))}
          {tickets.length === 0 ? <p className="text-sm text-slate-500">No support tickets yet.</p> : null}
        </div>
      </Card>
    </div>
  )
}

export function CardsPage({ cards = [], providerSummary = {}, providerPollingSeconds = 15, setProviderPollingSeconds, cardRequestForm, setCardRequestForm, onRequestCard, onFreezeCard, onUnfreezeCard, onReportLostCard, onRetryCard, onSyncCardProviders, busy }) {
  const [providerFilter, setProviderFilter] = useState('all')
  const visibleCards = cards.filter((card) => providerFilter === 'all' || String(card.provider_status || '').toLowerCase() === providerFilter)

  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Cards</h1>
            <p className="mt-1 text-sm text-slate-600">Manage debit/credit cards with freeze and loss reporting controls.</p>
            <p className="mt-1 text-xs text-slate-500">
              Pending provider items: {Number(providerSummary.pendingCount || 0)}
              {' · '}
              Last synced: {formatDate(providerSummary.lastSyncedAt)}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onSyncCardProviders} disabled={busy}>Sync Pending Providers</Button>
        </div>
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            Auto Refresh
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={providerPollingSeconds}
              onChange={(event) => setProviderPollingSeconds?.(Number(event.target.value))}
            >
              <option value={0}>Off</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </label>
        </div>
      </header>

      <Card title="Request New Card" subtitle="Mock card issuance for development environment.">
        <form onSubmit={onRequestCard} className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Card Type</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              value={cardRequestForm.cardType}
              onChange={(event) => setCardRequestForm({ ...cardRequestForm, cardType: event.target.value })}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
              <option value="virtual">Virtual</option>
            </select>
          </label>
          <div className="sm:pt-8">
            <Button type="submit" loading={busy}>Request Card</Button>
          </div>
        </form>
      </Card>

      <Card title="Your Cards">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            Provider Status
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={providerFilter}
              onChange={(event) => setProviderFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">pending</option>
              <option value="queued">queued</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="blocked">blocked</option>
              <option value="lost">lost</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">Showing {visibleCards.length} of {cards.length}</p>
        </div>
        <div className="space-y-3">
          {visibleCards.map((card) => {
            const cardStatus = String(card.status || '').toLowerCase()
            const providerStatus = String(card.provider_status || '').toLowerCase()
            const canFreeze = cardStatus === 'active' && !card.is_frozen && !card.is_reported_lost
            const canUnfreeze = cardStatus === 'frozen' && card.is_frozen && !card.is_reported_lost
            const canReportLost = !card.is_reported_lost
            const canRetryProvider = providerStatus === 'failed' && cardStatus === 'disabled' && !card.is_reported_lost

            return (
            <div key={card.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{card.card_type.toUpperCase()} •••• {card.card_last4}</p>
                <span className={`status-pill ${getStatusTone(card.status)}`}>{card.status}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Provider: {card.external_provider || '-'} · Provider Status:{' '}
                <span className={`status-pill ${getStatusTone(card.provider_status)}`}>{card.provider_status || '-'}</span>
                {card.provider_ref ? ` · Ref: ${card.provider_ref}` : ''}
              </p>
              {card.provider_error_message ? (
                <p className="mt-2 text-xs text-rose-700">Provider Error: {card.provider_error_message}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onFreezeCard(card.id)} disabled={busy || !canFreeze}>Freeze</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onUnfreezeCard(card.id)} disabled={busy || !canUnfreeze}>Unfreeze</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onReportLostCard(card.id)} disabled={busy || !canReportLost}>Report Lost</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onRetryCard(card.id)}
                  disabled={busy || !canRetryProvider}
                >
                  Retry Provider
                </Button>
              </div>
            </div>
          )})}
          {visibleCards.length === 0 ? <p className="text-sm text-slate-500">No cards match the selected provider status.</p> : null}
        </div>
      </Card>
    </div>
  )
}

export function BillsPage({ billForm, setBillForm, rechargeForm, setRechargeForm, scheduledForm, setScheduledForm, recurringForm, setRecurringForm, onPayBill, onRecharge, onSchedulePayment, onCreateRecurring, onRunRecurring, onToggleRecurring, onUpdateRecurring, onDeleteRecurring, onUpdatePayment, onCancelPayment, onUpdatePaymentStatus, onRetryPayment, onSyncPaymentProviders, providerSummary = {}, providerPollingSeconds = 15, setProviderPollingSeconds, payments = [], recurringPayments = [], busy }) {
  const [editingPaymentId, setEditingPaymentId] = useState('')
  const [editForm, setEditForm] = useState({ payeeName: '', reference: '', amount: '', scheduleAt: '' })
  const [editingRecurringId, setEditingRecurringId] = useState('')
  const [recurringEditForm, setRecurringEditForm] = useState({ payeeName: '', reference: '', amount: '', frequency: 'monthly', startAt: '', endAt: '' })
  const [paymentProviderFilter, setPaymentProviderFilter] = useState('all')

  const statusOptions = ['scheduled', 'in_progress', 'completed', 'cancelled']
  const visiblePayments = payments.filter((payment) => paymentProviderFilter === 'all' || String(payment.provider_status || '').toLowerCase() === paymentProviderFilter)

  const canTransitionPaymentStatus = (currentStatus, nextStatus) => {
    const from = String(currentStatus || '').toLowerCase()
    const to = String(nextStatus || '').toLowerCase()
    if (from === to) {
      return true
    }

    const transitions = {
      scheduled: new Set(['in_progress', 'completed', 'cancelled']),
      in_progress: new Set(['completed', 'cancelled']),
      completed: new Set([]),
      cancelled: new Set([]),
    }

    return Boolean(transitions[from] && transitions[from].has(to))
  }

  const isPaymentStatusOptionDisabled = (payment, nextStatus) => {
    const currentStatus = String(payment.status || '').toLowerCase()
    const providerStatus = String(payment.provider_status || '').toLowerCase()
    const safeNext = String(nextStatus || '').toLowerCase()

    if (!canTransitionPaymentStatus(currentStatus, safeNext)) {
      return true
    }

    if (providerStatus === 'succeeded' && safeNext !== 'completed') {
      return true
    }

    if (['failed', 'cancelled', 'reversed'].includes(providerStatus) && safeNext !== 'cancelled') {
      return true
    }

    if (['pending', 'queued'].includes(providerStatus) && safeNext === 'completed') {
      return true
    }

    return false
  }

  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bills & Payments</h1>
            <p className="mt-1 text-sm text-slate-600">Mock bill payment and scheduling controls for user-side testing.</p>
            <p className="mt-1 text-xs text-slate-500">
              Pending provider items: {Number(providerSummary.pendingCount || 0)}
              {' · '}
              Last synced: {formatDate(providerSummary.lastSyncedAt)}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onSyncPaymentProviders} disabled={busy}>Sync Pending Providers</Button>
        </div>
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            Auto Refresh
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={providerPollingSeconds}
              onChange={(event) => setProviderPollingSeconds?.(Number(event.target.value))}
            >
              <option value={0}>Off</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </label>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card title="Pay Bill">
          <form onSubmit={onPayBill} className="space-y-3">
            <Input label="Biller Name" required value={billForm.billerName} onChange={(event) => setBillForm({ ...billForm, billerName: event.target.value })} />
            <Input label="Reference" value={billForm.reference} onChange={(event) => setBillForm({ ...billForm, reference: event.target.value })} />
            <Input label="Amount" type="number" min="1" step="0.01" required value={billForm.amount} onChange={(event) => setBillForm({ ...billForm, amount: event.target.value })} />
            <Button type="submit" loading={busy}>Pay Bill</Button>
          </form>
        </Card>

        <Card title="Mobile Recharge">
          <form onSubmit={onRecharge} className="space-y-3">
            <Input label="Mobile Number" required value={rechargeForm.mobileNumber} onChange={(event) => setRechargeForm({ ...rechargeForm, mobileNumber: event.target.value })} />
            <Input label="Amount" type="number" min="1" step="0.01" required value={rechargeForm.amount} onChange={(event) => setRechargeForm({ ...rechargeForm, amount: event.target.value })} />
            <Button type="submit" loading={busy}>Recharge</Button>
          </form>
        </Card>

        <Card title="Schedule Payment">
          <form onSubmit={onSchedulePayment} className="space-y-3">
            <Input label="Payee" required value={scheduledForm.payeeName} onChange={(event) => setScheduledForm({ ...scheduledForm, payeeName: event.target.value })} />
            <Input label="Reference" value={scheduledForm.reference} onChange={(event) => setScheduledForm({ ...scheduledForm, reference: event.target.value })} />
            <Input label="Amount" type="number" min="1" step="0.01" required value={scheduledForm.amount} onChange={(event) => setScheduledForm({ ...scheduledForm, amount: event.target.value })} />
            <Input label="Schedule At" type="datetime-local" required value={scheduledForm.scheduleAt} onChange={(event) => setScheduledForm({ ...scheduledForm, scheduleAt: event.target.value })} />
            <Button type="submit" loading={busy}>Schedule</Button>
          </form>
        </Card>

        <Card title="Recurring Payment">
          <form onSubmit={onCreateRecurring} className="space-y-3">
            <Input label="Payee" required value={recurringForm.payeeName} onChange={(event) => setRecurringForm({ ...recurringForm, payeeName: event.target.value })} />
            <Input label="Reference" value={recurringForm.reference} onChange={(event) => setRecurringForm({ ...recurringForm, reference: event.target.value })} />
            <Input label="Amount" type="number" min="1" step="0.01" required value={recurringForm.amount} onChange={(event) => setRecurringForm({ ...recurringForm, amount: event.target.value })} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Frequency</span>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value={recurringForm.frequency}
                onChange={(event) => setRecurringForm({ ...recurringForm, frequency: event.target.value })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <Input label="Start At" type="datetime-local" required value={recurringForm.startAt} onChange={(event) => setRecurringForm({ ...recurringForm, startAt: event.target.value })} />
            <Input label="End At (Optional)" type="datetime-local" value={recurringForm.endAt} onChange={(event) => setRecurringForm({ ...recurringForm, endAt: event.target.value })} />
            <Button type="submit" loading={busy}>Create Recurring</Button>
          </form>
        </Card>
      </section>

      <Card title="Recent Payments">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            Provider Status
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={paymentProviderFilter}
              onChange={(event) => setPaymentProviderFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">pending</option>
              <option value="queued">queued</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
              <option value="reversed">reversed</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">Showing {visiblePayments.length} of {payments.length}</p>
        </div>
        <div className="space-y-2">
          {visiblePayments.map((payment) => {
            const paymentStatus = String(payment.status || '').toLowerCase()
            const providerStatus = String(payment.provider_status || '').toLowerCase()
            const canEditPayment = paymentStatus === 'scheduled'
            const canCancelPayment = ['scheduled', 'in_progress'].includes(paymentStatus)
            const canRetryProvider = ['failed', 'cancelled', 'reversed'].includes(providerStatus)
            const allStatusOptionsBlocked = statusOptions.every((status) => isPaymentStatusOptionDisabled(payment, status))

            return (
            <div key={payment.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{payment.payment_kind} - {payment.payee_name}</p>
                <span className={`status-pill ${getStatusTone(payment.status)}`}>{payment.status}</span>
              </div>
              <p className="text-xs text-slate-600">Amount: {formatCurrency(payment.amount, 'EGP')} · Ref: {payment.reference || '-'}</p>
              <p className="mt-1 text-xs text-slate-600">
                Provider: {payment.external_provider || '-'} · Provider Status:{' '}
                <span className={`status-pill ${getStatusTone(payment.provider_status)}`}>{payment.provider_status || '-'}</span>
                {payment.provider_ref ? ` · Ref: ${payment.provider_ref}` : ''}
              </p>
              {payment.provider_error_message ? (
                <p className="mt-1 text-xs text-rose-700">Provider Error: {payment.provider_error_message}</p>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingPaymentId(payment.id)
                    setEditForm({
                      payeeName: payment.payee_name,
                      reference: payment.reference || '',
                      amount: String(payment.amount),
                      scheduleAt: payment.schedule_at ? new Date(payment.schedule_at).toISOString().slice(0, 16) : '',
                    })
                  }}
                  disabled={busy || !canEditPayment}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onCancelPayment(payment.id)}
                  disabled={busy || !canCancelPayment}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onRetryPayment(payment.id)}
                  disabled={busy || !canRetryProvider}
                >
                  Retry Provider
                </Button>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  Status
                  <select
                    className="rounded border border-slate-300 px-2 py-1"
                    value={payment.status}
                    onChange={(event) => onUpdatePaymentStatus(payment.id, event.target.value)}
                    disabled={busy || allStatusOptionsBlocked}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status} disabled={isPaymentStatusOptionDisabled(payment, status)}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>

              {editingPaymentId === payment.id ? (
                <form
                  className="mt-3 grid gap-2 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onUpdatePayment(payment.id, editForm)
                    setEditingPaymentId('')
                  }}
                >
                  <Input label="Payee" value={editForm.payeeName} onChange={(event) => setEditForm({ ...editForm, payeeName: event.target.value })} />
                  <Input label="Reference" value={editForm.reference} onChange={(event) => setEditForm({ ...editForm, reference: event.target.value })} />
                  <Input label="Amount" type="number" min="1" step="0.01" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} />
                  <Input label="Schedule At" type="datetime-local" value={editForm.scheduleAt} onChange={(event) => setEditForm({ ...editForm, scheduleAt: event.target.value })} />
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="submit" size="sm" loading={busy}>Save</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditingPaymentId('')}>Cancel Edit</Button>
                  </div>
                </form>
              ) : null}
            </div>
          )})}
          {visiblePayments.length === 0 ? <p className="text-sm text-slate-500">No payments match the selected provider status.</p> : null}
        </div>
      </Card>

      <Card title="Recurring Payments">
        <div className="space-y-2">
          {recurringPayments.map((payment) => (
            <div key={payment.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{payment.payee_name} · {payment.frequency}</p>
                <span className={`status-pill ${payment.active ? 'success' : 'warning'}`}>{payment.active ? 'active' : 'paused'}</span>
              </div>
              <p className="text-xs text-slate-600">Amount: {formatCurrency(payment.amount, 'EGP')} · Next: {payment.next_run_at ? formatDate(payment.next_run_at) : '-'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onRunRecurring(payment.id)} disabled={busy || !payment.active}>Run Now</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onToggleRecurring(payment.id, !payment.active)} disabled={busy}>
                  {payment.active ? 'Pause' : 'Resume'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingRecurringId(payment.id)
                    setRecurringEditForm({
                      payeeName: payment.payee_name,
                      reference: payment.reference || '',
                      amount: String(payment.amount),
                      frequency: payment.frequency || 'monthly',
                      startAt: payment.start_at ? new Date(payment.start_at).toISOString().slice(0, 16) : '',
                      endAt: payment.end_at ? new Date(payment.end_at).toISOString().slice(0, 16) : '',
                    })
                  }}
                >
                  Edit
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onDeleteRecurring(payment.id)} disabled={busy}>Delete</Button>
              </div>

              {editingRecurringId === payment.id ? (
                <form
                  className="mt-3 grid gap-2 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onUpdateRecurring(payment.id, recurringEditForm)
                    setEditingRecurringId('')
                  }}
                >
                  <Input label="Payee" value={recurringEditForm.payeeName} onChange={(event) => setRecurringEditForm({ ...recurringEditForm, payeeName: event.target.value })} />
                  <Input label="Reference" value={recurringEditForm.reference} onChange={(event) => setRecurringEditForm({ ...recurringEditForm, reference: event.target.value })} />
                  <Input label="Amount" type="number" min="1" step="0.01" value={recurringEditForm.amount} onChange={(event) => setRecurringEditForm({ ...recurringEditForm, amount: event.target.value })} />
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">Frequency</span>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      value={recurringEditForm.frequency}
                      onChange={(event) => setRecurringEditForm({ ...recurringEditForm, frequency: event.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <Input label="Start At" type="datetime-local" value={recurringEditForm.startAt} onChange={(event) => setRecurringEditForm({ ...recurringEditForm, startAt: event.target.value })} />
                  <Input label="End At" type="datetime-local" value={recurringEditForm.endAt} onChange={(event) => setRecurringEditForm({ ...recurringEditForm, endAt: event.target.value })} />
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="submit" size="sm" loading={busy}>Save</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditingRecurringId('')}>Cancel Edit</Button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
          {recurringPayments.length === 0 ? <p className="text-sm text-slate-500">No recurring payments configured.</p> : null}
        </div>
      </Card>
    </div>
  )
}
