"use client";

import React, { useState, useEffect } from "react";
import { Server, Activity, Power, RefreshCw, Eye, EyeOff, ExternalLink, Settings, X, Search, Check, AlertCircle, Edit3 } from "lucide-react";
import { fetchPortainerContainers, updateSectionWidgetConfig } from "@/app/admin/actions";
import { IconComponent } from "../IconPicker";
import { BookmarkModal } from "../BookmarkModal";

export interface PortainerWidgetProps {
  section: any;
  showEditControls?: boolean;
  hasEditAccess?: boolean;
  isAdmin?: boolean;
  onRefresh?: () => void;
}

export function PortainerWidget({ section, showEditControls, hasEditAccess, isAdmin, onRefresh }: PortainerWidgetProps) {
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
  const [sortBy, setSortBy] = useState<"name" | "status">(rawConfig.sortBy || "name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(rawConfig.sortOrder || "asc");
  
  // Custom container settings: { [containerIdOrName]: { hidden?: boolean, customUrl?: string, customName?: string, icon?: string, description?: string, keywords?: string } }
  const [containerSettings, setContainerSettings] = useState<Record<string, { hidden?: boolean; customUrl?: string; customName?: string; icon?: string; description?: string; keywords?: string }>>(rawConfig.containers || {});

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

  const handleSaveConfig = async (newContainerSettings?: any) => {
    setSavingSettings(true);
    try {
      const updatedConfig = {
        url: portainerUrl.trim(),
        apiKey: apiKey.trim(),
        endpointId: endpointId.trim(),
        sortBy,
        sortOrder,
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
      if (filter && !nameToMatch.toLowerCase().includes(filter.toLowerCase()) && !c.image.toLowerCase().includes(filter.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const settingA = containerSettings[a.name] || containerSettings[a.id] || {};
      const settingB = containerSettings[b.name] || containerSettings[b.id] || {};
      const nameA = (settingA.customName || a.name || "").toLowerCase();
      const nameB = (settingB.customName || b.name || "").toLowerCase();

      let comparison = 0;
      if (sortBy === "status") {
        const isRunningA = a.state === "running" ? 0 : 1;
        const isRunningB = b.state === "running" ? 0 : 1;
        if (isRunningA !== isRunningB) {
          comparison = isRunningA - isRunningB;
        } else {
          comparison = nameA.localeCompare(nameB);
        }
      } else {
        comparison = nameA.localeCompare(nameB);
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

  const totalCount = containers.length;
  const runningCount = containers.filter(c => c.state === "running").length;
  const stoppedCount = totalCount - runningCount;

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
      
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
            
            // Resolve custom URL or inferred public port
            let openUrl = setting.customUrl;
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
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  background: isRunning ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(0,0,0,0.1)',
                  border: setting.hidden ? '1px dashed rgba(239,68,68,0.4)' : (showEditControls && hasEditAccess ? '1px dashed var(--primary)' : '1px solid var(--glass-border)'),
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', position: 'relative' }}>
                    {setting.icon ? (
                      <IconComponent name={setting.icon} size={16} />
                    ) : (
                      <Server size={15} color={isRunning ? '#10b981' : '#ef4444'} />
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
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
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
        <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "name" | "status")}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="name" style={{ background: '#1e1e2d', color: '#fff' }}>Name</option>
                    <option value="status" style={{ background: '#1e1e2d', color: '#fff' }}>Status</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Sort Direction</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="asc" style={{ background: '#1e1e2d', color: '#fff' }}>Ascending (A-Z / Running first)</option>
                    <option value="desc" style={{ background: '#1e1e2d', color: '#fff' }}>Descending (Z-A / Stopped first)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Container Visibility List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>Container Visibility</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {[...containers]
                  .sort((a, b) => {
                    const settingA = containerSettings[a.name] || containerSettings[a.id] || {};
                    const settingB = containerSettings[b.name] || containerSettings[b.id] || {};
                    const nameA = (settingA.customName || a.name || "").toLowerCase();
                    const nameB = (settingB.customName || b.name || "").toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map(c => {
                    const setting = containerSettings[c.name] || {};
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{setting.customName || c.name}</span>
                        
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

