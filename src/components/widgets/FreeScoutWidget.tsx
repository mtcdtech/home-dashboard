"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LifeBuoy,
  RefreshCw,
  Settings,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
  User,
  X,
  Inbox,
  GripVertical,
} from "lucide-react";
import {
  fetchFreeScoutConversationsAction,
  fetchFreeScoutMailboxesAction,
  testFreeScoutConnectionAction,
  saveFreeScoutWidgetSettingsAction,
} from "@/app/admin/actions";
import type { FreeScoutConversation, FreeScoutMailbox, FreeScoutWidgetConfig } from "@/lib/freescout";

export interface FreeScoutWidgetProps {
  section: {
    id: string;
    title: string;
    icon?: string | null;
    isWidget?: boolean;
    widgetType?: string | null;
    widgetConfig?: unknown;
  };
  showEditControls?: boolean;
  hasEditAccess?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
  filter?: string;
}

const DEFAULT_STATUS_ORDER = ["active", "pending", "closed", "spam"];

const STATUS_METADATA: Record<string, { label: string; shortLabel: string; color: string; bg: string; border: string }> = {
  active: {
    label: "Open / Unresolved",
    shortLabel: "Unresolved",
    color: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.2)",
    border: "rgba(245, 158, 11, 0.3)",
  },
  pending: {
    label: "In Progress",
    shortLabel: "In Progress",
    color: "#c084fc",
    bg: "rgba(139, 92, 246, 0.2)",
    border: "rgba(139, 92, 246, 0.3)",
  },
  closed: {
    label: "Closed",
    shortLabel: "Closed",
    color: "#34d399",
    bg: "rgba(16, 185, 129, 0.2)",
    border: "rgba(16, 185, 129, 0.3)",
  },
  spam: {
    label: "Spam",
    shortLabel: "Spam",
    color: "#f87171",
    bg: "rgba(239, 68, 68, 0.2)",
    border: "rgba(239, 68, 68, 0.3)",
  },
};

