import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './AIMessageFormatter.css'

export interface QuickAction {
  label: string
  onClick: () => void
}

interface AIMessageFormatterProps {
  content: string
  onQuickAction?: (label: string) => void
  externalActions?: QuickAction[]
}

function extractJsonContent(input: string): string {
  const trimmed = input.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return input
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed?.answer === 'string') return parsed.answer
    if (typeof parsed?.data?.answer === 'string') return parsed.data.answer
    if (typeof parsed?.message === 'string') return parsed.message
    if (typeof parsed?.text === 'string') return parsed.text
    return input
  } catch {
    return input
  }
}

const AIMessageFormatter: React.FC<AIMessageFormatterProps> = ({
  content,
  onQuickAction,
  externalActions,
}) => {
  const text = useMemo(() => {
    if (!content) return ''
    return extractJsonContent(content)
  }, [content])

  if (!text.trim()) {
    return <div className="aimf-root" />
  }

  return (
    <div>
      <div className="aimf-root">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            ),
            code: ({ className, children, ...props }: any) => {
              const isInline = !className
              if (isInline) {
                return <code {...props}>{children}</code>
              }
              return (
                <pre>
                  <code className={className} {...props}>{children}</code>
                </pre>
              )
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {externalActions && externalActions.length > 0 && (
        <div className="aimf-chips">
          {externalActions.map((action, i) => (
            <button
              key={i}
              type="button"
              className="aimf-chip"
              onClick={() => {
                if (action.onClick) {
                  action.onClick()
                } else {
                  onQuickAction?.(action.label)
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AIMessageFormatter
