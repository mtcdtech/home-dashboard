"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Server, Activity, Power, RefreshCw, Eye, EyeOff, ExternalLink, Settings, X, Search, Check, AlertCircle, Edit3, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { fetchPortainerContainers, updateSectionWidgetConfig } from "@/app/admin/actions";
import { IconComponent } from "../IconPicker";
import { BookmarkModal } from "../BookmarkModal";

export interface PortainerWidgetProps {
  section: any;
  showEditControls?: boolean;
  hasEditAccess?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
  filter?: string;
  onContainersLoaded?: (sectionId: string, containers: any[]) => void;
  selectedContainerName?: string;
  onContainerHover?: (containerName: string) => void;
}

export interface PortainerSortRule {
  field: "status" | "name" | "manual" | "image" | "created";
  order: "asc" | "desc";
  enabled?: boolean;
}

const DEFAULT_PORTAINER_SORT_RULES: PortainerSortRule[] = [
  { field: "status", order: "asc", enabled: true },
  { field: "name", order: "asc", enabled: true },
  { field: "manual", order: "asc", enabled: false },
  { field: "image", order: "asc", enabled: false },
  { field: "created", order: "desc", enabled: false },
];

const PORTAINER_SORT_FIELD_LABELS: Record<
  PortainerSortRule["field"],
  { label: string; ascLabel: string; descLabel: string }
> = {
  status: {
    label: "Container Status",
    ascLabel: "Running First (Asc)",
    descLabel: "Stopped First (Desc)",
  },
  name: {
    label: "Container Name",
    ascLabel: "A to Z (Asc)",
    descLabel: "Z to A (Desc)",
  },
  manual: {
    label: "Manual Order",
    ascLabel: "Custom Order Top to Bottom (Asc)",
    descLabel: "Custom Order Bottom to Top (Desc)",
  },
  image: {
    label: "Docker Image Name",
    ascLabel: "A to Z (Asc)",
    descLabel: "Z to A (Desc)",
  },
  created: {
    label: "Creation Time",
    ascLabel: "Oldest First (Asc)",
    descLabel: "Newest First (Desc)",
  },
};

