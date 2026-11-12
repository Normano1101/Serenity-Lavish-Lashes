// A safety net for unexpected errors. Without it, one crash anywhere in React blanks the
// whole page to white; with it, the visitor sees a message and a way to recover.
// Error boundaries must be class components: React has no hook equivalent.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // Keep the details in the browser console for debugging.
        console.error('Page crashed:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <main className="site-page" role="alert">
                <h1>Something went wrong</h1>
                <p>This page hit an unexpected problem. Reloading usually fixes it.</p>
                <p><small>{this.state.error.message}</small></p>
                <p>
                    <button type="button" className="btn" onClick={() => window.location.reload()}>Reload page</button>
                    {' '}
                    <a href="/">Go to the home page</a>
                </p>
            </main>
        );
    }
}
