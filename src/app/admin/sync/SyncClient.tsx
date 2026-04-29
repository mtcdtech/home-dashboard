"use client";

import React, { useState } from "react";
import { Download, Share2, Copy, KeyRound, CheckCircle2, Users, ChevronDown, ChevronRight, Globe, Info, ShieldCheck, Edit3, Eye, ArrowDownLeft, X as XIcon, Zap } from "lucide-react";
import * as actions from "@/app/admin/actions";
import { useRouter } from "next/navigation";
import SyncPermissionMatrix from "./SyncPermissionMatrix";

export default function SyncClient({ allTabs, users = [], departments = [] }: { allTabs: any[]; users?: any[]; departments?: string[] }) {
  const router = useRouter();
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [generatingForId, setGeneratingForId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleImport = async () => {
    if (!importUrl) return;
    if (!importUrl.startsWith("http")) return alert("Invalid URL. Must start with http or https");
    
    setIsImporting(true);
    setImportProgress(10);
    
    // Fake progress animation
    const progressInterval = setInterval(() => {
       setImportProgress(prev => {
          if (prev >= 90) return prev;
          return prev + (90 - prev) * 0.1; // slow down as it gets closer to 90
       });
    }, 500);

    try {
      await actions.importWorkspaceFromSyncUrl(importUrl);
      clearInterval(progressInterval);
      setImportProgress(100);
      setTimeout(() => {
         setImportUrl("");
         alert("Workspace imported successfully and added to the library!");
         router.refresh();
         setIsImporting(false);
         setImportProgress(0);
      }, 500);
    } catch (e: any) {
      clearInterval(progressInterval);
      alert("Failed to import workspace: " + e.message);
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleGenerate = async (tabId: string) => {
    if(confirm("Generate a public, read-only sync URL for this workspace? Anyone with the URL can import this workspace to another server.")) {
       setGeneratingForId(tabId);
       await actions.generateTabSyncToken(tabId);
       setGeneratingForId(null);
       router.refresh();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
         <h1 style={{ margin: 0, fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Share2 size={28} /> Workspace Synchronization
         </h1>
         <p style={{ margin: 0, opacity: 0.8, maxWidth: '800px', lineHeight: 1.5 }}>
            Export your workspaces to other MTCD servers, or import workspaces generated from external servers. Imported workspaces are read-only and automatically sync with their source server.
         </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        
        {/* Import Section */}
        <div className="glass glass-card" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
            <Download size={24} style={{ color: 'var(--primary)' }} /> Import a Workspace
          </h2>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
             Paste a Sync URL from another MTCD server to import its layout. The workspace will be automatically added to the global Catalog library so that users can view it.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               <label style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.6, textTransform: 'uppercase' }}>Remote Sync URL</label>
               <input 
                 value={importUrl}
                 onChange={(e) => setImportUrl(e.target.value)}
                 placeholder="https://home.other-server.mtcd.org/api/sync/workspace?id=..."
                 className="glass"
                 style={{ padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.95rem' }}
               />
            </div>
            
            <button 
               onClick={handleImport}
               disabled={!importUrl.trim() || isImporting}
               className="btn btn-primary"
               style={{ position: 'relative', overflow: 'hidden', padding: '0.85rem', borderRadius: '10px', fontWeight: 600, opacity: !importUrl.trim() || isImporting ? 0.5 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
               {isImporting && (
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${importProgress}%`, background: 'rgba(255,255,255,0.2)', transition: 'width 0.5s ease-out' }} />
               )}
               <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 {isImporting ? "Importing... This may take a minute" : <><Download size={18} /> Import Workspace</>}
               </span>
            </button>
          </div>
        </div>

        {/* Export Section */}
        <div className="glass glass-card" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
            <Share2 size={24} style={{ color: 'var(--primary)' }} /> Share Workspaces
          </h2>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
             Generate read-only sync URLs for your workspaces. Anyone with the URL can import the workspace to their MTCD server.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
             {allTabs.filter(t => !t.isReadOnlySync).length === 0 && (
                <div style={{ opacity: 0.5, fontStyle: 'italic' }}>No shareable workspaces found.</div>
             )}
             
             {allTabs.filter(t => !t.isReadOnlySync).map(tab => {
                const syncUrl = tab.syncToken ? `${originUrl}/api/sync/workspace?id=${tab.id}&token=${tab.syncToken}` : null;
                return (
                   <div key={tab.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontWeight: 600 }}>{tab.title}</span>
                         {tab.syncToken && <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 600 }}><CheckCircle2 size={12} /> Active</span>}
                      </div>
                      
                      {syncUrl ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                               readOnly 
                               value={syncUrl}
                               className="glass"
                               style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}
                            />
                            <button 
                               onClick={() => copyToClipboard(syncUrl)}
                               className="btn btn-primary"
                               style={{ padding: '0.6rem', borderRadius: '8px' }}
                               title="Copy URL"
                            >
                               <Copy size={16} />
                            </button>
                         </div>
                      ) : (
                         <button
                            onClick={() => handleGenerate(tab.id)}
                            disabled={generatingForId === tab.id}
                            style={{ alignSelf: 'flex-start', padding: '0.5rem 0.85rem', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                         >
                            <KeyRound size={14} /> {generatingForId === tab.id ? "Generating..." : "Generate Sync URL"}
                         </button>
                      )}
                   </div>
                );
             })}
          </div>
        </div>

        {/* Imported Workspaces Section */}
        <div className="glass glass-card" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
            <Download size={24} style={{ color: 'var(--primary)' }} /> Imported Workspaces
          </h2>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
             Workspaces you have imported from external servers. They automatically receive updates from their source.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
             {allTabs.filter(t => t.isReadOnlySync).length === 0 && (
                <div style={{ opacity: 0.5, fontStyle: 'italic' }}>No imported workspaces found.</div>
             )}
             
             {allTabs.filter(t => t.isReadOnlySync).map(tab => {
                return (
                   <div key={tab.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontWeight: 600 }}>{tab.title}</span>
                         <button
                            onClick={async () => {
                               if (confirm("Are you sure you want to completely remove this imported workspace? This will also remove its associated sections and themes.")) {
                                  setDeletingId(tab.id);
                                  try {
                                     await actions.deleteTab(tab.id);
                                     router.refresh();
                                  } catch (e: any) {
                                     alert("Failed to delete: " + e.message);
                                  } finally {
                                     setDeletingId(null);
                                  }
                               }
                            }}
                            disabled={deletingId === tab.id}
                            className="btn btn-danger"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px', opacity: deletingId === tab.id ? 0.5 : 1 }}
                         >
                            {deletingId === tab.id ? "Removing..." : "Remove"}
                         </button>
                      </div>
                      
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                         <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.6, textTransform: 'uppercase' }}>Imported Dependencies</div>
                         {tab.theme && (
                            <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                               <span style={{ color: 'var(--primary)' }}>• Theme:</span> {tab.theme.name}
                            </div>
                         )}
                         {tab.tabSections?.length > 0 && (
                            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                               <span style={{ color: 'var(--primary)', marginBottom: '0.2rem' }}>• Sections:</span>
                               {tab.tabSections.map((ts: any) => (
                                  <span key={ts.id} style={{ opacity: 0.8, paddingLeft: '1rem' }}>- {ts.section.title}</span>
                               ))}
                            </div>
                         )}
                      </div>
                   </div>
                );
             })}
          </div>
        </div>

      </div>

      {/* Permission Matrix for Imported Workspaces */}
      {allTabs.filter(t => t.isReadOnlySync).length > 0 && (
        <SyncPermissionMatrix
          syncedTabs={allTabs.filter(t => t.isReadOnlySync)}
          users={users}
          departments={departments}
        />
      )}
    </div>
  );
}