export function PortainerWidget({ section, showEditControls, hasEditAccess, isAdmin, onRefresh, filter: propsFilter, onContainersLoaded, selectedContainerName, onContainerHover }: PortainerWidgetProps) {
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Editing container via BookmarkModal
  const [editingContainer, setEditingContainer] = useState<any | null>(null);

  // Widget Configuration from Section DB
  const rawConfig = typeof section?.widgetConfig === "string" 
    ? (JSON.parse(section.widgetConfig) || {}) 
    : (section?.widgetConfig || {});

  const [portainerUrl, setPortainerUrl] = useState(rawConfig.url || "");
  const [apiKey, setApiKey] = useState(rawConfig.apiKey || "");
  const [endpointId, setEndpointId] = useState(rawConfig.endpointId || "5");
  
  // Draggable Multi-Tier Sorting State
  const initialSortRules: PortainerSortRule[] = useMemo(() => {
    if (Array.isArray(rawConfig.sortRules) && rawConfig.sortRules.length > 0) {
      const existingFields = new Set(rawConfig.sortRules.map((r: any) => r.field));
      const merged = [...rawConfig.sortRules];
      DEFAULT_PORTAINER_SORT_RULES.forEach((def) => {
        if (!existingFields.has(def.field)) {
          merged.push({ ...def, enabled: false });
        }
      });
      return merged;
    }
    const primary = rawConfig.primarySortBy || rawConfig.sortBy || "status";
    const primaryOrder = rawConfig.primarySortOrder || rawConfig.sortOrder || "asc";
    const secondary = rawConfig.secondarySortBy;
    const secondaryOrder = rawConfig.secondarySortOrder || "asc";

    return DEFAULT_PORTAINER_SORT_RULES.map((rule) => {
      if (rule.field === primary) return { ...rule, order: primaryOrder, enabled: true };
      if (secondary && secondary !== "none" && rule.field === secondary) {
        return { ...rule, order: secondaryOrder, enabled: true };
      }
      return rule;
    });
  }, [rawConfig.sortRules, rawConfig.primarySortBy, rawConfig.primarySortOrder, rawConfig.secondarySortBy, rawConfig.secondarySortOrder, rawConfig.sortBy, rawConfig.sortOrder]);

  const [sortRules, setSortRules] = useState<PortainerSortRule[]>(initialSortRules);
  const [draggedSortIndex, setDraggedSortIndex] = useState<number | null>(null);
  const [dragOverSortIndex, setDragOverSortIndex] = useState<number | null>(null);

  const moveSortRule = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sortRules.length) return;
    const reordered = [...sortRules];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, removed);
    setSortRules(reordered);
  };
  
  // Custom container settings: { [containerIdOrName]: { hidden?: boolean, customUrl?: string, customName?: string, icon?: string, description?: string, keywords?: string, customOrder?: number } }
  const [containerSettings, setContainerSettings] = useState<Record<string, { hidden?: boolean; customUrl?: string; customName?: string; icon?: string; description?: string; keywords?: string; customOrder?: number }>>(rawConfig.containers || {});

  const [savingSettings, setSavingSettings] = useState(false);

  const loadContainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPortainerContainers({
        url: portainerUrl || undefined,
        apiKey: apiKey || undefined,
        endpointId: endpointId || undefined,
      });
      if (res.success && res.containers) {
        setContainers(res.containers);
        if (onContainersLoaded) {
          onContainersLoaded(section.id, res.containers);
        }
      } else {
        setError(res.error || "Failed to load containers");
      }
    } catch (e: any) {
      setError(e.message || "Failed to connect to Portainer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContainers();
  }, [section?.id]);

  const moveContainerOrder = (containerName: string, direction: "up" | "down") => {
    const sorted = [...containers].sort((a, b) => {
      const settingA = containerSettings[a.name] || containerSettings[a.id] || {};
      const settingB = containerSettings[b.name] || containerSettings[b.id] || {};
      const orderA = settingA.customOrder ?? 9999;
      const orderB = settingB.customOrder ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      const nameA = (settingA.customName || a.name || "").toLowerCase();
      const nameB = (settingB.customName || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const index = sorted.findIndex(c => c.name === containerName || c.id === containerName);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const updated = { ...containerSettings };
    sorted.forEach((c, idx) => {
      let finalOrder = idx;
      if (idx === index) finalOrder = targetIndex;
      else if (idx === targetIndex) finalOrder = index;
      updated[c.name] = { ...updated[c.name], customOrder: finalOrder };
    });

    setContainerSettings(updated);
  };

  const handleSaveConfig = async (newContainerSettings?: any) => {
    setSavingSettings(true);
    try {
      const updatedConfig = {
        url: portainerUrl.trim(),
        apiKey: apiKey.trim(),
        endpointId: endpointId.trim(),
        sortRules,
        sortBy: sortRules.find(r => r.enabled !== false)?.field || "status",
        sortOrder: sortRules.find(r => r.enabled !== false)?.order || "asc",
        containers: newContainerSettings || containerSettings
      };
      await updateSectionWidgetConfig(section.id, updatedConfig);
      if (newContainerSettings) setContainerSettings(newContainerSettings);
      setShowSettingsModal(false);
      await loadContainers();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert("Failed to save widget configuration: " + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const visibleContainers = containers
    .filter(c => {
      const setting = containerSettings[c.name] || containerSettings[c.id];
      if (setting?.hidden && !showSettingsModal) return false;
      const nameToMatch = setting?.customName || c.name;
      const activeFilter = (propsFilter || filter || "").trim().toLowerCase();
      if (activeFilter) {
        const nameMatch = nameToMatch.toLowerCase().includes(activeFilter);
        const imageMatch = c.image.toLowerCase().includes(activeFilter);
        const descMatch = (setting?.description || "").toLowerCase().includes(activeFilter);
        const kwMatch = (setting?.keywords || "").toLowerCase().includes(activeFilter);
        if (!nameMatch && !imageMatch && !descMatch && !kwMatch) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const settingA = containerSettings[a.name] || containerSettings[a.id] || {};
      const settingB = containerSettings[b.name] || containerSettings[b.id] || {};
      const nameA = (settingA.customName || a.name || "").toLowerCase();
      const nameB = (settingB.customName || b.name || "").toLowerCase();

      const activeRules = sortRules.filter((r) => r.enabled !== false);
      const rulesToApply = activeRules.length > 0 ? activeRules : [{ field: "status" as const, order: "asc" as const, enabled: true }];

      for (const rule of rulesToApply) {
        let comp = 0;
        if (rule.field === "status") {
          const isRunningA = a.state === "running" ? 0 : 1;
          const isRunningB = b.state === "running" ? 0 : 1;
          comp = isRunningA - isRunningB;
        } else if (rule.field === "manual") {
          const orderA = settingA.customOrder ?? 9999;
          const orderB = settingB.customOrder ?? 9999;
          comp = orderA - orderB;
        } else if (rule.field === "image") {
          const imgA = (a.image || "").toLowerCase();
          const imgB = (b.image || "").toLowerCase();
          comp = imgA.localeCompare(imgB);
        } else if (rule.field === "created") {
          const createdA = Number(a.created || 0);
          const createdB = Number(b.created || 0);
          comp = createdA - createdB;
        } else {
          comp = nameA.localeCompare(nameB);
        }

        if (comp !== 0) {
          return rule.order === "desc" ? -comp : comp;
        }
      }

      return 0;
    });

  const totalCount = containers.length;
  const runningCount = containers.filter(c => c.state === "running").length;
  const stoppedCount = totalCount - runningCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
      
      {/* Widget Header Controls & Quick Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(var(--primary-rgb), 0.04)', padding: '0.5rem 0.75rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            {runningCount} Running
          </span>
          {stoppedCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
              {stoppedCount} Stopped
            </span>
          )}
          <span style={{ opacity: 0.5 }}>Total: {totalCount}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button 
            onClick={loadContainers} 
            title="Refresh Containers"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.7, padding: '0.2rem', display: 'flex' }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {isAdmin && (
            <button 
              onClick={() => setShowSettingsModal(true)} 
              title="Configure Portainer Widget Connection"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.7, padding: '0.2rem', display: 'flex' }}
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Container List Grid / Loading / Inline Error Card */}
      {error ? (
        <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Portainer Connection Error</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.15rem' }}>{error}</div>
            </div>
          </div>
          <button 
            onClick={loadContainers}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Retry
          </button>
        </div>
      ) : loading && containers.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.6, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} className="animate-spin" />
          <span>Loading Portainer containers... (5s timeout)</span>
        </div>
      ) : visibleContainers.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
          No containers found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem' }}>
          {visibleContainers.map(c => {
            const setting = containerSettings[c.name] || containerSettings[c.id] || {};
            const isRunning = c.state === "running";
            const isSelected = selectedContainerName === c.name || selectedContainerName === c.id;
            
            // Resolve custom URL -> inferred public domain/label URL -> inferred public port fallback
            let openUrl = setting.customUrl || c.inferredUrl;
            if (!openUrl && c.ports && c.ports.length > 0) {
              const pubPort = c.ports.find((p: any) => p.publicPort);
              if (pubPort) {
                const host = (portainerUrl || "http://localhost").replace(/^https?:\/\//, "").split(":")[0];
                openUrl = `http://${host}:${pubPort.publicPort}`;
              }
            }

            const displayName = setting.customName || c.name;

            const handleCardClick = () => {
              if (showEditControls && hasEditAccess) {
                // In edit mode: open BookmarkModal to edit container settings
                setEditingContainer({
                  id: c.id,
                  name: c.name,
                  title: displayName,
                  url: openUrl || "",
                  description: setting.description || c.status || c.state,
                  icon: setting.icon || "",
                  keywords: setting.keywords || "",
                });
              } else if (openUrl) {
                // Outside edit mode: open launch URL
                window.open(openUrl, "_blank");
              }
            };

            return (
              <div
                key={c.id}
                onClick={handleCardClick}
                onMouseEnter={() => {
                  if (onContainerHover) onContainerHover(c.name);
                }}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  background: isSelected 
                    ? 'rgba(var(--primary-rgb), 0.2)' 
                    : (isRunning ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(0,0,0,0.1)'),
                  border: isSelected
                    ? '1px solid var(--primary)'
                    : (setting.hidden ? '1px dashed rgba(239,68,68,0.4)' : (showEditControls && hasEditAccess ? '1px dashed var(--primary)' : '1px solid var(--glass-border)')),
                  boxShadow: isSelected ? '0 0 12px rgba(var(--primary-rgb), 0.35)' : 'none',
                  opacity: setting.hidden ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  position: 'relative',
                  cursor: (showEditControls && hasEditAccess) || openUrl ? 'pointer' : 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', position: 'relative' }}>
                    {setting.icon ? (
                      <IconComponent name={setting.icon} size={28} />
                    ) : (
                      <Server size={22} color={isRunning ? '#10b981' : '#ef4444'} />
                    )}
                    <span 
                      title={`Status: ${c.status || c.state}`}
                      style={{ 
                        position: 'absolute', 
                        bottom: '-2px', 
                        right: '-2px', 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: isRunning ? '#10b981' : '#ef4444',
                        border: '1.5px solid var(--glass-border, #1a1b26)',
                        boxShadow: isRunning ? '0 0 5px rgba(16, 185, 129, 0.8)' : '0 0 5px rgba(239, 68, 68, 0.8)'
                      }} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
                      {displayName}
                    </span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {setting.description || c.status || c.state}
                    </span>
                  </div>
                </div>

                {showEditControls && hasEditAccess ? (
                  <div style={{ padding: '0.3rem', borderRadius: '6px', background: 'rgba(var(--primary-rgb), 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center' }} title="Edit Container Settings">
                    <Edit3 size={13} />
                  </div>
                ) : openUrl ? (
                  <div style={{ padding: '0.3rem', borderRadius: '6px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center' }} title={`Open ${openUrl}`}>
                    <ExternalLink size={13} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Editing Container via BookmarkModal */}
      {editingContainer && (
        <BookmarkModal
          bookmark={{
            id: editingContainer.id,
            title: editingContainer.title,
            url: editingContainer.url,
            description: editingContainer.description,
            icon: editingContainer.icon,
            keywords: editingContainer.keywords,
          }}
          targetSectionId={section.id}
          modalMode="edit"
          onClose={() => setEditingContainer(null)}
          onSaved={() => {
            setEditingContainer(null);
            loadContainers();
          }}
          onCustomSave={async (data: { title: string; url: string; description: string; icon: string; keywords: string }) => {
            const updated = {
              ...containerSettings,
              [editingContainer.name]: {
                ...containerSettings[editingContainer.name],
                customName: data.title,
                customUrl: data.url,
                description: data.description,
                icon: data.icon,
                keywords: data.keywords,
              }
            };
            setContainerSettings(updated);
            await handleSaveConfig(updated);
            setEditingContainer(null);
          }}
        />
      )}

      {/* Portainer Connection Settings Modal (Admin Only) */}
      {showSettingsModal && isAdmin && (
        <div 
          className="modal-overlay fade-in" 
          onDragStart={(e) => e.stopPropagation()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => e.stopPropagation()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
        >
          <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', borderRadius: '24px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--glass-border)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Server size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Portainer Widget API Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={18} /></button>
            </div>

            {/* API Connection Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(var(--primary-rgb), 0.04)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>API Connection Settings</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Portainer Base URL</label>
                  <input
                    placeholder="https://docker.abraham16.com"
                    value={portainerUrl}
                    onChange={(e) => setPortainerUrl(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Endpoint ID (Optional — Auto-detected)</label>
                  <input
                    placeholder="Auto-detect (e.g. 2 or 5)"
                    value={endpointId}
                    onChange={(e) => setEndpointId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Portainer API Key (Hidden)</label>
                <input
                  type="password"
                  placeholder="ptr_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Draggable Multi-Tier Sorting Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                    Sorting Priority & Direction
                  </span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                    (Drag or use arrows to order primary, secondary, etc.)
                  </span>
                </div>
                
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    padding: '0.4rem',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {sortRules.map((rule, idx) => {
                    const meta = PORTAINER_SORT_FIELD_LABELS[rule.field] || {
                      label: rule.field,
                      ascLabel: 'Ascending',
                      descLabel: 'Descending',
                    };
                    const isEnabled = rule.enabled !== false;

                    return (
                      <div
                        key={rule.field}
                        draggable
                        onDragStart={(e) => {
                          setDraggedSortIndex(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverSortIndex(idx);
                        }}
                        onDragLeave={() => {
                          setDragOverSortIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggedSortIndex(null);
                          setDragOverSortIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedSortIndex !== null && draggedSortIndex !== idx) {
                            const reordered = [...sortRules];
                            const [removed] = reordered.splice(draggedSortIndex, 1);
                            reordered.splice(idx, 0, removed);
                            setSortRules(reordered);
                          }
                          setDraggedSortIndex(null);
                          setDragOverSortIndex(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          background:
                            draggedSortIndex === idx
                              ? 'rgba(var(--primary-rgb), 0.15)'
                              : dragOverSortIndex === idx
                              ? 'rgba(var(--primary-rgb), 0.25)'
                              : isEnabled
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(255,255,255,0.01)',
                          border:
                            dragOverSortIndex === idx
                              ? '1px solid var(--primary)'
                              : '1px solid rgba(255,255,255,0.05)',
                          cursor: 'grab',
                          userSelect: 'none',
                          opacity: isEnabled ? 1 : 0.45,
                          transition: 'background 0.15s, border 0.15s, opacity 0.15s',
                        }}
                      >
                        {/* Priority badge + Checkbox + Field Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              width: '16px',
                              textAlign: 'center',
                              opacity: isEnabled ? 0.8 : 0.3,
                              color: isEnabled ? 'var(--primary)' : 'inherit',
                            }}
                          >
                            #{idx + 1}
                          </span>

                          <input
                            type="checkbox"
                            id={`portainer-sort-check-${rule.field}`}
                            checked={isEnabled}
                            onChange={(e) => {
                              const updated = [...sortRules];
                              updated[idx] = { ...updated[idx], enabled: e.target.checked };
                              setSortRules(updated);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />

                          <label
                            htmlFor={`portainer-sort-check-${rule.field}`}
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: isEnabled ? 600 : 400,
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {meta.label}
                          </label>
                        </div>

                        {/* Direction selector + Chevrons + Handle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          <select
                            value={rule.order}
                            disabled={!isEnabled}
                            onChange={(e) => {
                              const updated = [...sortRules];
                              updated[idx] = { ...updated[idx], order: e.target.value as 'asc' | 'desc' };
                              setSortRules(updated);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              padding: '0.2rem 0.4rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              border: '1px solid var(--glass-border)',
                              background: '#1e1e2d',
                              color: 'var(--text)',
                              cursor: isEnabled ? 'pointer' : 'default',
                            }}
                          >
                            <option value="asc" style={{ background: '#1e1e2d', color: '#fff' }}>{meta.ascLabel}</option>
                            <option value="desc" style={{ background: '#1e1e2d', color: '#fff' }}>{meta.descLabel}</option>
                          </select>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSortRule(idx, 'up');
                              }}
                              disabled={idx === 0}
                              title="Move Priority Up"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text)',
                                opacity: idx === 0 ? 0.2 : 0.6,
                                cursor: idx === 0 ? 'default' : 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSortRule(idx, 'down');
                              }}
                              disabled={idx === sortRules.length - 1}
                              title="Move Priority Down"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text)',
                                opacity: idx === sortRules.length - 1 ? 0.2 : 0.6,
                                cursor: idx === sortRules.length - 1 ? 'default' : 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <ChevronDown size={14} />
                            </button>
                            <GripVertical size={13} style={{ opacity: 0.4, cursor: 'grab', marginLeft: '2px' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Container Visibility & Order List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>Container Visibility & Order</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {[...containers]
                  .sort((a, b) => {
                    const settingA = containerSettings[a.name] || containerSettings[a.id] || {};
                    const settingB = containerSettings[b.name] || containerSettings[b.id] || {};
                    const orderA = settingA.customOrder ?? 9999;
                    const orderB = settingB.customOrder ?? 9999;
                    if (orderA !== orderB) return orderA - orderB;
                    const nameA = (settingA.customName || a.name || "").toLowerCase();
                    const nameB = (settingB.customName || b.name || "").toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((c, idx, arr) => {
                    const setting = containerSettings[c.name] || {};
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{setting.customName || c.name}</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {/* Manual Reordering Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <button
                              type="button"
                              title="Move Up"
                              disabled={idx === 0}
                              onClick={() => moveContainerOrder(c.name, "up")}
                              style={{ padding: '0.25rem', borderRadius: '4px', border: 'none', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--text)', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 0.8 }}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              title="Move Down"
                              disabled={idx === arr.length - 1}
                              onClick={() => moveContainerOrder(c.name, "down")}
                              style={{ padding: '0.25rem', borderRadius: '4px', border: 'none', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--text)', cursor: idx === arr.length - 1 ? 'default' : 'pointer', opacity: idx === arr.length - 1 ? 0.3 : 0.8 }}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setContainerSettings(prev => ({
                                ...prev,
                                [c.name]: { ...prev[c.name], hidden: !prev[c.name]?.hidden }
                              }));
                            }}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: 'none', background: setting.hidden ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--primary-rgb), 0.1)', color: setting.hidden ? '#ef4444' : 'var(--text)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            {setting.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                            {setting.hidden ? "Hidden" : "Visible"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="btn glass"
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={savingSettings}
                onClick={() => handleSaveConfig()}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {savingSettings ? "Saving..." : "Save Connection Config"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

