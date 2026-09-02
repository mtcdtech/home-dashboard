"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  widgetTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WidgetErrorBoundary caught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "1.25rem", borderRadius: "12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700 }}>
            <AlertTriangle size={16} />
            <span>Widget Diagnostic Exception ({this.props.widgetTitle || "Widget"})</span>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.5rem", borderRadius: "6px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
            {this.state.error?.message || String(this.state.error || "Unknown rendering exception")}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-secondary"
            style={{ alignSelf: "flex-start", padding: "0.35rem 0.75rem", fontSize: "0.75rem", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}
          >
            <RefreshCw size={12} />
            <span>Retry Widget Render</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
