import { EditOutlined } from '@ant-design/icons'
import { useState } from 'react'
import InlineEditModal from './InlineEditModal'
import TypewriterSlogans from './TypewriterSlogans'

type EditableHeroSlogansProps = {
    slogans: string[]
    language?: string
    className?: string
    typeSpeed?: number
    deleteSpeed?: number
    pauseAfterTyping?: number
    pauseAfterDeleting?: number
    editable?: boolean
    onEditStart?: () => void
    rawSlogans?: any[]
    onSlogansChange?: (slogans: any[]) => void
}

export default function EditableHeroSlogans({
    slogans,
    language,
    className = '',
    typeSpeed,
    deleteSpeed,
    pauseAfterTyping,
    pauseAfterDeleting,
    editable = false,
    onEditStart,
    rawSlogans,
    onSlogansChange,
}: EditableHeroSlogansProps) {
    const [hovering, setHovering] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

    const handleClick = () => {
        if (!editable) return
        onEditStart?.()
        setModalOpen(true)
    }

    const handleSlogansChange = (newSlogans: any[]) => {
        onSlogansChange?.(newSlogans)
    }

    if (!editable) {
        return (
            <TypewriterSlogans
                slogans={slogans}
                language={language}
                className={className}
                typeSpeed={typeSpeed}
                deleteSpeed={deleteSpeed}
                pauseAfterTyping={pauseAfterTyping}
                pauseAfterDeleting={pauseAfterDeleting}
            />
        )
    }

    return (
        <>
            <div
                onClick={handleClick}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                style={{
                    display: 'inline-block',
                    maxWidth: '100%',
                    position: 'relative',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    border: hovering ? '2px dashed #e05a30' : '2px dashed transparent',
                    transition: 'all 0.2s ease',
                }}
            >
                <TypewriterSlogans
                    slogans={slogans}
                    language={language}
                    className={className}
                    typeSpeed={typeSpeed}
                    deleteSpeed={deleteSpeed}
                    pauseAfterTyping={pauseAfterTyping}
                    pauseAfterDeleting={pauseAfterDeleting}
                />
                {hovering && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#e05a30',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '12px',
                            animation: 'fadeIn 0.2s ease-in',
                        }}
                    >
                        <EditOutlined style={{ fontSize: '12px' }} />
                    </div>
                )}
            </div>

            <InlineEditModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                field={{ field: 'slogans' }}
                value={rawSlogans || []}
                onChange={handleSlogansChange}
            />

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </>
    )
}
