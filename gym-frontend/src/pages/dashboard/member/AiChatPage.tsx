import MemberLayout from '../../../components/layout/header/MemberLayout'

export default function AiChatPage() {
  return (
    <MemberLayout hideFooter>
      <div style={{ padding: 40, textAlign: 'center', marginTop: 100 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#888' }}>AI Assistant</h2>
        <p style={{ color: '#aaa', marginTop: 12 }}>AI feature has been removed.</p>
      </div>
    </MemberLayout>
  )
}
