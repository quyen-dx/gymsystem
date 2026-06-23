import MemberLayout from '../../../components/layout/header/MemberLayout'

export default function WorkoutPage() {
  return (
    <MemberLayout>
      <div className="member-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', opacity: 0.5, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏋️</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Chức năng đang phát triển</h2>
        <p style={{ fontSize: 14 }}>Workout sẽ sớm được ra mắt. Theo dõi để cập nhật!</p>
      </div>
    </MemberLayout>
  )
}
