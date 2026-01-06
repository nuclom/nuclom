import { redirect } from 'next/navigation';

export default async function SettingsPage({ params }: { params: Promise<{ organization: string }> }) {
  const { organization } = await params;

  // Redirect to profile settings as the default settings page
  redirect(`/${organization}/settings/profile`);
}
