"use client";

import React, { useState } from "react";
import { Activity, X, Filter } from "lucide-react";

export function RecentActivityClient({ initialFeed }: { initialFeed: any[] }) {
  const [feed] = useState(initialFeed);
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const uniqueUsers = Array.from(new Set(feed.map(entry => entry.userName || "Anonymous"))).sort();

  const typeLabel: Record<string, string> = {
    login: "Logged in",
    bookmark_click: "Clicked bookmark",
    section_edit: "Edited section",
    tab_edit: "Edited workspace",
    theme_edit: "Edited theme",
    bookmark_edit: "Edited bookmark",
  };

  const typeColor: Record<string, string> = {
    login: "#10b981",
    bookmark_click: "#3b82f6",
    section_edit: "#f59e0b",
    tab_edit: "#8b5cf6",
    theme_edit: "#ec4899",
    bookmark_edit: "#6366f1",
  };

  const filteredFeed = feed.filter((entry) => {
    if (filterUser && (entry.userName || "Anonymous") !== filterUser) return false;
    if (filterType && entry.type !== filterType) return false;
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      if (!((entry.userName || "").toLowerCase().includes(s) || (entry.detail || "").toLowerCase().includes(s) || (typeLabel[entry.type] || entry.type).toLowerCase().includes(s))) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0', minWidth: 0, overflow: 'hidden', height: '100%' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Activity size={20} /> Recent Activity
      </h3>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Search activity..." 
          className="input" 
          value={filterSearch} 
          onChange={(e) => setFilterSearch(e.target.value)} 
          style={{ flex: 1, minWidth: '120px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text)' }}
        />
        <select 
          className="input" 
          value={filterUser} 
          onChange={(e) => setFilterUser(e.target.value)} 
          style={{ flex: 1, minWidth: '120px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text)' }}
        >
          <option value="">All Users</option>
          {uniqueUsers.map(user => (
            <option key={user as string} value={user as string}>{user as string}</option>
          ))}
        </select>
        <select 
          className="input" 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{ flex: 1, minWidth: '120px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text)' }}
        >
          <option value="">All Activities</option>
          <option value="login">Logins</option>
          <option value="tab_edit">Workspaces</option>
          <option value="section_edit">Sections</option>
          <option value="bookmark_edit">Bookmarks</option>
          <option value="theme_edit">Themes</option>
          <option value="bookmark_click">Clicks</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
        {filteredFeed.length === 0 && (
          <p style={{ opacity: 0.4, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No activity found</p>
        )}
        {filteredFeed.map((entry: any) => (
          <div 
            key={entry.id} 
            onClick={() => setSelectedItem(entry)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0.5rem', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', borderRadius: '4px', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: typeColor[entry.type] || '#888', marginTop: '0.35rem', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{entry.userName || 'Anonymous'}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.55 }}> — {typeLabel[entry.type] || entry.type}</span>
              {entry.detail && <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', opacity: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.detail}</p>}
            </div>
            <span style={{ fontSize: '0.65rem', opacity: 0.35, whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
              {new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', position: 'relative' }}>
            <button 
              onClick={() => setSelectedItem(null)} 
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', opacity: 0.5 }}
            >
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Activity Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div><strong>User:</strong> {selectedItem.userName || 'Anonymous'}</div>
              <div><strong>Action:</strong> {typeLabel[selectedItem.type] || selectedItem.type}</div>
              <div><strong>Time:</strong> {new Date(selectedItem.createdAt).toLocaleString()}</div>
              <div><strong>Details:</strong> <br/><span style={{ opacity: 0.7 }}>{selectedItem.detail || 'None'}</span></div>
              {selectedItem.userId && <div><strong>User ID:</strong> <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{selectedItem.userId}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
