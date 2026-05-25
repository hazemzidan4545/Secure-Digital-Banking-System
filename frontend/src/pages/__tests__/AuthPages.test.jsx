import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage, MfaPage } from '../AuthPages'

describe('LoginPage', () => {
  function getInputByLabel(labelText) {
    const labelNode = screen.getByText(labelText)
    const containerLabel = labelNode.closest('label')
    if (!containerLabel) throw new Error(`${labelText} label container not found`)
    const input = containerLabel.querySelector('input')
    if (!input) throw new Error(`${labelText} input not found`)
    return input
  }

  test('renders email and password inputs', () => {
    const setLoginForm = jest.fn()

    render(
      <MemoryRouter>
        <LoginPage
          loginForm={{ email: '', password: '' }}
          setLoginForm={setLoginForm}
          onSubmit={(event) => event.preventDefault()}
          busy={false}
          onOAuthGithub={jest.fn()}
          oauthGithubEnabled={false}
          oauthBusy={false}
          formErrors={{}}
        />
      </MemoryRouter>
    )

    expect(getInputByLabel('Email')).toBeInTheDocument()
    expect(getInputByLabel('Password')).toBeInTheDocument()
  })

  test('updates email through setLoginForm on change', () => {
    const setLoginForm = jest.fn()

    render(
      <MemoryRouter>
        <LoginPage
          loginForm={{ email: 'user@test.com', password: 'Pass123!' }}
          setLoginForm={setLoginForm}
          onSubmit={(event) => event.preventDefault()}
          busy={false}
          onOAuthGithub={jest.fn()}
          oauthGithubEnabled={false}
          oauthBusy={false}
          formErrors={{}}
        />
      </MemoryRouter>
    )

    fireEvent.change(getInputByLabel('Email'), { target: { value: 'new@test.com' } })

    expect(setLoginForm).toHaveBeenCalledWith({
      email: 'new@test.com',
      password: 'Pass123!',
    })
  })

  test('submits login form and calls onSubmit', () => {
    const onSubmit = jest.fn((event) => event.preventDefault())

    render(
      <MemoryRouter>
        <LoginPage
          loginForm={{ email: 'user@test.com', password: 'Pass123!' }}
          setLoginForm={jest.fn()}
          onSubmit={onSubmit}
          busy={false}
          onOAuthGithub={jest.fn()}
          oauthGithubEnabled={false}
          oauthBusy={false}
          formErrors={{}}
        />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Request MFA Code' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('disables submit button when busy is true', () => {
    render(
      <MemoryRouter>
        <LoginPage
          loginForm={{ email: 'user@test.com', password: 'Pass123!' }}
          setLoginForm={jest.fn()}
          onSubmit={(event) => event.preventDefault()}
          busy={true}
          onOAuthGithub={jest.fn()}
          oauthGithubEnabled={false}
          oauthBusy={false}
          formErrors={{}}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Request MFA Code' })).toBeDisabled()
  })
})

describe('MfaPage', () => {
  test('renders OTP input and hint', () => {
    render(
      <MemoryRouter>
        <MfaPage
          mfaCode=""
          setMfaCode={jest.fn()}
          onSubmit={(event) => event.preventDefault()}
          busy={false}
          formErrors={{}}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('6-digit OTP')).toBeInTheDocument()
    expect(screen.getByDisplayValue('')).toBeInTheDocument()
  })

  test('calls setMfaCode when OTP input changes', () => {
    const setMfaCode = jest.fn()

    render(
      <MemoryRouter>
        <MfaPage
          mfaCode=""
          setMfaCode={setMfaCode}
          onSubmit={(event) => event.preventDefault()}
          busy={false}
          formErrors={{}}
        />
      </MemoryRouter>
    )

    const otpInput = screen.getByRole('textbox')
    fireEvent.change(otpInput, { target: { value: '123456' } })

    expect(setMfaCode).toHaveBeenCalledWith('123456')
  })
})
