import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { strengthLabel } from '../utils/securityUi'

function AuthBackground({ children }) {
  return (
    <section className="banking-container py-12 sm:py-16">
      <div className="mx-auto max-w-xl rounded-[1.25rem] bg-gradient-to-br from-sky-100 via-white to-slate-100 p-3 shadow-soft">
        <div className="rounded-[1rem] bg-white/95 p-6 sm:p-8">{children}</div>
      </div>
    </section>
  )
}

export function LoginPage({ loginForm, setLoginForm, onSubmit, busy, onOAuthGithub, oauthGithubEnabled, oauthBusy, formErrors = {} }) {
  return (
    <AuthBackground>
      <Card title="Sign in to The Egyptian British bank" subtitle="Secure access with multi-factor authentication.">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={loginForm.email}
            onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
            error={formErrors.email}
          />
          <Input
            label="Password"
            type="password"
            required
            value={loginForm.password}
            onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            error={formErrors.password}
          />

          <div className="space-y-3 pt-1">
            <Button type="submit" loading={busy} className="w-full">Request MFA Code</Button>
            {oauthGithubEnabled ? (
              <Button type="button" variant="secondary" loading={oauthBusy} onClick={onOAuthGithub} className="w-full">
                Continue with GitHub
              </Button>
            ) : null}
          </div>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <Link to="/register" className="font-medium text-sky-700 hover:text-sky-900">Create account</Link>
          <Link to="/reset-request" className="font-medium text-sky-700 hover:text-sky-900">Forgot password?</Link>
        </div>
      </Card>
    </AuthBackground>
  )
}

export function RegisterPage({ registerForm, setRegisterForm, onSubmit, busy, strength, formErrors = {} }) {
  return (
    <AuthBackground>
      <Card title="Create your account" subtitle="Set up a secure profile in less than two minutes.">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First Name"
              required
              value={registerForm.firstName || ''}
              onChange={(event) => setRegisterForm({ ...registerForm, firstName: event.target.value })}
              error={formErrors.firstName}
            />
            <Input
              label="Last Name"
              required
              value={registerForm.lastName || ''}
              onChange={(event) => setRegisterForm({ ...registerForm, lastName: event.target.value })}
              error={formErrors.lastName}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={registerForm.email}
            onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
            error={formErrors.email}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone"
              type="tel"
              required
              value={registerForm.phone || ''}
              onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
              error={formErrors.phone}
            />
            <Input
              label="Date of Birth"
              type="date"
              required
              value={registerForm.dateOfBirth || ''}
              onChange={(event) => setRegisterForm({ ...registerForm, dateOfBirth: event.target.value })}
              error={formErrors.dateOfBirth}
            />
          </div>
          <Input
            label="Password"
            type="password"
            required
            minLength={10}
            value={registerForm.password}
            onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
            hint="At least 10 characters with upper, lower, number, and symbol."
            error={formErrors.password}
          />
          <Input
            label="Confirm Password"
            type="password"
            required
            minLength={10}
            value={registerForm.confirmPassword || ''}
            onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
            error={formErrors.confirmPassword}
          />

          <div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 transition-all duration-200" style={{ width: `${(strength / 5) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">Password strength: {strengthLabel(strength)}</p>
          </div>

          <Button type="submit" loading={busy} className="w-full">Create Account</Button>
        </form>
      </Card>
    </AuthBackground>
  )
}

export function MfaPage({ mfaCode, setMfaCode, onSubmit, busy, formErrors = {} }) {
  return (
    <AuthBackground>
      <Card title="Multi-Factor Verification" subtitle="Enter the one-time code sent to your email address.">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="OTP Code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            required
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            error={formErrors.mfaCode}
            hint="6-digit OTP"
          />
          <Button type="submit" loading={busy} className="w-full">Verify and Continue</Button>
        </form>
      </Card>
    </AuthBackground>
  )
}

export function ResetRequestPage({ email, setEmail, onSubmit, busy, formErrors = {} }) {
  return (
    <AuthBackground>
      <Card title="Reset Password" subtitle="We will issue a secure reset token for your account.">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={formErrors.email}
          />
          <Button type="submit" loading={busy} className="w-full">Send Reset Instructions</Button>
        </form>
      </Card>
    </AuthBackground>
  )
}

export function ResetConfirmPage({ form, setForm, onSubmit, busy, strength, formErrors = {} }) {
  return (
    <AuthBackground>
      <Card title="Confirm Reset" subtitle="Apply your token and set a new password.">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Reset Token"
            required
            value={form.token}
            onChange={(event) => setForm({ ...form, token: event.target.value })}
            error={formErrors.token}
          />
          <Input
            label="New Password"
            type="password"
            required
            minLength={10}
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            error={formErrors.newPassword}
          />
          <div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 transition-all duration-200" style={{ width: `${(strength / 5) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">Password strength: {strengthLabel(strength)}</p>
          </div>
          <Button type="submit" loading={busy} className="w-full">Update Password</Button>
        </form>
      </Card>
    </AuthBackground>
  )
}
