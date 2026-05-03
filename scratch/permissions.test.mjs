import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

if (!process.env.TEST_RUN) {
  const result = spawnSync('npx', ['tsx', fileURLToPath(import.meta.url)], { 
    stdio: 'inherit', 
    env: { ...process.env, TEST_RUN: '1' } 
  });
  process.exit(result.status ?? 1);
} else {
  // We are running inside tsx now!
  const { resolveTabAccess, buildUserContext } = await import('../src/lib/permissions.ts');

  let passed = 0;
  let total = 0;

  function assertAccess(name, tabObj, userContextArgs, expected) {
    total++;
    try {
      const context = buildUserContext(userContextArgs);
      const result = resolveTabAccess(tabObj, context);
      if (result.role !== expected.role) {
        console.log(`❌ FAIL: ${name} | Expected role ${expected.role}, got ${result.role}`);
      } else {
        passed++;
        console.log(`✅ PASS: ${name}`);
      }
    } catch (e) {
      console.log(`❌ FAIL: ${name} | Threw error: ${e.message}`);
    }
  }

  console.log("=== Running Permissions Tests ===");

  assertAccess("Owner gets owner role", 
    { owners: [{id: '1'}], editors: [], departmentAccess: [], pushRules: [] },
    { userId: '1', isAdminView: false },
    { role: 'owner' }
  );

  assertAccess("Editor gets editor role", 
    { owners: [{id: '1'}], editors: [{id: '2'}], departmentAccess: [], pushRules: [] },
    { userId: '2', isAdminView: false },
    { role: 'editor' }
  );

  assertAccess("Department editor gets editor role", 
    { owners: [], editors: [], departmentAccess: [{ department: 'IT', role: 'editor' }], pushRules: [] },
    { userId: '3', dashboardGroup: 'IT', isAdminView: false },
    { role: 'editor' }
  );

  assertAccess("Pushed workspace gets viewer role and source metadata", 
    { owners: [], editors: [], departmentAccess: [], pushRules: [{ targetType: 'department', targetId: 'IT' }] },
    { userId: '3', dashboardGroup: 'IT', isAdminView: false },
    { role: 'viewer', source: 'push' }
  );

  assertAccess("No access yields none", 
    { owners: [{id: '1'}], editors: [], departmentAccess: [], pushRules: [] },
    { userId: '3', isAdminView: false },
    { role: 'none' }
  );

  assertAccess("Master admin gets owner role", 
    { owners: [], editors: [], departmentAccess: [], pushRules: [] },
    { userId: '9', isAdminView: true },
    { role: 'owner' }
  );

  console.log(`=== Tests Complete: ${passed}/${total} Passed ===`);
  if (passed !== total) process.exit(1);
}
