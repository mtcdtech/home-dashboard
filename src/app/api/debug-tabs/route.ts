import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const tabs = await prisma.tab.findMany({
    select: {
      id: true,
      title: true,
      isReadOnlySync: true,
      isLibraryItem: true,
      isPublic: true,
      departmentAccess: true,
      owners: { select: { name: true, email: true } },
      editors: { select: { name: true, email: true } },
      allowedUsers: { select: { name: true, email: true } },
      pushRules: true
    }
  });
  return NextResponse.json(tabs);
}
