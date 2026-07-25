import { classifyProvider, extractPidClaims, findExistingUserByIam, safeEmailUpdate } from "./iam";

describe("IAM Integration Utilities", () => {
  describe("classifyProvider", () => {
    it("classifies authentik providers correctly", () => {
      expect(classifyProvider("authentik-pco")).toBe("authentik");
      expect(classifyProvider("authentik-ms")).toBe("authentik");
      expect(classifyProvider("authentik-cc")).toBe("authentik");
    });

    it("classifies legacy and alternative providers correctly", () => {
      expect(classifyProvider("microsoft-entra-id")).toBe("microsoft-entra");
      expect(classifyProvider("synology")).toBe("synology");
      expect(classifyProvider("credentials")).toBe("credentials");
      expect(classifyProvider(null)).toBe("unknown");
      expect(classifyProvider(undefined)).toBe("unknown");
    });
  });

  describe("extractPidClaims", () => {
    it("extracts claims from a valid profile", () => {
      const profile = {
        mtcd_person_id: "pid_12345",
        mtcd_login_source: "planning_center",
        mtcd_person_id_history: [{ previous_mtcd_person_id: "pid_old" }],
        mtcd_identities: { planning_center: [{ id: "pco_1" }] },
      };

      const result = extractPidClaims(profile);
      expect(result.pid).toBe("pid_12345");
      expect(result.loginSource).toBe("planning_center");
      expect(result.pidHistory).toEqual([{ previous_mtcd_person_id: "pid_old" }]);
      expect(result.identities).toEqual({ planning_center: [{ id: "pco_1" }] });
    });

    it("handles empty or partial profiles gracefully", () => {
      const result = extractPidClaims(null);
      expect(result.pid).toBeNull();
      expect(result.loginSource).toBeNull();
      expect(result.pidHistory).toEqual([]);
      expect(result.identities).toBeNull();
    });
  });

  describe("findExistingUserByIam", () => {
    it("matches Tier 1 by mtcdPersonId", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.mtcdPersonId === "pid_123") return Promise.resolve({ id: "u1", mtcdPersonId: "pid_123", email: "alice@mtcd.org" });
            return Promise.resolve(null);
          }),
        },
      };

      const res = await findExistingUserByIam({ pid: "pid_123", pidHistory: [], email: "alice@mtcd.org", db: mockDb as any });
      expect(res.matchedBy).toBe("pid");
      expect(res.user.id).toBe("u1");
    });

    it("matches Tier 2 by pidHistory and updates mtcdPersonId", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.mtcdPersonId === "pid_old") return Promise.resolve({ id: "u1", mtcdPersonId: "pid_old", email: "alice@mtcd.org" });
            if (where.mtcdPersonId === "pid_new") return Promise.resolve(null);
            return Promise.resolve(null);
          }),
          update: jest.fn().mockResolvedValue({ id: "u1", mtcdPersonId: "pid_new", email: "alice@mtcd.org" }),
        },
      };

      const res = await findExistingUserByIam({
        pid: "pid_new",
        pidHistory: [{ previous_mtcd_person_id: "pid_old" }],
        email: "alice@mtcd.org",
        db: mockDb as any,
      });

      expect(res.matchedBy).toBe("pid_history");
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { mtcdPersonId: "pid_new" },
      });
    });

    it("falls through to email match when Tier 2 conflicts with existing row holding new pid", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.mtcdPersonId === "pid_old") return Promise.resolve({ id: "u1", mtcdPersonId: "pid_old", email: "alice@mtcd.org" });
            if (where.mtcdPersonId === "pid_new") return Promise.resolve({ id: "u2", mtcdPersonId: "pid_new", email: "other@mtcd.org" });
            if (where.email === "alice@mtcd.org") return Promise.resolve({ id: "u1", email: "alice@mtcd.org" });
            return Promise.resolve(null);
          }),
        },
      };

      const res = await findExistingUserByIam({
        pid: "pid_new",
        pidHistory: [{ previous_mtcd_person_id: "pid_old" }],
        email: "alice@mtcd.org",
        db: mockDb as any,
      });

      expect(res.matchedBy).toBe("email");
      expect(res.user.id).toBe("u1");
    });

    it("matches Tier 3 by email when pid is missing or unlinked", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.email === "bob@mtcd.org") return Promise.resolve({ id: "u2", email: "bob@mtcd.org" });
            return Promise.resolve(null);
          }),
        },
      };

      const res = await findExistingUserByIam({ pid: null, pidHistory: [], email: "bob@mtcd.org", db: mockDb as any });
      expect(res.matchedBy).toBe("email");
      expect(res.user.id).toBe("u2");
    });

    it("returns null user when no tier matches", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const res = await findExistingUserByIam({ pid: "pid_999", pidHistory: [], email: "new@mtcd.org", db: mockDb as any });
      expect(res.user).toBeNull();
      expect(res.matchedBy).toBeNull();
    });
  });

  describe("safeEmailUpdate", () => {
    it("returns updated email if no conflict exists", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const res = await safeEmailUpdate("new@mtcd.org", "u1", mockDb as any);
      expect(res).toEqual({ email: "new@mtcd.org" });
    });

    it("returns empty object if target email belongs to another user", async () => {
      const mockDb = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: "u2", email: "new@mtcd.org" }),
        },
      };

      const res = await safeEmailUpdate("new@mtcd.org", "u1", mockDb as any);
      expect(res).toEqual({});
    });
  });
});
