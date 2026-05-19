import { redirect } from 'next/navigation'

export default function FrenchDashboardRedirect({ params }: { params: { userId: string } }) {
  redirect(`/${params.userId}/progress?branch=fran%C3%A7ais`)
}
