// your-repo/page.tsx

import { redirect } from 'next/navigation';

export default function HomePage() {
  return <h1>Welcome to PocketGrowth</h1>;
  redirect('/login');
}
