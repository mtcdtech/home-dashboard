const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: { contains: "avteam" } } });
  console.log("User:", user?.email, "dashboardGroup:", user?.dashboardGroup);
  
  const sections = await prisma.section.findMany({
    where: { isLibraryItem: true },
    include: { departmentAccess: true, allowedUsers: true }
  });
  
  console.log("Sections with departmentAccess matching 'General':");
  sections.forEach(s => {
    const da = s.departmentAccess.find(d => d.department === "General" || d.department === "Entire Organization" || d.department === user?.dashboardGroup);
    if (da && da.role !== "none") {
      console.log("-", s.title, "| Dept:", da.department, "| Role:", da.role);
    }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
