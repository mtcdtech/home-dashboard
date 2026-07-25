import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

const IAM_EXPORT_URL =
  process.env.IAM_EXPORT_URL || "https://admin.server.mtcd.org/iam/api/export/users";

type IamPerson = {
  mtcd_person_id: string;
  email?: string | null;
  ms_email?: string | null;
  pco_email?: string | null;
  cc_email?: string | null;
  emails?: string[];
  mtcd_login_source?: string | null;
};

function normalizeEmail(e?: string | null): string | null {
  if (!e || typeof e !== "string") return null;
  return e.trim().toLowerCase() || null;
}

function collectPersonEmails(p: IamPerson): Set<string> {
  const emails = new Set<string>();
  const push = (e?: string | null) => {
    const n = normalizeEmail(e);
    if (n) emails.add(n);
  };
  push(p.email);
  push(p.ms_email);
  push(p.pco_email);
  push(p.cc_email);
  (p.emails || []).forEach(push);
  return emails;
}

export async function runIamBackfill({ apply = false }: { apply?: boolean } = {}) {
  const dryRun = !apply;
  console.log(`[backfill] Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);

  console.log(`[backfill] Fetching ${IAM_EXPORT_URL}`);
  const resp = await fetch(IAM_EXPORT_URL);
  if (!resp.ok) throw new Error(`IAM export fetch failed: ${resp.status}`);
  const data = await resp.json();
  const people: IamPerson[] = Array.isArray(data) ? data : (data.users || []);
  console.log(`[backfill] Fetched ${people.length} people from IAM`);

  const emailIndex = new Map<string, string[]>();
  for (const p of people) {
    if (!p.mtcd_person_id) continue;
    for (const e of collectPersonEmails(p)) {
      const arr = emailIndex.get(e) || [];
      if (!arr.includes(p.mtcd_person_id)) arr.push(p.mtcd_person_id);
      emailIndex.set(e, arr);
    }
  }

  const sourceByPid = new Map<string, string>();
  for (const p of people) {
    if (p.mtcd_person_id && p.mtcd_login_source) {
      sourceByPid.set(p.mtcd_person_id, p.mtcd_login_source);
    }
  }

  const users = await prisma.user.findMany({
    where: { mtcdPersonId: null },
    select: { id: true, email: true, name: true },
  });
  console.log(`[backfill] Local Users without pid: ${users.length}`);

  const stats = { matched: 0, ambiguous: 0, unmatched: 0, alreadyTaken: 0, applied: 0 };
  const rows: any[] = [];

  for (const u of users) {
    const email = normalizeEmail(u.email);
    if (!email) {
      stats.unmatched++;
      rows.push({ id: u.id, email: u.email, status: "no_email" });
      continue;
    }
    const pids = emailIndex.get(email) || [];
    if (pids.length === 0) {
      stats.unmatched++;
      rows.push({ id: u.id, email, status: "unmatched" });
      continue;
    }
    if (pids.length > 1) {
      stats.ambiguous++;
      rows.push({ id: u.id, email, status: "ambiguous", pids });
      continue;
    }
    const pid = pids[0];

    const existing = await prisma.user.findUnique({ where: { mtcdPersonId: pid } });
    if (existing && existing.id !== u.id) {
      stats.alreadyTaken++;
      rows.push({ id: u.id, email, status: "pid_taken_by", pid, takenBy: existing.id });
      continue;
    }

    stats.matched++;
    rows.push({ id: u.id, email, status: "match", pid });

    if (apply) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          mtcdPersonId: pid,
          mtcdIdentitySource: sourceByPid.get(pid) || null,
          mtcdLastSyncedAt: new Date(),
        },
      });
      stats.applied++;
    }
  }

  console.log("\n[backfill] Summary:", stats);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = `backfill-report-${timestamp}.csv`;
  const csv = [
    "id,email,status,pid,notes",
    ...rows.map((r) =>
      [
        r.id,
        r.email || "",
        r.status,
        r.pid || (r.pids || []).join("|"),
        r.takenBy ? `takenBy=${r.takenBy}` : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  await fs.promises.writeFile(outFile, csv);
  console.log(`[backfill] CSV written to ${outFile}`);

  return { stats, rows, outFile };
}

async function main() {
  const apply = process.argv.includes("--apply");
  await runIamBackfill({ apply });
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
