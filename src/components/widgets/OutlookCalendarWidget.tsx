"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  RefreshCw,
  Settings,
  X,
  ExternalLink,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sliders,
  Filter,
} from "lucide-react";
import {
  fetchOutlookEventsAction,
  fetchOutlookCalendarsAction,
  disconnectOutlookAccountAction,
  updateSectionWidgetConfig,
} from "@/app/admin/actions";
import type { OutlookEventItem, OutlookCalendarItem } from "@/lib/outlook";

export interface OutlookCalendarWidgetProps {
  section: {
    id: string;
    title?: string;
    widgetConfig?: unknown;
    isWidget?: boolean;
    widgetType?: string | null;
    [key: string]: unknown;
  };
  showEditControls?: boolean;
  hasEditAccess?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
  filter?: string;
}

export function OutlookCalendarWidget({
  section,
  hasEditAccess,
  isAdmin,
  onRefresh,
  filter: propsFilter,
}: OutlookCalendarWidgetProps) {
  const [events, setEvents] = useState<OutlookEventItem[]>([]);
  const [calendars, setCalendars] = useState<OutlookCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Widget Configuration from Section DB
  const rawConfig = useMemo(() => {
    return typeof section?.widgetConfig === "string"
      ? JSON.parse(section.widgetConfig) || {}
      : section?.widgetConfig || {};
  }, [section?.widgetConfig]);

  const [connected, setConnected] = useState<boolean>(!!rawConfig.connected);
  const [accountEmail, setAccountEmail] = useState<string>(rawConfig.accountEmail || "");
  const [accountName, setAccountName] = useState<string>(rawConfig.accountName || "");
  const [daysAhead, setDaysAhead] = useState<number>(rawConfig.daysAhead ?? 7);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    rawConfig.selectedCalendarIds || []
  );

  // Advanced custom credentials
  const [customClientId, setCustomClientId] = useState<string>(rawConfig.clientId || "");
  const [customTenantId, setCustomTenantId] = useState<string>(rawConfig.tenantId || "");
  const [customClientSecret, setCustomClientSecret] = useState<string>(rawConfig.clientSecret || "");

  const [savingSettings, setSavingSettings] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOutlookEventsAction(section.id, {
        daysAhead,
        selectedCalendarIds,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (res.success) {
        setEvents(res.events || []);
        setConnected(true);
        if (res.accountName) setAccountName(res.accountName);
        if (res.accountEmail) setAccountEmail(res.accountEmail);
        setNeedsAuth(false);
      } else {
        if (res.needsAuth) {
          setNeedsAuth(true);
          setConnected(false);
        }
        setError(res.error || "Failed to load events");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [section.id, daysAhead, selectedCalendarIds]);

  const loadCalendars = useCallback(async () => {
    setCalendarsLoading(true);
    try {
      const res = await fetchOutlookCalendarsAction(section.id);
      if (res.success && res.calendars) {
        setCalendars(res.calendars);
      }
    } catch (e) {
      console.warn("[OutlookWidget] Failed to load calendars:", e);
    } finally {
      setCalendarsLoading(false);
    }
  }, [section.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Listen for OAuth completion message from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "OUTLOOK_CONNECTED" && event.data?.sectionId === section.id) {
        setConnected(true);
        setNeedsAuth(false);
        if (event.data.accountName) setAccountName(event.data.accountName);
        if (event.data.accountEmail) setAccountEmail(event.data.accountEmail);
        loadEvents();
        loadCalendars();
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [section.id, loadEvents, loadCalendars]);

  // Handle Connect Popup
  const handleConnect = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const query = new URLSearchParams({
      sectionId: section.id,
      ...(customClientId ? { clientId: customClientId } : {}),
      ...(customTenantId ? { tenantId: customTenantId } : {}),
      ...(customClientSecret ? { clientSecret: customClientSecret } : {}),
    });

    const popup = window.open(
      `/api/widgets/outlook/auth?${query.toString()}`,
      "Connect Microsoft Outlook",
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
    );

    if (popup) {
      popup.focus();
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this Microsoft Outlook account?")) return;
    try {
      await disconnectOutlookAccountAction(section.id);
      setConnected(false);
      setAccountEmail("");
      setAccountName("");
      setEvents([]);
      setCalendars([]);
      setNeedsAuth(true);
      if (onRefresh) onRefresh();
    } catch (e: unknown) {
      alert("Failed to disconnect: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Save Widget Config
  const handleSaveConfig = async () => {
    setSavingSettings(true);
    try {
      const updatedConfig = {
        ...rawConfig,
        daysAhead,
        selectedCalendarIds,
        clientId: customClientId.trim() || undefined,
        tenantId: customTenantId.trim() || undefined,
        clientSecret: customClientSecret.trim() || undefined,
      };

      await updateSectionWidgetConfig(section.id, updatedConfig);
      setShowSettingsModal(false);
      await loadEvents();
      if (onRefresh) onRefresh();
    } catch (e: unknown) {
      alert("Failed to save configuration: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle calendar selection
  const toggleCalendar = (calId: string) => {
    if (selectedCalendarIds.includes(calId)) {
      setSelectedCalendarIds(selectedCalendarIds.filter((id) => id !== calId));
    } else {
      setSelectedCalendarIds([...selectedCalendarIds, calId]);
    }
  };

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    const q = (propsFilter || "").trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (ev) =>
        ev.subject.toLowerCase().includes(q) ||
        (ev.location && ev.location.toLowerCase().includes(q)) ||
        (ev.bodyPreview && ev.bodyPreview.toLowerCase().includes(q)) ||
        (ev.calendarName && ev.calendarName.toLowerCase().includes(q))
    );
  }, [events, propsFilter]);

  // Group events by day header
  const groupedEvents = useMemo(() => {
    const groups: { label: string; date: string; isToday: boolean; isTomorrow: boolean; items: OutlookEventItem[] }[] = [];
    const todayStr = new Date().toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();

    filteredEvents.forEach((ev) => {
      const evDate = new Date(ev.start.dateTime);
      const evDateStr = evDate.toDateString();
      const isToday = evDateStr === todayStr;
      const isTomorrow = evDateStr === tomorrowStr;

      let label = evDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      if (isToday) label = `Today • ${label}`;
      else if (isTomorrow) label = `Tomorrow • ${label}`;

      let existing = groups.find((g) => g.date === evDateStr);
      if (!existing) {
        existing = { label, date: evDateStr, isToday, isTomorrow, items: [] };
        groups.push(existing);
      }
      existing.items.push(ev);
    });

    return groups;
  }, [filteredEvents]);

  const formatEventTime = (ev: OutlookEventItem) => {
    if (ev.isAllDay) return "All Day";
    try {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      const startFormatted = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      const endFormatted = e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${startFormatted} – ${endFormatted}`;
    } catch {
      return "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.5rem" }}>
      {/* Widget Header Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.25rem 0.5rem",
          fontSize: "0.8rem",
          opacity: 0.85,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {connected ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "6px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#60a5fa",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
              title={accountEmail || accountName}
            >
              <CalendarIcon size={12} />
              {accountName || "Outlook"} • Next {daysAhead}d
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>Outlook Disconnected</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <button
            type="button"
            onClick={() => loadEvents()}
            disabled={loading}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              padding: "0.25rem",
              opacity: loading ? 0.4 : 0.7,
              display: "flex",
              alignItems: "center",
            }}
            title="Refresh Events"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {(hasEditAccess || isAdmin) && (
            <button
              type="button"
              onClick={() => {
                setShowSettingsModal(true);
                if (connected) loadCalendars();
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text)",
                cursor: "pointer",
                padding: "0.25rem",
                opacity: 0.7,
                display: "flex",
                alignItems: "center",
              }}
              title="Configure Outlook Widget"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading && events.length === 0 ? (
        <div style={{ padding: "1.5rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div
            style={{
              height: "42px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s infinite",
            }}
          />
          <div
            style={{
              height: "42px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s infinite",
            }}
          />
          <div
            style={{
              height: "42px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.06)",
              animation: "pulse 1.5s infinite",
            }}
          />
        </div>
      ) : needsAuth || (!connected && events.length === 0) ? (
        /* Not Connected State */
        <div
          className="glass-card"
          style={{
            padding: "1.5rem 1rem",
            textAlign: "center",
            borderRadius: "12px",
            background: "rgba(59, 130, 246, 0.06)",
            border: "1px dashed rgba(59, 130, 246, 0.3)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(59, 130, 246, 0.15)",
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarIcon size={22} />
          </div>
          <div>
            <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", fontWeight: 700 }}>
              Connect Microsoft Outlook
            </h4>
            <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7, maxWidth: "260px" }}>
              Sign in to view upcoming calendar events and launch Teams meetings directly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            style={{
              marginTop: "0.25rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #0078d4 0%, #005a9e 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 12px rgba(0, 120, 212, 0.3)",
            }}
          >
            <CalendarIcon size={15} />
            Sign in with Microsoft
          </button>
        </div>
      ) : error ? (
        /* Error State */
        <div
          className="glass-card"
          style={{
            padding: "1rem",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "var(--text)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontWeight: 700, fontSize: "0.85rem" }}>
            <AlertCircle size={16} />
            <span>Unable to load calendar events</span>
          </div>
          <p style={{ margin: "0.4rem 0 0.75rem 0", fontSize: "0.75rem", opacity: 0.8 }}>
            {error}
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => loadEvents()}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleConnect}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.1)",
                color: "var(--text)",
                border: "1px solid var(--glass-border)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reconnect
            </button>
          </div>
        </div>
      ) : groupedEvents.length === 0 ? (
        /* Empty Events */
        <div
          style={{
            padding: "2rem 1rem",
            textAlign: "center",
            opacity: 0.5,
            fontSize: "0.85rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <CalendarIcon size={24} />
          <span>No upcoming events in the next {daysAhead} days</span>
        </div>
      ) : (
        /* Event Listings */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {groupedEvents.map((group) => (
            <div key={group.date} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {/* Day Header */}
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: group.isToday ? "var(--primary)" : "var(--text)",
                  opacity: group.isToday ? 1 : 0.6,
                  padding: "0.1rem 0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>{group.label}</span>
                {group.isToday && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--primary)",
                      display: "inline-block",
                    }}
                  />
                )}
              </div>

              {/* Day Events */}
              {group.items.map((ev) => (
                <div
                  key={ev.id}
                  className="glass-card"
                  onClick={() => {
                    if (ev.webLink) window.open(ev.webLink, "_blank", "noopener,noreferrer");
                  }}
                  style={{
                    padding: "0.6rem 0.75rem",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    cursor: ev.webLink ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    border: "1px solid var(--glass-border)",
                    position: "relative",
                  }}
                >
                  {/* Top row: Time + Teams Button + WebLink */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        opacity: 0.85,
                        color: ev.isAllDay ? "var(--primary)" : "var(--text)",
                      }}
                    >
                      <Clock size={12} style={{ opacity: 0.6 }} />
                      <span>{formatEventTime(ev)}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {/* Teams Meeting Join Button */}
                      {ev.teamsUrl && (
                        <a
                          href={ev.teamsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                            background: "linear-gradient(135deg, #464EB8 0%, #6264A7 100%)",
                            color: "#ffffff",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            textDecoration: "none",
                            boxShadow: "0 2px 6px rgba(70, 78, 184, 0.4)",
                            flexShrink: 0,
                          }}
                          title="Join Microsoft Teams Meeting"
                        >
                          <Video size={12} />
                          <span>Join Teams</span>
                        </a>
                      )}

                      {ev.webLink && (
                        <ExternalLink size={12} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </div>

                  {/* Event Title / Subject */}
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      lineHeight: 1.3,
                      wordBreak: "break-word",
                    }}
                  >
                    {ev.subject}
                  </div>

                  {/* Bottom details: Location / Calendar Name */}
                  {(ev.location || ev.calendarName) && (
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.6rem", fontSize: "0.72rem", opacity: 0.7 }}>
                      {ev.location && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <MapPin size={11} />
                          <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.location}
                          </span>
                        </div>
                      )}
                      {ev.calendarName && (
                        <span
                          style={{
                            padding: "0.1rem 0.35rem",
                            borderRadius: "4px",
                            background: "rgba(255,255,255,0.08)",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                          }}
                        >
                          {ev.calendarName}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div
          className="modal-overlay"
          onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "16px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              background: "var(--surface)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CalendarIcon size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Outlook Calendar Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", opacity: 0.6 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Account Status Card */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "10px",
                background: connected ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${connected ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: connected ? "#10b981" : "#ef4444",
                    }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    {connected ? "Connected Account" : "Not Connected"}
                  </span>
                </div>
                {connected && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#ef4444",
                      border: "none",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <LogOut size={12} />
                    Disconnect
                  </button>
                )}
              </div>

              {connected ? (
                <div style={{ fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 600 }}>{accountName}</div>
                  <div style={{ opacity: 0.7, fontSize: "0.75rem" }}>{accountEmail}</div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Switch Account / Reconnect
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8rem", opacity: 0.75 }}>
                    Connect an Outlook or Microsoft 365 account to synchronize your calendars and events.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnect}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #0078d4 0%, #005a9e 100%)",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <CalendarIcon size={14} />
                    Sign in with Microsoft
                  </button>
                </div>
              )}
            </div>

            {/* Days Ahead Setting */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Date Range: Next {daysAhead} Days</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>1 to 30 days</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={daysAhead}
                onChange={(e) => setDaysAhead(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", opacity: 0.5 }}>
                <span>1 day</span>
                <span>7 days (1 wk)</span>
                <span>14 days (2 wk)</span>
                <span>30 days</span>
              </div>
            </div>

            {/* Calendar Filter Selection */}
            {connected && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Filter size={14} />
                    <span>Filter Calendars</span>
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarIds([])}
                      style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", padding: 0 }}
                    >
                      Show All
                    </button>
                    {calendars.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarIds(calendars.map((c) => c.id))}
                        style={{ background: "none", border: "none", color: "var(--text)", opacity: 0.6, cursor: "pointer", padding: 0 }}
                      >
                        Select All
                      </button>
                    )}
                  </div>
                </div>

                {calendarsLoading ? (
                  <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.8rem", opacity: 0.6 }}>
                    Loading calendars...
                  </div>
                ) : calendars.length === 0 ? (
                  <div style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.8rem", opacity: 0.6 }}>
                    Default primary calendar active (all events shown).
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: "160px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                      padding: "0.4rem",
                      borderRadius: "8px",
                      background: "rgba(0,0,0,0.15)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {calendars.map((cal) => {
                      const isSelected =
                        selectedCalendarIds.length === 0 || selectedCalendarIds.includes(cal.id);
                      return (
                        <label
                          key={cal.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            background: isSelected ? "rgba(59, 130, 246, 0.1)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCalendar(cal.id)}
                            style={{ accentColor: "var(--primary)" }}
                          />
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: cal.hexColor || "#3b82f6",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: isSelected ? 600 : 400 }}>{cal.name}</span>
                          {cal.isDefaultCalendar && (
                            <span style={{ fontSize: "0.65rem", opacity: 0.5, marginLeft: "auto" }}>Default</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Advanced Azure App Credentials (Accordion) */}
            <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  opacity: 0.8,
                  padding: 0,
                }}
              >
                {showAdvancedSettings ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Sliders size={14} />
                <span>Advanced: Custom Azure App Credentials</span>
              </button>

              {showAdvancedSettings && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem", fontSize: "0.8rem" }}>
                  <p style={{ margin: 0, opacity: 0.7, fontSize: "0.75rem" }}>
                    Optional: Override system environment variables with a custom Azure App Registration.
                  </p>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.2rem" }}>
                      Application (Client) ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text)",
                        fontSize: "0.8rem",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.2rem" }}>
                      Directory (Tenant) ID / Type
                    </label>
                    <input
                      type="text"
                      placeholder="common, organizations, or tenant GUID"
                      value={customTenantId}
                      onChange={(e) => setCustomTenantId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text)",
                        fontSize: "0.8rem",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.2rem" }}>
                      Client Secret (Optional for confidential apps)
                    </label>
                    <input
                      type="password"
                      placeholder="Azure client secret"
                      value={customClientSecret}
                      onChange={(e) => setCustomClientSecret(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text)",
                        fontSize: "0.8rem",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingSettings}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "8px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                {savingSettings ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
