import { Component, type ReactNode } from 'react'
import { BOARD_KEY, PROJECTS_KEY } from './store'

/** Last line of defence: a render error shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) { return { error } }

  clearAndReload = () => {
    try { localStorage.removeItem(BOARD_KEY); localStorage.removeItem(PROJECTS_KEY) } catch { /* storage unavailable: nothing saved to clear */ }
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="crash" role="alert" aria-labelledby="crash-title">
        <p className="eyebrow">Hackathon HQ</p>
        <h1 id="crash-title">The board could not be shown</h1>
        <p>Usually this is a board saved in this browser that this version can't read. Clearing it puts both boards back to the seed; notes, ticks and custom entries saved in this browser are lost.</p>
        <pre className="crash-error">{error.name}: {error.message}</pre>
        <div className="dialog-actions">
          <button type="button" className="button ghost" onClick={() => window.location.reload()}>Reload</button>
          <button type="button" className="button amber" onClick={this.clearAndReload}>Clear the saved board and reload</button>
        </div>
      </main>
    )
  }
}
