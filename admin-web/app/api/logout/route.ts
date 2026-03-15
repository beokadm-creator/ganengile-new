import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL ?? 'http://localhost:3001'));
  res.cookies.delete('admin_token');
  return res;
}
