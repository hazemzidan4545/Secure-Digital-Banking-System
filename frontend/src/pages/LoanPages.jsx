import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { formatCurrency, formatDate } from '../utils/formatters'

export function LoanApplicationPage({ form, setForm, accounts = [], onSubmit, busy }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Apply for Loan</h1>
        <p className="mt-1 text-sm text-slate-600">Submit your loan request for admin review and approval.</p>
      </header>

      <Card title="Loan Application">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <Input
            label="Amount (EGP)"
            type="number"
            min="1"
            step="0.01"
            required
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
          <Input
            label="Term (Months)"
            type="number"
            min="6"
            max="60"
            required
            value={form.termMonths}
            onChange={(event) => setForm({ ...form, termMonths: event.target.value })}
          />
          <Input
            label="Requested Interest (%)"
            type="number"
            min="0"
            max="36"
            step="0.01"
            required
            value={form.requestedInterestRate}
            onChange={(event) => setForm({ ...form, requestedInterestRate: event.target.value })}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Disbursement Account</span>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              required
              value={form.targetAccountId}
              onChange={(event) => setForm({ ...form, targetAccountId: event.target.value })}
            >
              <option value="">Select account</option>
              {accounts
                .filter((item) => item.account_status === 'active')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.account_number} ({formatCurrency(item.balance, item.currency)})
                  </option>
                ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <Input
              label="Purpose"
              required
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              hint="Describe why you need this loan (8-300 chars)."
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>Submit Application</Button>
            <Link to="/loans"><Button type="button" variant="secondary">View My Loans</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  )
}

export function LoanListPage({ loans = [] }) {
  return (
    <div className="banking-container space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
        <h1 className="text-3xl font-bold text-slate-900">My Loans</h1>
        <p className="mt-1 text-sm text-slate-600">Track your loan applications and status updates.</p>
        </div>
        <Link to="/loans/apply"><Button>Apply for Loan</Button></Link>
      </header>

      <Card title="Loan Applications">
        <div className="space-y-2">
          {loans.map((loan) => (
            <div key={loan.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{formatCurrency(loan.amount, 'EGP')} · {loan.status}</p>
                <Link to={`/loans/${loan.id}`} className="text-sm font-medium text-sky-700 hover:text-sky-900">Details</Link>
              </div>
              <p className="text-xs text-slate-600 mt-1">Term: {loan.approved_term_months || loan.requested_term_months} months · Rate: {loan.approved_interest_rate ?? loan.requested_interest_rate}%</p>
              <p className="text-xs text-slate-500 mt-1">Applied: {formatDate(loan.applied_at)} · Account: {loan.target_account_number}</p>
            </div>
          ))}
          {loans.length === 0 ? <p className="text-sm text-slate-500">No loans yet.</p> : null}
        </div>
      </Card>
    </div>
  )
}

export function LoanDetailsPage({ loan, repayments = [] }) {
  if (!loan) {
    return (
      <div className="banking-container py-8">
        <Card title="Loan details">
          <p className="text-sm text-slate-500">Loan not found.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="banking-container space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Loan Details</h1>
        <p className="mt-1 text-sm text-slate-600">Detailed view of one loan and installment schedule.</p>
      </header>

      <Card title="Overview">
        <p className="text-sm text-slate-700">Amount: <span className="font-semibold">{formatCurrency(loan.amount, 'EGP')}</span></p>
        <p className="text-sm text-slate-700">Status: <span className="font-semibold">{loan.status}</span></p>
        <p className="text-sm text-slate-700">Term: <span className="font-semibold">{loan.approved_term_months || loan.requested_term_months} months</span></p>
        <p className="text-sm text-slate-700">Rate: <span className="font-semibold">{loan.approved_interest_rate ?? loan.requested_interest_rate}%</span></p>
        <p className="text-sm text-slate-700">Purpose: <span className="font-semibold">{loan.purpose}</span></p>
        <p className="text-xs text-slate-500 mt-1">Applied: {formatDate(loan.applied_at)} · Account: {loan.target_account_number}</p>
      </Card>

      <Card title="Repayment Schedule">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4">Installment</th>
                <th className="py-3 pr-4">Due Date</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {repayments.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">#{item.installment_number}</td>
                  <td className="py-3 pr-4 text-slate-600">{formatDate(item.due_date)}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{formatCurrency(item.amount, 'EGP')}</td>
                  <td className="py-3 pr-4"><span className={`status-pill ${item.status === 'paid' ? 'success' : item.status === 'overdue' ? 'error' : 'warning'}`}>{item.status}</span></td>
                </tr>
              ))}
              {repayments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-6 text-center text-slate-500">No repayment schedule available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
