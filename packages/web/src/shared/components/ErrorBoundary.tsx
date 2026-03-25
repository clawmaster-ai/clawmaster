import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 页面级错误边界
 *
 * 包裹在每个模块页面外层，防止单页崩溃导致全应用白屏
 *
 * @example
 * <ErrorBoundary>
 *   <ObservePage />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="text-4xl mb-4">😵</div>
          <h2 className="text-xl font-semibold mb-2">页面出错了</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message ?? '发生了未知错误'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
