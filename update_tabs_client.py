import re

with open('/Users/benny2168/Dockers/MTCD/docker/antigravity/mtcd-workspaces/homedashboard/src/app/admin/tabs/TabsClient.tsx', 'r') as f:
    content = f.read()

# Fix inherited dropdown option text
content = content.replace("Inherited ({deptRole === 'none' ? 'Not Shared' : deptRole.charAt(0).toUpperCase() + deptRole.slice(1)})", "Inherited ({effectiveDeptRole === 'none' ? 'Not Shared' : effectiveDeptRole.charAt(0).toUpperCase() + effectiveDeptRole.slice(1)})")
content = content.replace('<option value="none">Not Shared</option>', '<option value="none" disabled={isPushedUser}>Not Shared</option>')

# Add Send icon inside tooltip container
send_icon = """                                                  )}
                                                  {isPushedUser && (
                                                     <div className="tooltip-container" style={{ position: 'relative', display: 'flex' }}>
                                                        <a 
                                                           href="#" 
                                                           onClick={(e) => { e.preventDefault(); setViewMode("push"); }}
                                                           style={{
                                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                              width: '24px', height: '24px', flexShrink: 0,
                                                              color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)',
                                                              borderRadius: '6px',
                                                              border: '1px solid rgba(34, 197, 94, 0.25)',
                                                              cursor: 'pointer', textDecoration: 'none'
                                                           }}
                                                        >
                                                           <Send size={10} />
                                                        </a>
                                                        <div className="tooltip-bubble" style={{ 
                                                           position: 'absolute', bottom: '100%', right: 0, transform: 'translateY(-8px)', 
                                                           background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px', 
                                                           fontSize: '0.65rem', width: 'max-content', zIndex: 10, visibility: 'hidden', opacity: 0, 
                                                           transition: '0.2s all', border: '1px solid var(--glass-border)', textAlign: 'left', whiteSpace: 'normal', maxWidth: '200px'
                                                        }}>
                                                           Pushed to this user/department &mdash; click to manage in Push Matrix
                                                        </div>
                                                     </div>
                                                  )}
                                               </div>"""
content = content.replace('                                                  )}\n                                               </div>', send_icon)

with open('/Users/benny2168/Dockers/MTCD/docker/antigravity/mtcd-workspaces/homedashboard/src/app/admin/tabs/TabsClient.tsx', 'w') as f:
    f.write(content)

print("Updated TabsClient.tsx")