export function FreeScoutWidget({
  section,
  showEditControls = false,
  hasEditAccess = false,
  onRefresh,
  filter = "",
}: FreeScoutWidgetProps) {
  const [conversations, setConversations] = useState<FreeScoutConversation[]>([]);
  const [mailboxes, setMailboxes] = useState<FreeScoutMailbox[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>("");
  const [selectedMailboxFilter, setSelectedMailboxFilter] = useState<number | "all">("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | "all">("all");

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form State
  const rawConfig: FreeScoutWidgetConfig = useMemo(() => {
    if (!section?.widgetConfig) return {};
    if (typeof section.widgetConfig === "string") {
      try {
        return JSON.parse(section.widgetConfig) || {};
      } catch {
        return {};
      }
    }
    return (section.widgetConfig as FreeScoutWidgetConfig) || {};
  }, [section?.widgetConfig]);

  const [serverUrl, setServerUrl] = useState<string>(rawConfig.serverUrl || "");
  const [apiKey, setApiKey] = useState<string>(rawConfig.apiKey || "");
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<number[]>(
    Array.isArray(rawConfig.selectedMailboxIds) ? rawConfig.selectedMailboxIds : []
  );
  const [mailboxOrder, setMailboxOrder] = useState<number[]>(
    Array.isArray(rawConfig.mailboxOrder) ? rawConfig.mailboxOrder : []
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    Array.isArray(rawConfig.selectedStatuses) ? rawConfig.selectedStatuses : ["active", "pending"]
  );
  const [statusOrder, setStatusOrder] = useState<string[]>(
    Array.isArray(rawConfig.statusOrder) && rawConfig.statusOrder.length > 0
      ? rawConfig.statusOrder
      : DEFAULT_STATUS_ORDER
  );
  const [sortBy, setSortBy] = useState<"updatedAt" | "createdAt" | "number" | "status">(
    rawConfig.sortBy || "updatedAt"
  );
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">(rawConfig.sortOrder || "desc");
  const [maxItems, setMaxItems] = useState<number>(rawConfig.maxItems ?? 25);
  const [autoRefreshMinutes, setAutoRefreshMinutes] = useState<number>(rawConfig.autoRefreshMinutes ?? 0);
  const [availableMailboxes, setAvailableMailboxes] = useState<FreeScoutMailbox[]>([]);
  const [loadingMailboxes, setLoadingMailboxes] = useState<boolean>(false);

  // Drag-and-drop state for settings modal
  const [draggedMailboxIndex, setDraggedMailboxIndex] = useState<number | null>(null);
  const [draggedStatusIndex, setDraggedStatusIndex] = useState<number | null>(null);

  // Load Conversations
  const loadConversations = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetchFreeScoutConversationsAction(section.id);
      if (res.needsSetup) {
        setNeedsSetup(true);
        setConversations([]);
      } else if (!res.success) {
        setError(res.error || "Failed to load FreeScout issues.");
        setNeedsSetup(false);
      } else {
        setConversations(Array.isArray(res.conversations) ? res.conversations : []);
        setMailboxes(Array.isArray(res.mailboxes) ? res.mailboxes : []);
        setNeedsSetup(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error connecting to FreeScout.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [section.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshMinutes > 0) {
      const interval = setInterval(() => {
        loadConversations(false);
      }, autoRefreshMinutes * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefreshMinutes, loadConversations]);

  // Open settings and load mailboxes
  const handleOpenSettings = async () => {
    setServerUrl(rawConfig.serverUrl || "");
    setApiKey(rawConfig.apiKey || "");
    setSelectedMailboxIds(Array.isArray(rawConfig.selectedMailboxIds) ? rawConfig.selectedMailboxIds : []);
    setMailboxOrder(Array.isArray(rawConfig.mailboxOrder) ? rawConfig.mailboxOrder : []);
    setSelectedStatuses(
      Array.isArray(rawConfig.selectedStatuses) ? rawConfig.selectedStatuses : ["active", "pending"]
    );
    setStatusOrder(
      Array.isArray(rawConfig.statusOrder) && rawConfig.statusOrder.length > 0
        ? rawConfig.statusOrder
        : DEFAULT_STATUS_ORDER
    );
    setSortBy(rawConfig.sortBy || "updatedAt");
    setSortOrder(rawConfig.sortOrder || "desc");
    setMaxItems(rawConfig.maxItems ?? 25);
    setAutoRefreshMinutes(rawConfig.autoRefreshMinutes ?? 0);
    setTestResult(null);
    setShowSettingsModal(true);

    if (rawConfig.serverUrl && rawConfig.apiKey) {
      setLoadingMailboxes(true);
      try {
        const res = await fetchFreeScoutMailboxesAction(section.id, {
          serverUrl: rawConfig.serverUrl,
          apiKey: rawConfig.apiKey,
        });
        if (res.success && Array.isArray(res.mailboxes)) {
          // Sort available mailboxes according to mailboxOrder
          const ordered = [...res.mailboxes].sort((a, b) => {
            const currentOrder = rawConfig.mailboxOrder || [];
            const idxA = currentOrder.indexOf(a.id);
            const idxB = currentOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.id - b.id;
          });
          setAvailableMailboxes(ordered);
        }
      } catch (e) {
        console.warn("[freescout] Failed to fetch mailboxes:", e);
      } finally {
        setLoadingMailboxes(false);
      }
    }
  };

  // Test connection button in settings
  const handleTestConnection = async () => {
    if (!serverUrl || !apiKey) {
      setTestResult({ success: false, message: "Please provide both Server URL and API Key." });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testFreeScoutConnectionAction(serverUrl, apiKey);
      if (res.success) {
        setTestResult({
          success: true,
          message: `Connected successfully! Found ${res.mailboxCount ?? 0} mailbox(es).`,
        });
        const mbRes = await fetchFreeScoutMailboxesAction(section.id, { serverUrl, apiKey });
        if (mbRes.success && Array.isArray(mbRes.mailboxes)) {
          const ordered = [...mbRes.mailboxes].sort((a, b) => {
            const idxA = mailboxOrder.indexOf(a.id);
            const idxB = mailboxOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.id - b.id;
          });
          setAvailableMailboxes(ordered);
        }
      } else {
        setTestResult({ success: false, message: res.error || "Failed to connect to FreeScout." });
      }
    } catch (e: unknown) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Error testing connection.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const currentMailboxOrder = availableMailboxes.map((m) => m.id);
      const res = await saveFreeScoutWidgetSettingsAction(section.id, {
        serverUrl,
        apiKey,
        selectedMailboxIds,
        mailboxOrder: currentMailboxOrder,
        selectedStatuses,
        statusOrder,
        sortBy,
        sortOrder,
        maxItems,
        autoRefreshMinutes,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to save settings");
      }

      setShowSettingsModal(false);
      await loadConversations();
      if (onRefresh) onRefresh();
    } catch (e: unknown) {
      alert("Failed to save settings: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingSettings(false);
    }
  };

  // Active / Configured Status Order
  const activeStatusOrder = useMemo(() => {
    const list = Array.isArray(rawConfig.statusOrder) && rawConfig.statusOrder.length > 0
      ? rawConfig.statusOrder
      : DEFAULT_STATUS_ORDER;
    return list;
  }, [rawConfig.statusOrder]);

  // Filter available mailboxes strictly by active/selected configuration and custom mailboxOrder
  const activeMailboxes = useMemo(() => {
    const configuredIds = Array.isArray(rawConfig.selectedMailboxIds) ? rawConfig.selectedMailboxIds : [];
    const currentOrder = Array.isArray(rawConfig.mailboxOrder) ? rawConfig.mailboxOrder : [];

    let filtered = mailboxes;
    if (configuredIds.length > 0) {
      const subset = mailboxes.filter((m) => configuredIds.includes(m.id));
      if (subset.length > 0) filtered = subset;
    }

    // Sort by custom mailboxOrder
    return [...filtered].sort((a, b) => {
      const idxA = currentOrder.indexOf(a.id);
      const idxB = currentOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id - b.id;
    });
  }, [mailboxes, rawConfig.selectedMailboxIds, rawConfig.mailboxOrder]);

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    const activeQuery = (localSearch || filter || "").toLowerCase().trim();
    const list = conversations.filter((c) => {
      // Mailbox tab filter
      if (selectedMailboxFilter !== "all" && c.mailboxId !== selectedMailboxFilter) {
        return false;
      }
      // Status badge filter
      if (selectedStatusFilter !== "all" && c.status.toLowerCase() !== selectedStatusFilter.toLowerCase()) {
        return false;
      }
      // Text search
      if (!activeQuery) return true;
      const matchSubject = (c.subject || "").toLowerCase().includes(activeQuery);
      const matchPreview = (c.preview || "").toLowerCase().includes(activeQuery);
      const matchNum = String(c.number || "").includes(activeQuery);
      const matchCustomer = `${c.customer?.fname || ""} ${c.customer?.lname || ""} ${c.customer?.email || ""}`
        .toLowerCase()
        .includes(activeQuery);
      const matchAssignee = `${c.assignee?.fname || ""} ${c.assignee?.lname || ""} ${c.assignee?.email || ""}`
        .toLowerCase()
        .includes(activeQuery);
      const matchMailbox = (c.mailboxName || "").toLowerCase().includes(activeQuery);

      return matchSubject || matchPreview || matchNum || matchCustomer || matchAssignee || matchMailbox;
    });

    // Client-side sort
    list.sort((a, b) => {
      if (sortBy === "status") {
        const idxA = activeStatusOrder.indexOf(a.status);
        const idxB = activeStatusOrder.indexOf(b.status);
        const pA = idxA !== -1 ? idxA : 99;
        const pB = idxB !== -1 ? idxB : 99;
        if (pA !== pB) {
          return sortOrder === "asc" ? pB - pA : pA - pB;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === "number") {
        return sortOrder === "asc" ? a.number - b.number : b.number - a.number;
      }
      if (sortBy === "createdAt") {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      }
      // Default updatedAt
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [conversations, localSearch, filter, selectedMailboxFilter, selectedStatusFilter, sortBy, sortOrder, activeStatusOrder]);

  // Counts
  const unresolvedCount = useMemo(() => {
    return conversations.filter((c) => c.status === "active").length;
  }, [conversations]);

  const inProgressCount = useMemo(() => {
    return conversations.filter((c) => c.status === "pending").length;
  }, [conversations]);

  const closedCount = useMemo(() => {
    return conversations.filter((c) => c.status === "closed").length;
  }, [conversations]);

  // Time format helper
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        padding: "0.5rem",
        borderRadius: "12px",
        minHeight: "140px",
      }}
    >
      {/* Widget Top Header Bar: Status Filters (Left) & Controls (Right Corner, No Wrap) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          paddingBottom: "0.35rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          width: "100%",
        }}
      >
        {/* Left Side: Status Badges (rendered in custom status order) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {activeStatusOrder.map((statusKey) => {
            const isSelected = selectedStatusFilter === statusKey;
            const meta = STATUS_METADATA[statusKey] || {
              label: statusKey,
              shortLabel: statusKey,
              color: "#fff",
              bg: "rgba(255,255,255,0.1)",
              border: "rgba(255,255,255,0.2)",
            };

            const count =
              statusKey === "active"
                ? unresolvedCount
                : statusKey === "pending"
                ? inProgressCount
                : statusKey === "closed"
                ? closedCount
                : conversations.filter((c) => c.status === statusKey).length;

            // Only show status badge in header if it's active/pending or has items
            if (statusKey !== "active" && statusKey !== "pending" && count === 0) {
              return null;
            }

            return (
              <button
                key={statusKey}
                type="button"
                onClick={() => setSelectedStatusFilter(isSelected ? "all" : statusKey)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "20px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: isSelected ? `1px solid ${meta.color}` : `1px solid ${meta.border}`,
                  background: isSelected ? meta.bg.replace("0.2", "0.35") : meta.bg,
                  color: meta.color,
                  transition: "all 0.15s ease",
                }}
                title={`Filter by ${meta.label} issues`}
              >
                {statusKey === "active" ? (
                  <AlertCircle size={11} />
                ) : statusKey === "pending" ? (
                  <Clock size={11} />
                ) : (
                  <CheckCircle2 size={11} />
                )}
                <span>
                  {count} {meta.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Corner: Fixed Controls (Pinned to top-right corner) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginLeft: "auto", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => loadConversations(true)}
            disabled={loading}
            title="Refresh FreeScout Issues"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "6px",
              cursor: "pointer",
              color: "var(--text)",
              opacity: 0.75,
              padding: "5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>

          {(showEditControls || hasEditAccess) && (
            <button
              type="button"
              onClick={handleOpenSettings}
              title="Configure FreeScout Widget"
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "6px",
                cursor: "pointer",
                color: "var(--text)",
                opacity: 0.75,
                padding: "5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Settings size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Mailbox Tabs Row (Rendered ONLY if more than one mailbox is active/enabled) */}
      {activeMailboxes.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            overflowX: "auto",
            paddingBottom: "0.25rem",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedMailboxFilter("all")}
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "8px",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              border:
                selectedMailboxFilter === "all"
                  ? "1px solid var(--primary)"
                  : "1px solid rgba(255, 255, 255, 0.08)",
              background:
                selectedMailboxFilter === "all"
                  ? "rgba(var(--primary-rgb), 0.2)"
                  : "rgba(255, 255, 255, 0.03)",
              color: selectedMailboxFilter === "all" ? "#fff" : "rgba(255, 255, 255, 0.7)",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Inbox size={11} />
            <span>All Mailboxes ({conversations.length})</span>
          </button>

          {activeMailboxes.map((mb) => {
            const count = conversations.filter((c) => c.mailboxId === mb.id).length;
            const isSelected = selectedMailboxFilter === mb.id;
            return (
              <button
                key={mb.id}
                type="button"
                onClick={() => setSelectedMailboxFilter(mb.id)}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: "8px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: isSelected
                    ? "1px solid var(--primary)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isSelected
                    ? "rgba(var(--primary-rgb), 0.2)"
                    : "rgba(255, 255, 255, 0.03)",
                  color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.7)",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Mail size={11} style={{ opacity: 0.6 }} />
                <span>{mb.name}</span>
                <span style={{ fontSize: "0.65rem", opacity: 0.55 }}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Local Filter Bar (if there are items) */}
      {conversations.length > 5 && (
        <div style={{ position: "relative", width: "100%" }}>
          <Search
            size={12}
            style={{
              position: "absolute",
              left: "0.6rem",
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.4,
            }}
          />
          <input
            type="text"
            placeholder="Filter issues by subject, ticket #, customer, or assignee..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="glass"
            style={{
              width: "100%",
              padding: "0.35rem 0.5rem 0.35rem 1.8rem",
              borderRadius: "8px",
              fontSize: "0.75rem",
              boxSizing: "border-box",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch("")}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text)",
                opacity: 0.5,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {needsSetup ? (
        <div
          className="glass-card"
          style={{
            padding: "1.5rem 1rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            background: "rgba(255, 255, 255, 0.02)",
            borderRadius: "12px",
            border: "1px dashed var(--glass-border)",
          }}
        >
          <LifeBuoy size={28} style={{ opacity: 0.6, color: "var(--primary)" }} />
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>FreeScout Help Desk</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.2rem" }}>
              Connect to your FreeScout server to view unresolved and in progress issues.
            </div>
          </div>
          {(showEditControls || hasEditAccess) && (
            <button
              type="button"
              onClick={handleOpenSettings}
              className="btn btn-primary"
              style={{
                fontSize: "0.78rem",
                padding: "0.4rem 0.85rem",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontWeight: 600,
              }}
            >
              <Settings size={13} />
              <span>Configure FreeScout Connection</span>
            </button>
          )}
        </div>
      ) : loading && conversations.length === 0 ? (
        <div style={{ padding: "1.5rem 0", textAlign: "center", opacity: 0.5, fontSize: "0.8rem" }}>
          <RefreshCw size={18} className="animate-spin" style={{ margin: "0 auto 0.5rem auto", display: "block" }} />
          Loading FreeScout issues...
        </div>
      ) : error ? (
        <div
          style={{
            padding: "0.85rem",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#f87171",
            fontSize: "0.78rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700 }}>
            <AlertCircle size={14} />
            <span>FreeScout Error</span>
          </div>
          <div style={{ opacity: 0.9 }}>{error}</div>
          {(showEditControls || hasEditAccess) && (
            <button
              type="button"
              onClick={handleOpenSettings}
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: "none",
                color: "#60a5fa",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: "0.72rem",
                padding: 0,
                marginTop: "0.2rem",
              }}
            >
              Open Widget Settings
            </button>
          )}
        </div>
      ) : filteredConversations.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            textAlign: "center",
            opacity: 0.5,
            fontSize: "0.8rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <CheckCircle2 size={24} style={{ color: "#10b981", opacity: 0.8 }} />
          <div style={{ fontWeight: 600, color: "var(--text)" }}>All Caught Up!</div>
          <div style={{ fontSize: "0.72rem" }}>
            {localSearch || selectedStatusFilter !== "all" || selectedMailboxFilter !== "all"
              ? "No issues match your current filter."
              : "No unresolved or in progress issues across selected mailboxes."}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            maxHeight: "380px",
            overflowY: "auto",
            paddingRight: "2px",
          }}
        >
          {filteredConversations.map((conv) => {
            const isUnresolved = conv.status === "active";
            const isInProgress = conv.status === "pending";
            const isClosed = conv.status === "closed";

            const customerName =
              `${conv.customer?.fname || ""} ${conv.customer?.lname || ""}`.trim() ||
              conv.customer?.email ||
              "Customer";

            const assigneeName =
              `${conv.assignee?.fname || ""} ${conv.assignee?.lname || ""}`.trim() || conv.assignee?.email;

            return (
              <a
                key={conv.id}
                href={conv.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-hover"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "var(--text)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  background: isUnresolved
                    ? "rgba(245, 158, 11, 0.04)"
                    : isInProgress
                    ? "rgba(139, 92, 246, 0.04)"
                    : isClosed
                    ? "rgba(16, 185, 129, 0.04)"
                    : "rgba(255, 255, 255, 0.02)",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
              >
                {/* Top Row: Ticket Number, Mailbox, Status Pill, Time */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        opacity: 0.6,
                      }}
                    >
                      #{conv.number}
                    </span>

                    {conv.mailboxName && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          background: "rgba(255, 255, 255, 0.08)",
                          opacity: 0.75,
                          fontWeight: 600,
                        }}
                      >
                        {conv.mailboxName}
                      </span>
                    )}

                    {/* Status Pill */}
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        fontWeight: 700,
                        textTransform: "capitalize",
                        background: isUnresolved
                          ? "rgba(245, 158, 11, 0.2)"
                          : isInProgress
                          ? "rgba(139, 92, 246, 0.2)"
                          : isClosed
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(255, 255, 255, 0.1)",
                        color: isUnresolved
                          ? "#fbbf24"
                          : isInProgress
                          ? "#c084fc"
                          : isClosed
                          ? "#34d399"
                          : "var(--text)",
                      }}
                    >
                      {conv.status === "active"
                        ? "Unresolved"
                        : conv.status === "pending"
                        ? "In Progress"
                        : conv.status === "closed"
                        ? "Closed"
                        : conv.status}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", opacity: 0.5 }}>
                    <Clock size={10} />
                    <span>{formatTimeAgo(conv.updatedAt || conv.createdAt)}</span>
                    <ExternalLink size={10} style={{ marginLeft: "2px" }} />
                  </div>
                </div>

                {/* Middle Row: Subject */}
                <div
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    lineHeight: "1.25",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={conv.subject}
                >
                  {conv.subject}
                </div>

                {/* Preview Snippet */}
                {conv.preview && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      opacity: 0.55,
                      lineHeight: "1.3",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.preview}
                  </div>
                )}

                {/* Bottom Row: Customer & Assignee */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.7rem",
                    opacity: 0.7,
                    marginTop: "0.15rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <User size={11} style={{ opacity: 0.6 }} />
                    <span style={{ fontWeight: 500 }}>{customerName}</span>
                  </div>

                  {assigneeName && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.68rem",
                        opacity: 0.85,
                        color: "var(--primary)",
                      }}
                    >
                      <span>Assigned to {assigneeName}</span>
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingSettings) setShowSettingsModal(false);
          }}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              borderRadius: "16px",
              border: "1px solid var(--glass-border)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              background: "rgba(20, 20, 25, 0.95)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <LifeBuoy size={20} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>FreeScout Widget Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                disabled={savingSettings}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", opacity: 0.5 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Server URL & API Key Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  FreeScout Server URL <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://helpdesk.example.com"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  API Key <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  type="password"
                  placeholder="Enter FreeScout API Key (Profile → API Key)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Test Connection Button */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !serverUrl || !apiKey}
                  className="btn"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                  }}
                >
                  <RefreshCw size={12} className={testingConnection ? "animate-spin" : ""} />
                  <span>{testingConnection ? "Testing..." : "Test Connection"}</span>
                </button>

                {testResult && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: testResult.success ? "#34d399" : "#f87171",
                    }}
                  >
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>

            {/* Draggable Mailboxes List (with checkbox toggle) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600 }}>Filter & Order Mailboxes</label>
                  <span style={{ fontSize: "0.7rem", opacity: 0.5, marginLeft: "6px" }}>(Drag to reorder tabs)</span>
                </div>
                {availableMailboxes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMailboxIds.length === availableMailboxes.length) {
                        setSelectedMailboxIds([]);
                      } else {
                        setSelectedMailboxIds(availableMailboxes.map((m) => m.id));
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {selectedMailboxIds.length === availableMailboxes.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {loadingMailboxes ? (
                <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>Loading available mailboxes...</div>
              ) : availableMailboxes.length === 0 ? (
                <div style={{ fontSize: "0.72rem", opacity: 0.5 }}>
                  Click &ldquo;Test Connection&rdquo; above to load mailboxes from your FreeScout server.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                    maxHeight: "150px",
                    overflowY: "auto",
                    padding: "0.4rem",
                    borderRadius: "8px",
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {availableMailboxes.map((mb, idx) => {
                    const isChecked =
                      selectedMailboxIds.length === 0 || selectedMailboxIds.includes(mb.id);
                    return (
                      <div
                        key={mb.id}
                        draggable
                        onDragStart={() => setDraggedMailboxIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={() => {
                          if (draggedMailboxIndex === null || draggedMailboxIndex === idx) return;
                          const reordered = [...availableMailboxes];
                          const [removed] = reordered.splice(draggedMailboxIndex, 1);
                          reordered.splice(idx, 0, removed);
                          setAvailableMailboxes(reordered);
                          setDraggedMailboxIndex(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 6px",
                          borderRadius: "6px",
                          background:
                            draggedMailboxIndex === idx
                              ? "rgba(var(--primary-rgb), 0.2)"
                              : "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          cursor: "grab",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            flex: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (selectedMailboxIds.length === 0) {
                                setSelectedMailboxIds([mb.id]);
                              } else if (selectedMailboxIds.includes(mb.id)) {
                                setSelectedMailboxIds(selectedMailboxIds.filter((id) => id !== mb.id));
                              } else {
                                setSelectedMailboxIds([...selectedMailboxIds, mb.id]);
                              }
                            }}
                          />
                          <span>{mb.name}</span>
                          {mb.email && <span style={{ opacity: 0.4, fontSize: "0.7rem" }}>({mb.email})</span>}
                        </label>

                        <GripVertical size={13} style={{ opacity: 0.4, cursor: "grab" }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Draggable Ticket Statuses Order */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600 }}>Filter & Order Ticket Statuses</label>
                  <span style={{ fontSize: "0.7rem", opacity: 0.5, marginLeft: "6px" }}>(Drag to reorder priority)</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                  padding: "0.4rem",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {statusOrder.map((statusKey, idx) => {
                  const meta = STATUS_METADATA[statusKey] || {
                    label: statusKey,
                    color: "#fff",
                    bg: "rgba(255,255,255,0.1)",
                    border: "rgba(255,255,255,0.2)",
                  };
                  const isChecked = selectedStatuses.includes(statusKey);
                  return (
                    <div
                      key={statusKey}
                      draggable
                      onDragStart={() => setDraggedStatusIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedStatusIndex === null || draggedStatusIndex === idx) return;
                        const reordered = [...statusOrder];
                        const [removed] = reordered.splice(draggedStatusIndex, 1);
                        reordered.splice(idx, 0, removed);
                        setStatusOrder(reordered);
                        setDraggedStatusIndex(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 6px",
                        borderRadius: "6px",
                        background:
                          draggedStatusIndex === idx
                            ? "rgba(var(--primary-rgb), 0.2)"
                            : "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        cursor: "grab",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: "0.78rem",
                          cursor: "pointer",
                          flex: 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              if (selectedStatuses.length > 1) {
                                setSelectedStatuses(selectedStatuses.filter((s) => s !== statusKey));
                              }
                            } else {
                              setSelectedStatuses([...selectedStatuses, statusKey]);
                            }
                          }}
                        />
                        <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                      </label>

                      <GripVertical size={13} style={{ opacity: 0.4, cursor: "grab" }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sorting & Limits */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="status">Ticket Status (Custom Status Order)</option>
                  <option value="updatedAt">Last Updated</option>
                  <option value="createdAt">Created Date</option>
                  <option value="number">Ticket Number</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Sort Order
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="desc">Primary / Newest First (Desc)</option>
                  <option value="asc">Reverse / Oldest First (Asc)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Max Issues to Display
                </label>
                <select
                  value={maxItems}
                  onChange={(e) => setMaxItems(Number(e.target.value))}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                >
                  <option value={10}>10 issues</option>
                  <option value={25}>25 issues</option>
                  <option value={50}>50 issues</option>
                  <option value={100}>100 issues</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Auto Refresh
                </label>
                <select
                  value={autoRefreshMinutes}
                  onChange={(e) => setAutoRefreshMinutes(Number(e.target.value))}
                  className="glass"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                >
                  <option value={0}>Manual Only</option>
                  <option value={1}>Every 1 minute</option>
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "0.5rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                disabled={savingSettings}
                className="btn"
                style={{ padding: "0.45rem 0.9rem", borderRadius: "8px", fontSize: "0.8rem" }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings || !serverUrl || !apiKey}
                className="btn btn-primary"
                style={{
                  padding: "0.45rem 1.1rem",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {savingSettings ? <RefreshCw size={13} className="animate-spin" /> : null}
                <span>{savingSettings ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
