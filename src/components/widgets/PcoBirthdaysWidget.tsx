"use client";

import React, { useState, useEffect } from "react";
import { 
  Cake, 
  Heart, 
  Calendar, 
  Pencil, 
  ExternalLink, 
  RefreshCw, 
  Settings, 
  Search, 
  X, 
  Send, 
  AlertCircle, 
  PhoneCall,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  CheckSquare,
  Square
} from "lucide-react";
import { 
  fetchPcoBirthdaysAndAnniversaries, 
  submitPcoProfileCorrection, 
  togglePcoCallStatus, 
  updateSectionWidgetConfig 
} from "@/app/admin/actions";
import { isPcoItemCalled } from "@/lib/pco";

export interface PcoBirthdaysWidgetProps {
  section: any;
  showEditControls?: boolean;
  hasEditAccess?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
}

export function PcoBirthdaysWidget({ section, showEditControls, hasEditAccess, isAdmin, onRefresh }: PcoBirthdaysWidgetProps) {
  let rawConfig: any = {};
  try {
    rawConfig = typeof section?.widgetConfig === "string"
      ? (JSON.parse(section.widgetConfig || "{}") || {})
      : (section?.widgetConfig && typeof section.widgetConfig === "object" ? section.widgetConfig : {});
  } catch (e) {
    rawConfig = {};
  }

  const [appId, setAppId] = useState(rawConfig.appId || "");
  const [appSecret, setAppSecret] = useState(rawConfig.appSecret || "");
  const [birthdayListIds, setBirthdayListIds] = useState(rawConfig.birthdayListIds || "");
  const [anniversaryListIds, setAnniversaryListIds] = useState(rawConfig.anniversaryListIds || "");
  const [workflowId, setWorkflowId] = useState(rawConfig.workflowId || "");

  // Multi-select date range options
  const defaultRanges = Array.isArray(rawConfig.selectedRanges) && rawConfig.selectedRanges.length > 0 
    ? rawConfig.selectedRanges 
    : ["current_month", "next_x_days"];

  const [selectedRanges, setSelectedRanges] = useState<string[]>(defaultRanges);
  const [daysBefore, setDaysBefore] = useState<number>(typeof rawConfig.daysBefore !== "undefined" ? Number(rawConfig.daysBefore) : 7);
  const [daysAfter, setDaysAfter] = useState<number>(typeof rawConfig.daysAfter !== "undefined" ? Number(rawConfig.daysAfter) : 30);
  const [maxItems, setMaxItems] = useState<number>(typeof rawConfig.maxItems !== "undefined" ? Number(rawConfig.maxItems) : 10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"combined" | "split">(rawConfig.viewMode || "combined");
  const [timeMarkDate, setTimeMarkDate] = useState<string>(rawConfig.timeMarkDate || "");

  // Loaded Items & State
  const [items, setItems] = useState<any[]>([]);
  const [callRecords, setCallRecords] = useState<Record<string, { year: number; checked: boolean }>>(
    rawConfig.callRecords && typeof rawConfig.callRecords === "object" ? rawConfig.callRecords : {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Correction Modal State
  const [selectedPersonForCorrection, setSelectedPersonForCorrection] = useState<any | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [correctionStatus, setCorrectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);

  const currentYear = new Date().getFullYear();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPcoBirthdaysAndAnniversaries({
        appId: appId || undefined,
        appSecret: appSecret || undefined,
        birthdayListIds,
        anniversaryListIds,
        selectedRanges,
        daysBefore,
        daysAfter,
        callRecords,
        timeMarkDate,
      });

      if (res && res.success && Array.isArray(res.items)) {
        setItems(res.items);
      } else {
        const errStr = typeof res?.error === "string" ? res.error : res?.error?.message ? String(res.error.message) : "Failed to load Planning Center data";
        setError(errStr);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Error connecting to Planning Center API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setCurrentPage(1);
  }, [section?.id, JSON.stringify(selectedRanges), daysBefore, daysAfter, timeMarkDate]);

  const toggleRangeOption = (key: string) => {
    setSelectedRanges(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleToggleCall = async (personId: string, eventType: "birthday" | "anniversary", currentChecked: boolean) => {
    const newChecked = !currentChecked;
    const recordKey = `${personId}_${eventType}`;
    
    // Optimistic UI update
    setCallRecords(prev => ({
      ...prev,
      [recordKey]: { year: currentYear, checked: newChecked }
    }));

    try {
      const res = await togglePcoCallStatus({
        sectionId: section.id,
        personId,
        eventType,
        year: currentYear,
        checked: newChecked,
      });

      if (res.success && res.callRecords) {
        setCallRecords(res.callRecords);
      }
    } catch (err) {
      console.error("Failed to toggle call status:", err);
    }
  };

  const handleSaveConfig = async () => {
    setSavingSettings(true);
    try {
      const newConfig = {
        ...rawConfig,
        appId,
        appSecret,
        birthdayListIds,
        anniversaryListIds,
        workflowId,
        selectedRanges,
        daysBefore,
        daysAfter,
        maxItems,
        viewMode,
        callRecords,
        timeMarkDate,
      };

      await updateSectionWidgetConfig(section.id, newConfig);
      setShowSettingsModal(false);
      if (onRefresh) onRefresh();
      await loadData();
    } catch (err: any) {
      alert("Failed to save settings: " + (err.message || err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubmitCorrection = async () => {
    if (!selectedPersonForCorrection || !correctionNote.trim()) return;
    setSubmittingNote(true);
    setCorrectionStatus(null);
    try {
      const res = await submitPcoProfileCorrection({
        appId,
        appSecret,
        workflowId,
        personId: selectedPersonForCorrection.personId,
        personName: selectedPersonForCorrection.name,
        note: correctionNote,
      });

      if (res.success) {
        setCorrectionStatus({ success: true, message: res.message || "Correction note submitted!" });
        setTimeout(() => {
          setSelectedPersonForCorrection(null);
          setCorrectionNote("");
          setCorrectionStatus(null);
        }, 2000);
      } else {
        setCorrectionStatus({ success: false, message: res.error || "Failed to submit note." });
      }
    } catch (err: any) {
      setCorrectionStatus({ success: false, message: err.message || "Submission error." });
    } finally {
      setSubmittingNote(false);
    }
  };

  // Filter items by search filter
  const filteredItems = items.filter(item => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.formattedDate.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredItems.length / maxItems) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = filteredItems.slice((safeCurrentPage - 1) * maxItems, safeCurrentPage * maxItems);

  const birthdaysList = filteredItems.filter(i => i.type === "birthday");
  const anniversariesList = filteredItems.filter(i => i.type === "anniversary");

  const totalCalled = items.filter(i => isPcoItemCalled(i, callRecords, timeMarkDate, currentYear)).length;

  const totalOverdueCalls = items.filter(i => {
    const isPast = i.daysUntil < 0;
    const isCalled = isPcoItemCalled(i, callRecords, timeMarkDate, currentYear);
    return isPast && !isCalled;
  }).length;

  const rangeLabels: Record<string, string> = {
    prev_month: "Prev Month",
    current_month: "Current Month",
    next_month: "Next Month",
    prev_x_days: `Past ${daysBefore}d`,
    next_x_days: `Next ${daysAfter}d`,
    show_overdue: "Overdue Calls",
  };
  const monthLabels = selectedRanges
    .filter(r => ["prev_month", "current_month", "next_month"].includes(r))
    .map(r => rangeLabels[r] || r);
  const relativeLabels = selectedRanges
    .filter(r => ["prev_x_days", "next_x_days"].includes(r))
    .map(r => rangeLabels[r] || r);
  const hasOverdueSelected = selectedRanges.includes("show_overdue");

  let activeFilterNote = "";
  const filterParts: string[] = [];
  if (monthLabels.length > 0) filterParts.push(monthLabels.join(", "));
  if (relativeLabels.length > 0) filterParts.push(relativeLabels.join(", "));
  if (hasOverdueSelected) filterParts.push("+ Overdue Calls");
  activeFilterNote = filterParts.length > 0 ? filterParts.join(" & ") : "All Dates";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
      {/* Single-Line Widget Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '0.5rem 0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          <Heart size={16} style={{ color: '#ec4899' }} />
          <span>PCO B&A</span>
          {timeMarkDate && (
            <span
              title={`Time Mark Active: All dates before ${timeMarkDate} are automatically marked as Called`}
              style={{
                fontSize: '0.68rem',
                color: '#60a5fa',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                padding: '0.15rem 0.4rem',
                borderRadius: '5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Calendar size={10} />
              <span>&lt; {timeMarkDate}</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Overdue Calls Filter Pill */}
          {totalOverdueCalls > 0 && (
            <button
              type="button"
              onClick={() => toggleRangeOption("show_overdue")}
              title={selectedRanges.includes("show_overdue") ? "Overdue calls included in view. Click to toggle." : "Click to include overdue uncalled celebrations in list."}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                border: selectedRanges.includes("show_overdue") ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(239, 68, 68, 0.3)',
                background: selectedRanges.includes("show_overdue") ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer'
              }}
            >
              <PhoneCall size={12} className={selectedRanges.includes("show_overdue") ? "" : "animate-pulse"} />
              <span>{totalOverdueCalls} Overdue</span>
            </button>
          )}

          {/* Combined / Separate Toggle */}
          <button
            type="button"
            title={viewMode === "combined" ? "Switch to Separate View" : "Switch to Combined View"}
            onClick={() => setViewMode(prev => prev === "combined" ? "split" : "combined")}
            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {viewMode === "combined" ? "Combined" : "Separate"}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            title="Refresh Planning Center List"
            style={{ padding: '0.35rem', borderRadius: '6px', border: 'none', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Settings Button */}
          {(hasEditAccess || isAdmin) && (
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Configure Settings & Date Filters"
              style={{ padding: '0.35rem', borderRadius: '6px', border: 'none', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Applied Filter Note Row */}
      <div style={{ fontSize: '0.72rem', opacity: 0.7, padding: '0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Filter size={11} style={{ opacity: 0.6 }} />
        <span>Filter applied: <strong>{activeFilterNote || "Default"}</strong></span>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>Fetching upcoming celebrations from Planning Center...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <AlertCircle size={16} />
            <span>Planning Center Connection Error</span>
          </div>
          <span>{error}</span>
          {(hasEditAccess || isAdmin) && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', marginTop: '0.25rem' }}
            >
              Configure API Settings
            </button>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
          No upcoming birthdays or anniversaries match your selected date ranges.
        </div>
      ) : viewMode === "combined" ? (
        /* Combined View List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {paginatedItems.map(item => renderPersonCard(item))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)', padding: '0.5rem 0.85rem', borderRadius: '10px', fontSize: '0.75rem', border: '1px solid var(--glass-border)', marginTop: '0.25rem' }}>
              <span style={{ opacity: 0.7, fontWeight: 600 }}>
                Showing {(safeCurrentPage - 1) * maxItems + 1}–{Math.min(safeCurrentPage * maxItems, filteredItems.length)} of {filteredItems.length} celebrations
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border)',
                    background: safeCurrentPage === 1 ? 'transparent' : 'rgba(var(--primary-rgb), 0.12)',
                    color: 'var(--text)',
                    opacity: safeCurrentPage === 1 ? 0.4 : 1,
                    cursor: safeCurrentPage === 1 ? 'default' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>

                <span style={{ fontWeight: 700, padding: '0 0.4rem', color: 'var(--primary)' }}>
                  {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border)',
                    background: safeCurrentPage >= totalPages ? 'transparent' : 'rgba(var(--primary-rgb), 0.12)',
                    color: 'var(--text)',
                    opacity: safeCurrentPage >= totalPages ? 0.4 : 1,
                    cursor: safeCurrentPage >= totalPages ? 'default' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Split View Columns */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Birthdays Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#f472b6', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                <Cake size={15} />
                <span>Birthdays ({birthdaysList.length})</span>
              </div>
              {birthdaysList.length === 0 ? (
                <div style={{ fontSize: '0.75rem', opacity: 0.4, padding: '0.5rem' }}>No birthdays in selected ranges.</div>
              ) : (
                birthdaysList.slice((safeCurrentPage - 1) * maxItems, safeCurrentPage * maxItems).map(item => renderPersonCard(item))
              )}
            </div>

            {/* Anniversaries Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                <Heart size={15} />
                <span>Anniversaries ({anniversariesList.length})</span>
              </div>
              {anniversariesList.length === 0 ? (
                <div style={{ fontSize: '0.75rem', opacity: 0.4, padding: '0.5rem' }}>No anniversaries in selected ranges.</div>
              ) : (
                anniversariesList.slice((safeCurrentPage - 1) * maxItems, safeCurrentPage * maxItems).map(item => renderPersonCard(item))
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)', padding: '0.5rem 0.85rem', borderRadius: '10px', fontSize: '0.75rem', border: '1px solid var(--glass-border)', marginTop: '0.25rem' }}>
              <span style={{ opacity: 0.7, fontWeight: 600 }}>
                Page {safeCurrentPage} of {totalPages} ({filteredItems.length} total)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.12)', color: 'var(--text)', opacity: safeCurrentPage === 1 ? 0.4 : 1, cursor: safeCurrentPage === 1 ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.12)', color: 'var(--text)', opacity: safeCurrentPage >= totalPages ? 0.4 : 1, cursor: safeCurrentPage >= totalPages ? 'default' : 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profile Correction Modal */}
      {selectedPersonForCorrection && (
        <div 
          className="modal-overlay fade-in" 
          onDragStart={(e) => e.stopPropagation()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '480px', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }}>
                <Pencil size={16} style={{ color: 'var(--primary)' }} />
                <span>Correction Note: {selectedPersonForCorrection.name}</span>
              </div>
              <button onClick={() => setSelectedPersonForCorrection(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>
              Submit a profile correction note directly to your Planning Center Workflow (e.g. updated phone number, spelling fix, or wrong date).
            </p>

            <textarea
              id="pco_correction_note"
              name="pco_correction_note"
              rows={4}
              placeholder="Enter correction note details..."
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              className="glass"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', border: '1px solid var(--glass-border)', color: 'var(--text)' }}
            />

            {correctionStatus && (
              <div style={{ padding: '0.65rem', borderRadius: '8px', fontSize: '0.8rem', background: correctionStatus.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: correctionStatus.success ? '#4ade80' : '#fca5a5' }}>
                {correctionStatus.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setSelectedPersonForCorrection(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingNote || !correctionNote.trim()}
                onClick={handleSubmitCorrection}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Send size={14} />
                <span>{submittingNote ? "Submitting..." : "Submit to PCO"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (hasEditAccess || isAdmin) && (
        <div 
          className="modal-overlay fade-in" 
          onDragStart={(e) => e.stopPropagation()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', borderRadius: '24px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--glass-border)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Settings size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Planning Center Widget Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Credentials */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="pco_app_id" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>PCO Application ID</label>
                  <input
                    id="pco_app_id"
                    name="pco_app_id"
                    type="password"
                    placeholder="Application ID"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label htmlFor="pco_app_secret" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>PCO Secret Key</label>
                  <input
                    id="pco_app_secret"
                    name="pco_app_secret"
                    type="password"
                    placeholder="Secret Key"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* List IDs */}
              <div>
                <label htmlFor="pco_birthday_list_ids" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Birthday PCO List IDs (comma-separated)</label>
                <input
                  id="pco_birthday_list_ids"
                  name="pco_birthday_list_ids"
                  placeholder="e.g. 123456, 789012"
                  value={birthdayListIds}
                  onChange={(e) => setBirthdayListIds(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label htmlFor="pco_anniversary_list_ids" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Anniversary PCO List IDs (comma-separated)</label>
                <input
                  id="pco_anniversary_list_ids"
                  name="pco_anniversary_list_ids"
                  placeholder="e.g. 654321, 210987"
                  value={anniversaryListIds}
                  onChange={(e) => setAnniversaryListIds(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Workflow ID */}
              <div>
                <label htmlFor="pco_workflow_id" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Profile Corrections PCO Workflow ID</label>
                <input
                  id="pco_workflow_id"
                  name="pco_workflow_id"
                  placeholder="e.g. 98765"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Layer 1: Calendar Month Window (Multi-Select) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700 }}>
                    Layer 1: Calendar Month Window (Multi-Select)
                  </label>
                  <span style={{ fontSize: '0.68rem', opacity: 0.5 }}>
                    Filter by month boundaries
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[
                    { key: "prev_month", label: "Previous Month" },
                    { key: "current_month", label: "Current Month" },
                    { key: "next_month", label: "Next Month" },
                  ].map(opt => {
                    const active = selectedRanges.includes(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => toggleRangeOption(opt.key)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          border: active ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                          background: active ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(0,0,0,0.1)',
                          color: active ? 'var(--primary)' : 'var(--text)',
                          fontSize: '0.75rem',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        {active && <Check size={12} />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layer 2: Relative Date Window (Multi-Select) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700 }}>
                    Layer 2: Relative Date Window (Multi-Select)
                  </label>
                  <span style={{ fontSize: '0.68rem', opacity: 0.5 }}>
                    Constrain by days from today (must pass both layers)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[
                    { key: "prev_x_days", label: `Past X Days (${daysBefore}d)` },
                    { key: "next_x_days", label: `Next X Days (${daysAfter}d)` },
                  ].map(opt => {
                    const active = selectedRanges.includes(opt.key);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => toggleRangeOption(opt.key)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          border: active ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                          background: active ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(0,0,0,0.1)',
                          color: active ? 'var(--primary)' : 'var(--text)',
                          fontSize: '0.75rem',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        {active && <Check size={12} />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>              {/* Overdue Calls Option */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(239, 68, 68, 0.05)', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={13} />
                    <span>Overdue Calls Inclusion</span>
                  </label>
                  <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>
                    Include past uncalled celebrations
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => toggleRangeOption("show_overdue")}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: selectedRanges.includes("show_overdue") ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid var(--glass-border)',
                      background: selectedRanges.includes("show_overdue") ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0,0,0,0.15)',
                      color: selectedRanges.includes("show_overdue") ? '#f87171' : 'var(--text)',
                      fontSize: '0.75rem',
                      fontWeight: selectedRanges.includes("show_overdue") ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    {selectedRanges.includes("show_overdue") ? <CheckSquare size={13} /> : <Square size={13} />}
                    <span>Show Overdue Calls (Uncalled Past Dates)</span>
                  </button>
                </div>
              </div>

              {/* Time Mark Cutoff Date Section */}
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} />
                    <span>Time Mark Cutoff Date</span>
                  </label>
                  {timeMarkDate && (
                    <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600, background: 'rgba(59, 130, 246, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                      Active: {timeMarkDate}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: 0, lineHeight: 1.35 }}>
                  Automatically set all birthdays and anniversaries before this date as &quot;Called&quot;.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={timeMarkDate}
                    onChange={(e) => setTimeMarkDate(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text)',
                      fontSize: '0.8rem',
                      outline: 'none',
                      colorScheme: 'dark'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setTimeMarkDate(`${currentYear}-${m}-${day}`);
                    }}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#93c5fd',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      setTimeMarkDate(`${currentYear}-${m}-01`);
                    }}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#93c5fd',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    1st of Month
                  </button>
                  {timeMarkDate && (
                    <button
                      type="button"
                      onClick={() => setTimeMarkDate("")}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.15)',
                        color: 'var(--text)',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Customizable Window (Days Before & Days After) & Max Listings */}
              <div style={{ background: 'rgba(var(--primary-rgb), 0.04)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Custom Range Window & Pagination Settings
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label htmlFor="pco_days_before" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.2rem' }}>
                      Days Before (X)
                    </label>
                    <input
                      id="pco_days_before"
                      name="pco_days_before"
                      type="number"
                      min={0}
                      max={365}
                      value={daysBefore}
                      onChange={(e) => setDaysBefore(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="pco_days_after" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.2rem' }}>
                      Days After (X)
                    </label>
                    <input
                      id="pco_days_after"
                      name="pco_days_after"
                      type="number"
                      min={1}
                      max={365}
                      value={daysAfter}
                      onChange={(e) => setDaysAfter(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="pco_max_items" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.2rem' }}>
                      Max Listings / Page
                    </label>
                    <input
                      id="pco_max_items"
                      name="pco_max_items"
                      type="number"
                      min={1}
                      max={200}
                      value={maxItems}
                      onChange={(e) => { setMaxItems(Number(e.target.value)); setCurrentPage(1); }}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* Display Layout */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Display Layout</label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="combined" style={{ background: '#1e1e2d', color: '#fff' }}>Combined Feed</option>
                  <option value="split" style={{ background: '#1e1e2d', color: '#fff' }}>Split Sections</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingSettings}
                onClick={handleSaveConfig}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderPersonCard(item: any) {
    const isCalled = isPcoItemCalled(item, callRecords, timeMarkDate, currentYear);
    const isPastDate = item.daysUntil < 0;
    const isPastUncalled = isPastDate && !isCalled;

    const isBirthday = item.type === "birthday";
    const pillBg = isBirthday ? "rgba(236, 72, 153, 0.15)" : "rgba(245, 158, 11, 0.15)";
    const pillColor = isBirthday ? "#f472b6" : "#fbbf24";
    const pillBorder = isBirthday ? "1px solid rgba(236, 72, 153, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)";

    const daysText = item.daysUntil === 0 
      ? "Today!" 
      : item.daysUntil === 1 
      ? "Tomorrow" 
      : item.daysUntil === -1
      ? "Yesterday"
      : item.daysUntil < 0
      ? `${Math.abs(item.daysUntil)} days ago`
      : `In ${item.daysUntil} days`;

    // Format Month-Day badge
    const monthDisplay = item.monthStr || (item.formattedDate ? item.formattedDate.split("-")[0] : "MMM");
    const dayDisplay = item.dayStr || (item.formattedDate ? item.formattedDate.split("-")[1] : "DD");

    return (
      <div
        key={item.id}
        onClick={() => {
          if (item.pcoUrl) {
            window.open(item.pcoUrl, "_blank");
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          padding: '0.75rem 0.85rem',
          borderRadius: '14px',
          background: isCalled 
            ? 'rgba(34, 197, 94, 0.06)' 
            : isPastUncalled 
            ? 'rgba(239, 68, 68, 0.08)' 
            : 'rgba(0,0,0,0.15)',
          border: isCalled 
            ? '1px solid rgba(34, 197, 94, 0.3)' 
            : isPastUncalled 
            ? '1px solid rgba(239, 68, 68, 0.45)' 
            : '1px solid var(--glass-border)',
          transition: 'all 0.2s',
          gap: '0.75rem',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          {/* Prominent Date Badge (replaces initials icon) */}
          <div 
            title={`Event date: ${item.formattedDate}`}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '46px', 
              height: '46px', 
              borderRadius: '11px', 
              background: isPastUncalled
                ? 'rgba(239, 68, 68, 0.18)'
                : isBirthday 
                ? 'rgba(236, 72, 153, 0.12)' 
                : 'rgba(245, 158, 11, 0.12)', 
              border: isPastUncalled
                ? '1px solid rgba(239, 68, 68, 0.5)'
                : isBirthday 
                ? '1px solid rgba(236, 72, 153, 0.3)' 
                : '1px solid rgba(245, 158, 11, 0.3)', 
              flexShrink: 0, 
              padding: '2px 0',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: isPastUncalled ? '#f87171' : pillColor, lineHeight: 1, tracking: '0.05em' }}>
              {monthDisplay}
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, marginTop: '2px' }}>
              {dayDisplay}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
            {/* Person Name (whole card is clickable to male card link) */}
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span>{item.name}</span>
              <ExternalLink size={11} style={{ opacity: 0.4, flexShrink: 0 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {/* Type Pill */}
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem', borderRadius: '4px', background: pillBg, color: pillColor, border: pillBorder, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                {isBirthday ? <Cake size={10} /> : <Heart size={10} />}
                {isBirthday ? "Birthday" : "Anniversary"}
              </span>

              {/* Days Until Tag */}
              <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 600, color: isPastUncalled ? '#f87171' : 'inherit' }}>
                ({daysText})
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Correction Note Pencil Button */}
          <button
            type="button"
            title={`Add profile correction note for ${item.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPersonForCorrection(item);
              setCorrectionNote("");
              setCorrectionStatus(null);
            }}
            style={{ padding: '0.4rem', borderRadius: '7px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)', opacity: 0.75, cursor: 'pointer' }}
          >
            <Pencil size={13} />
          </button>

          {/* Called Checkbox Button - Highlighted in RED if celebration passed & not called */}
          <button
            type="button"
            title={
              isCalled 
                ? `Marked as Called for ${currentYear}` 
                : isPastUncalled 
                ? `OVERDUE: Date passed (${daysText}). Click to mark as Called!` 
                : `Mark as Called for ${currentYear}`
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleCall(item.personId, item.type, !!isCalled);
            }}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '7px',
              border: isCalled 
                ? '1px solid rgba(34, 197, 94, 0.4)' 
                : isPastUncalled 
                ? '1px solid rgba(239, 68, 68, 0.7)' 
                : '1px solid var(--glass-border)',
              background: isCalled 
                ? 'rgba(34, 197, 94, 0.2)' 
                : isPastUncalled 
                ? 'rgba(239, 68, 68, 0.25)' 
                : 'rgba(0,0,0,0.12)',
              color: isCalled 
                ? '#4ade80' 
                : isPastUncalled 
                ? '#f87171' 
                : 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              boxShadow: isPastUncalled ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {isCalled ? (
              <CheckSquare size={13} />
            ) : isPastUncalled ? (
              <Square size={13} />
            ) : (
              <Square size={13} />
            )}
            <span>Called</span>
          </button>
        </div>
      </div>
    );
  }
}
