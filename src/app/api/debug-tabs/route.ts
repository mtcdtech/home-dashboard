import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const tabs = await prisma.tab.findMany({
    where: { title: { contains: "Ben Personal" } },
    include: {
      owners: true,
      editors: true,
      allowedUsers: true,
      departmentAccess: true,
      pushRules: true
    }
  });
  return NextResponse.json(tabs);
}
