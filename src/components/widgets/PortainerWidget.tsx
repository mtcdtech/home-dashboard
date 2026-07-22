"use client";

import React, { useState, useEffect } from "react";
import { Server, Activity, Power, RefreshCw, Eye, EyeOff, ExternalLink, Settings, X, Search, Check, AlertCircle } from "lucide-react";
import { fetchPortainerContainers, updateSectionWidgetConfig } from "@/app/admin/actions";
import { IconComponent } from "../IconPicker";

export interface PortainerWidgetProps {
  section: any;
  showEditControls?: boolean;
  hasEditAccess?: boolean;
  onRefresh?: () => void;
}

export function PortainerWidget({ section, showEditControls, hasEditAccess, onRefresh }: PortainerWidgetProps) {
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Widget Configuration from Section DB
  const rawConfig = typeof section?.widgetConfig === "string" 
    ? (JSON.parse(section.widgetConfig) || {}) 
    : (section?.widgetConfig || {});

  const [portainerUrl, setPortainerUrl] = useState(rawConfig.url || "");
  const [apiKey, setApiKey] = useState(rawConfig.apiKey || "");
  const [endpointId, setEndpointId] = useState(rawConfig.endpointId || "5");
  
  // Custom container settings: { [containerIdOrName]: { hidden?: boolean, customUrl?: string, icon?: string } }
  const [containerSettings, setContainerSettings] = useState<Record<string, { hidden?: boolean; customUrl?: string; icon?: string }>>(rawConfig.containers || {});

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

  const handleSaveConfig = async () => {
    setSavingSettings(true);
    try {
      const updatedConfig = {
        url: portainerUrl.trim(),
        apiKey: apiKey.trim(),
        endpointId: endpointId.trim(),
        containers: containerSettings
      };
      await updateSectionWidgetConfig(section.id, updatedConfig);
      setShowSettingsModal(false);
      await loadContainers();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert("Failed to save widget configuration: " + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const visibleContainers = containers.filter(c => {
    const setting = containerSettings[c.name] || containerSettings[c.id];
    if (setting?.hidden && !showSettingsModal) return false;
    if (filter && !c.name.toLowerCase().includes(filter.toLowerCase()) && !c.image.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    return true;
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
          {hasEditAccess && (
            <button 
              onClick={() => setShowSettingsModal(true)} 
              title="Configure Portainer Widget"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.7, padding: '0.2rem', display: 'flex' }}
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Container List Grid */}
      {loading && containers.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
          Loading Portainer containers...
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

            return (
              <div
                key={c.id}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  background: isRunning ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(0,0,0,0.1)',
                  border: setting.hidden ? '1px dashed rgba(239,68,68,0.4)' : '1px solid var(--glass-border)',
                  opacity: setting.hidden ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }}>
                    {setting.icon ? (
                      <IconComponent name={setting.icon} size={16} />
                    ) : (
                      <Server size={15} color={isRunning ? '#10b981' : '#ef4444'} />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.status || c.state}
                    </span>
                  </div>
                </div>

                {openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '0.3rem', borderRadius: '6px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                    title={`Open ${openUrl}`}
                  >
                    <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Portainer Configuration Modal */}
      {showSettingsModal && (
        <div className="modal-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="glass modal-content fade-in" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', borderRadius: '24px', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--glass-border)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Server size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Portainer Widget Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.5 }}><X size={18} /></button>
            </div>

            {/* API Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(var(--primary-rgb), 0.04)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>API Connection (Defaults to Abraham Portainer)</span>
              
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
                  <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Endpoint ID</label>
                  <input
                    placeholder="5"
                    value={endpointId}
                    onChange={(e) => setEndpointId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.2rem' }}>Portainer API Key</label>
                <input
                  type="password"
                  placeholder="ptr_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Container Customizations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>Container Customization</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                {containers.map(c => {
                  const setting = containerSettings[c.name] || {};
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '130px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      
                      <input
                        placeholder="Custom Launch URL (http://...)"
                        value={setting.customUrl || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setContainerSettings(prev => ({
                            ...prev,
                            [c.name]: { ...prev[c.name], customUrl: val }
                          }));
                        }}
                        style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(var(--primary-rgb), 0.04)', color: 'var(--text)', fontSize: '0.75rem', outline: 'none' }}
                      />

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
                onClick={handleSaveConfig}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {savingSettings ? "Saving..." : "Save Widget Config"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
