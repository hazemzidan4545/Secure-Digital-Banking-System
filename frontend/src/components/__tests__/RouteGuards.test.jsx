import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminRoute, PrivateRoute, UserRoute } from '../RouteGuards'

function renderWithRoutes(element, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={element} />
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RouteGuards', () => {
  test('PrivateRoute redirects unauthenticated users to login', () => {
    renderWithRoutes(
      <PrivateRoute user={null}>
        <div>protected</div>
      </PrivateRoute>
    )

    expect(screen.getByText('login-page')).toBeInTheDocument()
  })

  test('AdminRoute redirects non-admin users to dashboard', () => {
    renderWithRoutes(
      <AdminRoute user={{ role: 'user' }}>
        <div>admin-only</div>
      </AdminRoute>
    )

    expect(screen.getByText('dashboard-page')).toBeInTheDocument()
  })

  test('UserRoute allows impersonating admin users', () => {
    renderWithRoutes(
      <UserRoute user={{ role: 'admin', is_impersonating: true }}>
        <div>user-content</div>
      </UserRoute>
    )

    expect(screen.getByText('user-content')).toBeInTheDocument()
  })
})
