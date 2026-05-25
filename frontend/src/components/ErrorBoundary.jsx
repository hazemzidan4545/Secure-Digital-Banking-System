import { Component } from 'react'
import Button from './ui/Button'
import Card from './ui/Card'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Frontend crash captured by ErrorBoundary', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <Card title="Something went wrong" subtitle="Please reload the page and try again.">
            <Button onClick={() => window.location.reload()}>Reload Application</Button>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
