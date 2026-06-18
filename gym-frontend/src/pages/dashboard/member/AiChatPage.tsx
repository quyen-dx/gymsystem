import MemberLayout from '../../../components/layout/header/MemberLayout'
import AiChatWidget from '../../../components/chat/AiChatWidget'

export default function AiChatPage() {
  return (
    <MemberLayout hideFooter>
      <style>{`
        .member-shell-content:has(.ai-chat-layout-root) {
          padding: 0;
          height: calc(100dvh - 64px);
          min-height: calc(100dvh - 64px);
          overflow: hidden;
        }

        .ai-chat-layout-root {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .ai-chat-layout-root .ai-chat-anchor {
          width: 100%;
          height: 100%;
          flex: 1;
          min-height: 0;
          min-width: 0;
        }

        .ai-chat-layout-root .ai-chat-wrapper {
          width: 100%;
          height: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .ai-chat-layout-root .ai-chat-page-panel {
          border: 0 !important;
        }

        @media (max-width: 768px) {
          .member-shell-content:has(.ai-chat-layout-root) {
            height: calc(100dvh - 64px);
            min-height: calc(100dvh - 64px);
          }
        }

        @media (max-width: 520px) {
          .member-shell-content:has(.ai-chat-layout-root) {
            height: calc(100dvh - 64px);
            min-height: calc(100dvh - 64px);
          }
        }
      `}</style>
      <div className="ai-chat-layout-root">
        <AiChatWidget variant="page" />
      </div>
    </MemberLayout>
  )
}
