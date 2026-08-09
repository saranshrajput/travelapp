import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

export default function Index() {
  const { ready, user } = useSession();
  if (!ready) return null;
  return <Redirect href={user ? '/trips' : '/signin'} />;
}
