"use client";

import React, { useState, useEffect } from "react";
import { 
  Cake, 
  Heart, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Pencil, 
  ExternalLink, 
  RefreshCw, 
  Settings, 
  Search, 
  X, 
  Send, 
  AlertCircle, 
  SlidersHorizontal,
  PhoneCall,
  UserCheck
} from "lucide-react";
import { 
  fetchPcoBirthdaysAndAnniversaries, 
  submitPcoProfileCorrection, 
  togglePcoCallStatus, 
  updateSectionWidgetConfig 
} from "@/app/admin/actions";

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
  const [dateRange, setDateRange] = useState(rawConfig.dateRange || "custom");
  const [daysBefore, setDaysBefore] = useState<number>(typeof rawConfig.daysBefore !== "undefined" ? Number(rawConfig.daysBefore) : 0);
  const [daysAfter, setDaysAfter] = useState<number>(typeof rawConfig.daysAfter !== "undefined" ? Number(rawConfig.daysAfter) : 30);
  const [viewMode, setViewMode] = useState<"combined" | "split">(rawConfig.viewMode || "combined");

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
        dateRange,
        daysBefore,
        daysAfter,
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
  }, [section?.id, dateRange, daysBefore, daysAfter]);

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
        dateRange,
        daysBefore,
        daysAfter,
        viewMode,
        callRecords,
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

  const birthdaysList = filteredItems.filter(i => i.type === "birthday");
  const anniversariesList = filteredItems.filter(i => i.type === "anniversary");

  const totalCalled = items.filter(i => {
    const rec = callRecords[`${i.personId}_${i.type}`];
    return rec && rec.year === currentYear && rec.checked;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Widget Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.65rem 0.85rem', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
            <Heart size={16} style={{ color: '#ec4899' }} />
            <span>PCO Celebrations</span>
          </div>

          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', fontWeight: 600 }}>
            {birthdaysList.length} Birthdays
          </span>
          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 600 }}>
            {anniversariesList.length} Anniversaries
          </span>
          {totalCalled > 0 && (
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <UserCheck size={12} /> {totalCalled} Called
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '140px' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input
              type="text"
              placeholder="Filter names..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="glass"
              style={{ width: '100%', padding: '0.35rem 0.5rem 0.35rem 1.8rem', borderRadius: '8px', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* View Mode Toggle */}
          <button
            type="button"
            title={viewMode === "combined" ? "Switch to Split View" : "Switch to Combined View"}
            onClick={() => setViewMode(prev => prev === "combined" ? "split" : "combined")}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {viewMode === "combined" ? "Combined" : "Split"}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            title="Refresh Planning Center List"
            style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Settings Button */}
          {(hasEditAccess || isAdmin) && (
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Configure PCO API Settings"
              style={{ padding: '0.4rem', borderRadius: '8px', border: 'none', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--text)', cursor: 'pointer' }}
            >
              <Settings size={14} />
            </button>
          )}
        </div>
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
          No upcoming birthdays or anniversaries found for the selected date range.
        </div>
      ) : viewMode === "combined" ? (
        /* Combined View List */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {filteredItems.map(item => renderPersonCard(item))}
        </div>
      ) : (
        /* Split View Columns */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Birthdays Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#f472b6', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
              <Cake size={15} />
              <span>Birthdays ({birthdaysList.length})</span>
            </div>
            {birthdaysList.length === 0 ? (
              <div style={{ fontSize: '0.75rem', opacity: 0.4, padding: '0.5rem' }}>No birthdays in this range.</div>
            ) : (
              birthdaysList.map(item => renderPersonCard(item))
            )}
          </div>

          {/* Anniversaries Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
              <Heart size={15} />
              <span>Anniversaries ({anniversariesList.length})</span>
            </div>
            {anniversariesList.length === 0 ? (
              <div style={{ fontSize: '0.75rem', opacity: 0.4, padding: '0.5rem' }}>No anniversaries in this range.</div>
            ) : (
              anniversariesList.map(item => renderPersonCard(item))
            )}
          </div>
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

              {/* Customizable Window (Days Before & Days After) */}
              <div style={{ background: 'rgba(var(--primary-rgb), 0.04)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Custom Date Window Customization
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label htmlFor="pco_days_before" style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.2rem' }}>
                      Days Before Today (e.g. 0 to 30)
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
                      Days After Today (e.g. 1 to 180)
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
    const record = callRecords[`${item.personId}_${item.type}`];
    const isCalled = record && record.year === currentYear && record.checked;

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
          background: isCalled ? 'rgba(34, 197, 94, 0.06)' : 'rgba(0,0,0,0.15)',
          border: isCalled ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--glass-border)',
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
              background: isBirthday ? 'rgba(236, 72, 153, 0.12)' : 'rgba(245, 158, 11, 0.12)', 
              border: isBirthday ? '1px solid rgba(236, 72, 153, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)', 
              flexShrink: 0, 
              padding: '2px 0',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: pillColor, lineHeight: 1, tracking: '0.05em' }}>
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
              <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 600 }}>
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

          {/* Called Checkbox Button */}
          <button
            type="button"
            title={isCalled ? `Marked as Called for ${currentYear}` : `Mark as Called for ${currentYear}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleCall(item.personId, item.type, !!isCalled);
            }}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '7px',
              border: isCalled ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--glass-border)',
              background: isCalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0,0,0,0.12)',
              color: isCalled ? '#4ade80' : 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            {isCalled ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            <span>{isCalled ? "Called" : "Call"}</span>
          </button>
        </div>
      </div>
    );
  }
}
