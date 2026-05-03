import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

if (!process.env.TEST_RUN) {
  const result = spawnSync('npx', ['tsx', fileURLToPath(import.meta.url)], { 
    stdio: 'inherit', 
    env: { ...process.env, TEST_RUN: '1' } 
  });
  process.exit(result.status ?? 1);
} else {
  const { isSafeUrl } = await import('../src/lib/ssrf.ts');

  let passed = 0;
  let total = 0;

  async function assertSSRF(url, expectedSafe) {
    total++;
    try {
      const safe = await isSafeUrl(url);
      if (safe !== expectedSafe) {
        console.log(`❌ FAIL: ${url} | Expected ${expectedSafe}, got ${safe}`);
      } else {
        passed++;
        console.log(`✅ PASS: ${url}`);
      }
    } catch (e) {
      if (!expectedSafe) {
         passed++;
         console.log(`✅ PASS: ${url} (Rejected: ${e.message})`);
      } else {
         console.log(`❌ FAIL: ${url} | Threw error: ${e.message}`);
      }
    }
  }

  async function runTests() {
    console.log("=== Running Security Tests ===");

    await assertSSRF("https://google.com", true);
    await assertSSRF("http://example.com/image.png", true);
    await assertSSRF("file:///etc/passwd", false);
    await assertSSRF("ftp://example.com", false);
    await assertSSRF("http://localhost:8080", false);
    await assertSSRF("http://127.0.0.1", false);
    await assertSSRF("http://169.254.169.254/latest/meta-data/", false); // AWS Metadata
    await assertSSRF("http://10.0.0.1", false); // Private IP
    await assertSSRF("http://192.168.1.1", false); // Private IP
    await assertSSRF("http://0.0.0.0", false);

    console.log(`=== Tests Complete: ${passed}/${total} Passed ===`);
    if (passed !== total) process.exit(1);
  }

  runTests();
}
