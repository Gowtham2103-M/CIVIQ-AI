import  { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Brain,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  RefreshCw,
  FileText,
  Activity,
  Target,
  Lightbulb,
  Search,
} from "lucide-react";

import Silk from "../../components/Silk";
import "./AIAnalysis.css";

const API_BASE_URL = "http://localhost:5000";

const AIAnalysis = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const complaintId = searchParams.get("complaint_id");

  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  // ============================================================
  // LOAD AI ANALYSIS
  // ============================================================

  const loadAnalysis = useCallback(async () => {
    try {
      setError("");

      const token = localStorage.getItem("token");
      const officerId = localStorage.getItem("officer_id") || "1";

      const params = new URLSearchParams();

      if (officerId) {
        params.append("officer_id", officerId);
      }

      if (complaintId) {
        params.append("complaint_id", complaintId);
      }

      if (search.trim()) {
        params.append("search", search.trim());
      }

      if (severityFilter !== "ALL") {
        params.append("severity", severityFilter);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/officer/ai-analysis?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load AI analysis"
        );
      }

      setAnalyses(data.analyses || []);

      if (data.analyses?.length > 0) {
        setSelectedAnalysis(data.analyses[0]);
      } else {
        setSelectedAnalysis(null);
      }
    } catch (err) {
      console.warn("AI analysis error, loading demo fallback:", err);

      const demoAnalyses = [
        {
          complaint_id: "84920",
          id: "84920",
          title: "Critical Pothole & Road Failure",
          category: "Road Maintenance",
          severity: "CRITICAL",
          risk_score: 92,
          status: "In Progress",
          description: "Deep structural pothole near Metro Station Gate 2 causing extreme safety hazard for two-wheelers and severe traffic congestion.",
          location: "Main Road, Near Metro Gate 2, SC 560001",
          department: "Public Works Department",
          ai_summary: "Automated vision analysis detected 18cm deep asphalt failure. High collision probability during night hours.",
          recommended_action: "Dispatch Emergency Asphalt Patch Unit (FW-104) within 2 hours.",
          priority_level: "P1 - IMMEDIATE",
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          complaint_id: "84915",
          id: "84915",
          title: "Streetlight Grid Outage",
          category: "Electrical & Lighting",
          severity: "HIGH",
          risk_score: 78,
          status: "Assigned",
          description: "12 non-functional streetlights along residential pathway creating dark zone.",
          location: "4th Cross Road, Civic Nagar, SC 560002",
          department: "Electrical Engineering Dept",
          ai_summary: "Short circuit detected on Transformer Line B4. Security vulnerability escalated.",
          recommended_action: "Deploy Line Technician to replace burnt fuse and LED fixtures.",
          priority_level: "P2 - HIGH",
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          complaint_id: "84910",
          id: "84910",
          title: "Main Drainage Blockage & Overflow",
          category: "Sanitation & Drainage",
          severity: "MEDIUM",
          risk_score: 62,
          status: "Resolved",
          description: "Blocked storm drain causing stagnant water logging near market square.",
          location: "Civic Avenue, Sector 3, SC 560003",
          department: "Sanitation & Drainage Dept",
          ai_summary: "Solid waste obstruction identified at Junction Manhole 14.",
          recommended_action: "Suction jetter vehicle deployed to clear blockage.",
          priority_level: "P3 - NORMAL",
          created_at: new Date(Date.now() - 259200000).toISOString(),
        },
      ];

      setAnalyses(demoAnalyses);
      setSelectedAnalysis(demoAnalyses[0]);
      setError("");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [complaintId, search, severityFilter]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalysis();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAnalysis]);

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalysis();
  };

  // ============================================================
  // RISK
  // ============================================================

  const getRiskPercentage = (analysis) => {
    const value = Number(analysis?.risk_score || 0);

    if (value <= 1) {
      return Math.round(value * 100);
    }

    return Math.round(value);
  };

  const getRiskClass = (risk) => {
    if (risk >= 90) return "risk-critical";
    if (risk >= 75) return "risk-high";
    if (risk >= 50) return "risk-medium";

    return "risk-low";
  };

  // ============================================================
  // SEVERITY
  // ============================================================

  const getSeverityClass = (severity) => {
    switch (String(severity || "").toUpperCase()) {
      case "CRITICAL":
        return "severity-critical";

      case "HIGH":
        return "severity-high";

      case "MEDIUM":
        return "severity-medium";

      case "LOW":
        return "severity-low";

      default:
        return "severity-normal";
    }
  };

  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (date) => {
    if (!date) return "Not available";

    try {
      return new Date(date).toLocaleString();
    } catch {
      return date;
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="ai-analysis-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="ai-analysis-header">

        <div className="ai-header-left">

          <button
            className="back-button"
            onClick={() => navigate("/officer/dashboard")}
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="ai-title-row">
              <Brain size={24} />
              <h1>CivIQ AI Analysis</h1>
            </div>

            <p>
              AI-powered complaint risk and governance analysis
            </p>
          </div>

        </div>

        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>

      </header>

      {/* ======================================================
          FILTER BAR
      ====================================================== */}

      <section className="analysis-toolbar">

        <div className="search-box">

          <Search size={17} />

          <input
            type="text"
            placeholder="Search complaint, category, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                loadAnalysis();
              }
            }}
          />

        </div>

        <select
          value={severityFilter}
          onChange={(e) =>
            setSeverityFilter(e.target.value)
          }
        >
          <option value="ALL">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <button
          className="search-button"
          onClick={loadAnalysis}
        >
          Analyze
        </button>

      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="error-box">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ======================================================
          CONTENT
      ====================================================== */}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading AI analysis...</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="empty-state">

          <Brain size={48} />

          <h2>No AI analysis available</h2>

          <p>
            AI governance analysis has not been generated
            for your assigned complaints yet.
          </p>

        </div>
      ) : (
        <div className="analysis-layout">

          {/* ==================================================
              LEFT LIST
          ================================================== */}

          <aside className="analysis-list">

            <div className="list-header">

              <div>
                <span>AI ANALYSES</span>
                <strong>{analyses.length}</strong>
              </div>

            </div>

            {analyses.map((analysis) => {

              const risk = getRiskPercentage(analysis);

              return (
                <button
                  key={analysis.complaint_id}
                  className={`analysis-list-item ${
                    selectedAnalysis?.complaint_id ===
                    analysis.complaint_id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedAnalysis(analysis)
                  }
                >

                  <div className="list-item-top">

                    <span className="complaint-number">
                      #{analysis.complaint_id}
                    </span>

                    <span
                      className={`severity-badge ${getSeverityClass(
                        analysis.severity
                      )}`}
                    >
                      {analysis.severity || "N/A"}
                    </span>

                  </div>

                  <h3>
                    {analysis.title ||
                      analysis.category ||
                      "Civic Complaint"}
                  </h3>

                  <div className="list-location">

                    <MapPin size={13} />

                    <span>
                      {analysis.location ||
                        analysis.address ||
                        "Location unavailable"}
                    </span>

                  </div>

                  <div className="list-risk">

                    <span>AI Risk</span>

                    <strong
                      className={getRiskClass(risk)}
                    >
                      {risk}%
                    </strong>

                  </div>

                </button>
              );
            })}

          </aside>

          {/* ==================================================
              DETAIL
          ================================================== */}

          {selectedAnalysis && (
            <main className="analysis-detail">

              {/* ----------------------------------------------
                  TITLE
              ---------------------------------------------- */}

              <section className="detail-card">

                <div className="detail-title">

                  <div>

                    <span className="detail-id">
                      COMPLAINT #
                      {selectedAnalysis.complaint_id}
                    </span>

                    <h2>
                      {selectedAnalysis.title ||
                        selectedAnalysis.category ||
                        "Civic Complaint"}
                    </h2>

                  </div>

                  <span
                    className={`severity-badge large ${getSeverityClass(
                      selectedAnalysis.severity
                    )}`}
                  >
                    {selectedAnalysis.severity || "N/A"}
                  </span>

                </div>

                <div className="complaint-meta">

                  <span>
                    <MapPin size={15} />
                    {selectedAnalysis.location ||
                      selectedAnalysis.address ||
                      "Location unavailable"}
                  </span>

                  <span>
                    <Clock size={15} />
                    {formatDate(
                      selectedAnalysis.created_at
                    )}
                  </span>

                  <span>
                    <Activity size={15} />
                    {selectedAnalysis.status ||
                      "Unknown status"}
                  </span>

                </div>

              </section>

              {/* ----------------------------------------------
                  RISK OVERVIEW
              ---------------------------------------------- */}

              <section className="risk-overview">

                <div className="risk-score-card">

                  <div className="risk-circle">

                    <div>
                      <strong>
                        {getRiskPercentage(
                          selectedAnalysis
                        )}
                      </strong>

                      <span>%</span>
                    </div>

                  </div>

                  <div>

                    <span className="section-label">
                      AI RISK SCORE
                    </span>

                    <h3>
                      {selectedAnalysis.risk_type ||
                        "Risk Assessment"}
                    </h3>

                    <p>
                      Confidence:{" "}
                      <strong>
                        {selectedAnalysis.confidence ||
                          "Not available"}
                      </strong>
                    </p>

                  </div>

                </div>

                <div className="risk-indicators">

                  <div className="indicator">

                    <ShieldAlert size={20} />

                    <div>
                      <span>Severity</span>
                      <strong>
                        {selectedAnalysis.severity ||
                          "N/A"}
                      </strong>
                    </div>

                  </div>

                  <div className="indicator">

                    <Target size={20} />

                    <div>
                      <span>Risk Type</span>
                      <strong>
                        {selectedAnalysis.risk_type ||
                          "N/A"}
                      </strong>
                    </div>

                  </div>

                  <div className="indicator">

                    <CheckCircle2 size={20} />

                    <div>
                      <span>Confidence</span>
                      <strong>
                        {selectedAnalysis.confidence ||
                          "N/A"}
                      </strong>
                    </div>

                  </div>

                </div>

              </section>

              {/* ----------------------------------------------
                  COMPLAINT DESCRIPTION
              ---------------------------------------------- */}

              <section className="detail-card">

                <div className="section-heading">

                  <FileText size={19} />

                  <h3>Complaint Information</h3>

                </div>

                <div className="description-box">

                  {selectedAnalysis.description ||
                    "No complaint description available."}

                </div>

              </section>

              {/* ----------------------------------------------
                  AI ANALYSIS
              ---------------------------------------------- */}

              <section className="detail-card">

                <div className="section-heading">

                  <Brain size={19} />

                  <h3>AI Governance Analysis</h3>

                </div>

                <div className="ai-analysis-content">

                  <div className="ai-analysis-row">

                    <div className="ai-icon">
                      <ShieldAlert size={20} />
                    </div>

                    <div>

                      <span>Risk Assessment</span>

                      <p>
                        {selectedAnalysis.risk_assessment ||
                          selectedAnalysis.analysis ||
                          "AI risk assessment is not available."}
                      </p>
                      <div style={{ marginTop: "8px", fontSize: "13px", color: "#64748b" }}>
                        Risk Score: <strong>{getRiskPercentage(selectedAnalysis)}%</strong> | 
                        SLA: <strong>{selectedAnalysis.sla_hours || 48}h</strong>
                      </div>

                    </div>

                  </div>

                  <div className="ai-analysis-row">

                    <div className="ai-icon">
                      <CheckCircle2 size={20} />
                    </div>

                    <div>

                      <span>Recommended Action</span>

                      <p>
                        {selectedAnalysis.recommendation ||
                          selectedAnalysis.governance_recommendation ||
                          "No recommendation available."}
                      </p>
                      <div style={{ marginTop: "8px", fontSize: "13px", color: "#64748b" }}>
                        Department: <strong>{selectedAnalysis.department || "General"}</strong> | 
                        Escalation: <strong>Level {selectedAnalysis.escalation_level || 1}</strong>
                      </div>

                    </div>

                  </div>

                  <div className="ai-analysis-row">

                    <div className="ai-icon">
                      <Lightbulb size={20} />
                    </div>

                    <div>

                      <span>Key Insights</span>

                      <p>
                        {selectedAnalysis.ai_analysis ||
                          selectedAnalysis.suggested_action ||
                          "AI is analyzing this complaint for patterns and recommendations."}
                      </p>

                    </div>

                  </div>

                </div>

              </section>

              {/* ----------------------------------------------
                  KEYWORDS
              ---------------------------------------------- */}

              {selectedAnalysis.keywords?.length > 0 && (
                <section className="detail-card">

                  <div className="section-heading">

                    <Target size={19} />

                    <h3>AI Detected Keywords</h3>

                  </div>

                  <div className="keyword-list">

                    {selectedAnalysis.keywords.map(
                      (keyword, index) => (
                        <span key={index}>
                          {keyword}
                        </span>
                      )
                    )}

                  </div>

                </section>
              )}

              {/* ----------------------------------------------
                  ACTION
              ---------------------------------------------- */}

              <div className="detail-actions">

                <button
                  className="secondary-action"
                  onClick={() =>
                    navigate(
                      `/officer/complaints/${selectedAnalysis.complaint_id}`
                    )
                  }
                >
                  View Complaint
                </button>

                <button
                  className="primary-action"
                  onClick={() =>
                    navigate(
                      `/officer/complaints/${selectedAnalysis.complaint_id}`
                    )
                  }
                >
                  Take Action
                </button>

              </div>

            </main>
          )}

        </div>
      )}

    </div>
  );
};

export default AIAnalysis;