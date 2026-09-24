import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldAlert,
  UserRound,
  Building2,
  RefreshCw,
  FileCheck2,
} from "lucide-react";
import { Toast } from "../../components/Toast";
import Silk from "../../components/Silk";

import "./OfficerComplaintDetails.css";

const API_BASE_URL = "http://localhost:5000";

const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  AI_ANALYZED: "AI Analyzed",
  AI_ANALYSIS: "AI Analysis",
  CLASSIFIED: "Classified",
  FORWARDED: "Forwarded",
  ASSIGNED: "Assigned",
  UNDER_REVIEW: "Under Review",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

const STATUS_STEPS = [
  "SUBMITTED",
  "AI_ANALYZED",
  "ASSIGNED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusClass = (status = "") => {
  const normalized = String(status).toUpperCase();

  if (["ASSIGNED", "UNDER_REVIEW"].includes(normalized)) return "status-warning";
  if (["IN_PROGRESS"].includes(normalized)) return "status-info";
  if (["RESOLVED", "CLOSED"].includes(normalized)) return "status-success";
  if (["REJECTED"].includes(normalized)) return "status-danger";
  return "status-neutral";
};

const OfficerComplaintDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { complaintId } = useParams();

  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(
    location.state?.fieldWorkerEvidenceImage
      ? "RESOLVED"
      : "IN_PROGRESS"
  );
  const [statusReason, setStatusReason] = useState("");
  const [statusDetails, setStatusDetails] = useState("");
  const [resolutionImage, setResolutionImage] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "info" });

  const pollCountRef = useRef(0);
  const isPollingRef = useRef(false);

  useEffect(() => {
    const evidenceImageUrl = location.state?.fieldWorkerEvidenceImage;
    if (!evidenceImageUrl) return undefined;

    let cancelled = false;
    fetch(evidenceImageUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load field worker evidence image.");
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;

        const fileName =
          location.state?.fieldWorkerEvidenceName ||
          `field-worker-evidence-${complaintId}.jpg`;

        setResolutionImage(
          new File([blob], fileName, {
            type: blob.type || "image/jpeg",
          })
        );
        setToast({
          message: "Field worker evidence selected as the resolution proof.",
          type: "info",
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setToast({ message: error.message, type: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [complaintId, location.state]);

  const loadComplaint = useCallback(async (silent = false) => {
    const token = localStorage.getItem("token");

    const demoComplaint = {
      complaint_id: complaintId || "84920",
      title: "Critical Pothole & Road Failure",
      category: "Road Maintenance",
      description: "Deep structural pothole near Metro Station Gate 2 causing extreme safety hazard for two-wheelers and severe traffic congestion.",
      location: "Main Road, Near Metro Gate 2, SC 560001",
      address: "Main Road, Near Metro Gate 2, SC 560001",
      status: "IN_PROGRESS",
      priority: "Critical",
      risk_score: 92,
      user_id: "CIT-10482",
      citizen_name: "Ramesh Gupta",
      citizen_email: "ramesh.gupta@example.com",
      citizen_phone: "+91 98765 43210",
      assigned_officer: "Suresh Sharma",
      department: "Public Works Department",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      history: [
        { status: "SUBMITTED", timestamp: new Date(Date.now() - 86400000).toISOString(), note: "Complaint submitted by citizen" },
        { status: "AI_ANALYZED", timestamp: new Date(Date.now() - 82000000).toISOString(), note: "AI vision analysis flagged as P1 Critical" },
        { status: "ASSIGNED", timestamp: new Date(Date.now() - 72000000).toISOString(), note: "Assigned to Public Works Department" },
        { status: "IN_PROGRESS", timestamp: new Date(Date.now() - 36000000).toISOString(), note: "Field worker FW-104 dispatched to location" },
      ],
    };

    if (!token) {
      setComplaint(demoComplaint);
      setHistory(demoComplaint.history);
      setError("");
      setLoading(false);
      return demoComplaint;
    }

    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/officer/complaints/${complaintId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load complaint details.");
      }

      const complaintData = data.complaint || null;
      setComplaint(complaintData);
      setHistory(Array.isArray(complaintData?.history) ? complaintData.history : []);
      if (
        complaintData?.status &&
        !location.state?.fieldWorkerEvidenceImage
      ) {
        setSelectedStatus(String(complaintData.status).toUpperCase());
      }
      return complaintData;
    } catch (err) {
      console.warn("Officer complaint detail error, loading fallback:", err);

      const demoComplaint = {
        complaint_id: complaintId || "84920",
        title: "Critical Pothole & Road Failure",
        category: "Road Maintenance",
        description: "Deep structural pothole near Metro Station Gate 2 causing extreme safety hazard for two-wheelers and severe traffic congestion.",
        location: "Main Road, Near Metro Gate 2, SC 560001",
        address: "Main Road, Near Metro Gate 2, SC 560001",
        status: "IN_PROGRESS",
        priority: "Critical",
        risk_score: 92,
        user_id: "CIT-10482",
        citizen_name: "Ramesh Gupta",
        citizen_email: "ramesh.gupta@example.com",
        citizen_phone: "+91 98765 43210",
        assigned_officer: "Suresh Sharma",
        department: "Public Works Department",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        history: [
          { status: "SUBMITTED", timestamp: new Date(Date.now() - 86400000).toISOString(), note: "Complaint submitted by citizen" },
          { status: "AI_ANALYZED", timestamp: new Date(Date.now() - 82000000).toISOString(), note: "AI vision analysis flagged as P1 Critical" },
          { status: "ASSIGNED", timestamp: new Date(Date.now() - 72000000).toISOString(), note: "Assigned to Public Works Department" },
          { status: "IN_PROGRESS", timestamp: new Date(Date.now() - 36000000).toISOString(), note: "Field worker FW-104 dispatched to location" },
        ],
      };

      setComplaint(demoComplaint);
      setHistory(demoComplaint.history);
      setError("");
      return demoComplaint;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [complaintId, location.state]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (complaintId) {
        void loadComplaint();
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [complaintId, loadComplaint]);

  // Background Auto-polling when complaint resolution is UNDER_REVIEW
  useEffect(() => {
    let pollTimer = null;
    const isUnderReviewWithImage =
      complaint?.status === "UNDER_REVIEW" &&
      (complaint?.has_resolution_image || complaint?.resolution_image_url);

    if (isUnderReviewWithImage && !isPollingRef.current) {
      isPollingRef.current = true;
      pollCountRef.current = 0;

      const runPoll = async () => {
        pollCountRef.current += 1;
        const updated = await loadComplaint(true);
        const updatedStatus = String(updated?.status || "").toUpperCase();

        if (updatedStatus !== "UNDER_REVIEW" || pollCountRef.current >= 15) {
          isPollingRef.current = false;
          return;
        }

        pollTimer = window.setTimeout(runPoll, 3000);
      };

      pollTimer = window.setTimeout(runPoll, 3000);
    }

    return () => {
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [complaint?.status, complaint?.has_resolution_image, complaint?.resolution_image_url, loadComplaint]);

  const currentStatus = useMemo(() => {
    return String(complaint?.status || "SUBMITTED").toUpperCase();
  }, [complaint]);

  const currentStatusIndex = STATUS_STEPS.indexOf(currentStatus);

  const handleStatusUpdate = useCallback(async (statusToSave = selectedStatus) => {
    const token = localStorage.getItem("token");

    if (!token || !complaintId) return;

    try {
      if (statusToSave === "RESOLVED" && !resolutionImage && !complaint?.has_resolution_image) {
        setToast({
          message: "Please select a resolution proof image before saving.",
          type: "error",
        });
        return;
      }

      setIsUpdating(true);
      const formData = new FormData();
      formData.append("status", statusToSave);
      if (statusReason.trim()) formData.append("reason", statusReason.trim());
      if (statusDetails.trim()) formData.append("details", statusDetails.trim());
      if (resolutionImage) formData.append("resolution_image", resolutionImage);

      const response = await fetch(
        `${API_BASE_URL}/api/officer/complaints/${complaintId}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update complaint status.");
      }

      const returnedStatus = String(data.status || statusToSave).toUpperCase();

      setToast({
        message: statusToSave === "RESOLVED"
          ? "Resolution proof submitted successfully."
          : data.message || "Complaint status saved successfully.",
        type: "success",
      });

      setStatusReason("");
      setStatusDetails("");
      setResolutionImage(null);
      setComplaint((prev) => ({
        ...prev,
        status: returnedStatus,
        has_resolution_image: true,
      }));
      setSelectedStatus(returnedStatus);

      // Refresh data silently
      await loadComplaint(true);
    } catch (err) {
      console.error("Status update error:", err);
      setToast({
        message: err.message || "Unable to update complaint status.",
        type: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [
    complaintId,
    selectedStatus,
    statusReason,
    statusDetails,
    resolutionImage,
    complaint,
    loadComplaint,
  ]);

  const handleStatusChange = useCallback(
    (event) => {
      const nextStatus = event.target.value;
      setSelectedStatus(nextStatus);

      if (!["RESOLVED", "CLOSED"].includes(nextStatus)) {
        void handleStatusUpdate(nextStatus);
      }
    },
    [handleStatusUpdate]
  );

  const requiresCompletionDetails = ["RESOLVED", "CLOSED"].includes(selectedStatus);

  if (loading) {
    return (
      <div className="officer-detail-page">
        <div className="officer-detail-loading">
          <div className="officer-detail-spinner" />
          <h2>Loading complaint details...</h2>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="officer-detail-page">
        <div className="officer-detail-empty">
          <ShieldAlert size={42} />
          <h2>Complaint not available</h2>
          <p>{error || "This complaint could not be loaded."}</p>
          <button onClick={() => navigate("/officer/complaints")}>
            <ArrowLeft size={16} />
            Back to Complaints
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="officer-detail-page">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>
      <header className="officer-detail-header">
        <div className="officer-detail-header-left">
          <button
            className="officer-detail-back"
            onClick={() => navigate("/officer/complaints")}
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <div>
            <span className="officer-detail-label">OFFICER COMPLAINT</span>
            <h1>Complaint #{complaint.complaint_id}</h1>
          </div>
        </div>

        <button className="officer-detail-refresh" onClick={() => void loadComplaint(false)}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <div className="officer-detail-grid">
        <section className="officer-detail-card officer-detail-main">
          <div className="officer-detail-status-row">
            <span className={`officer-detail-status ${getStatusClass(currentStatus)}`}>
              {STATUS_LABELS[currentStatus] || currentStatus}
            </span>
            <span className="officer-detail-priority">
              {complaint.priority || "Medium"}
            </span>
          </div>

          <h2>{complaint.title || "Civic Complaint"}</h2>

          <div className="officer-detail-meta-grid">
            <div>
              <UserRound size={15} />
              <span>
                Citizen ID: <strong>{complaint.user_id || "Unknown"}</strong>
              </span>
            </div>
            <div>
              <Building2 size={15} />
              <span>
                Department: <strong>{complaint.department || "Not assigned"}</strong>
              </span>
            </div>
            <div>
              <MapPin size={15} />
              <span>{complaint.address || complaint.location || "Location not available"}</span>
            </div>
            <div>
              <CalendarDays size={15} />
              <span>Created: {formatDate(complaint.created_at)}</span>
            </div>
          </div>

          <div className="officer-detail-section">
            <h3>Description</h3>
            <p>{complaint.description || "No description provided."}</p>
          </div>

          <div className="officer-detail-section">
            <h3>Complaint Timeline</h3>
            <div className="officer-detail-steps">
              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= currentStatusIndex;
                return (
                  <div key={step} className={`officer-detail-step ${isActive ? "active" : ""}`}>
                    <span className="officer-detail-step-dot" />
                    <div>
                      <strong>{STATUS_LABELS[step] || step}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="officer-detail-card officer-detail-side">
          <div className="officer-detail-side-header">
            <Clock3 size={18} />
            <h3>Case Details</h3>
          </div>

          <div className="officer-detail-side-box">
            <span>SLA Remaining</span>
            <strong>
              {" "}{complaint.sla_remaining_hours === null || complaint.sla_remaining_hours === undefined
                ? "N/A"
                : `${complaint.sla_remaining_hours} hrs`}
            </strong>
          </div>

          <div className="officer-detail-side-box">
            <span>Assigned Officer</span>
            <strong>{" "}{complaint.officer_name || "Unassigned"}</strong>
          </div>

          <div className="officer-detail-side-box">
            <span>Escalation Level</span>
            <strong>{" "}{complaint.escalation_level ?? "N/A"}</strong>
          </div>

          <div className="officer-detail-side-box">
            <span>Category</span>
            <strong>{" "}{complaint.category || "General"}</strong>
          </div>

          <div className="officer-detail-side-box">
            <span>Last Updated</span>
            <strong>{" "}{formatDate(complaint.updated_at)}</strong>
          </div>

          <div className="officer-detail-update-box">
            <label htmlFor="officer-status-select">Update Status</label>
            <select
              id="officer-status-select"
              value={selectedStatus}
              onChange={handleStatusChange}
              disabled={isUpdating}
            >
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {requiresCompletionDetails && (
              <>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={selectedStatus === "RESOLVED" ? "Resolution reason (e.g. Repaired pothole with asphalt)" : "Closure reason"}
                  rows={3}
                  required
                />
                <textarea
                  value={statusDetails}
                  onChange={(e) => setStatusDetails(e.target.value)}
                  placeholder={selectedStatus === "RESOLVED" ? "Resolution details (e.g. Work crew completed surface leveling)" : "Closure details"}
                  rows={3}
                />
              </>
            )}

            {selectedStatus === "RESOLVED" && (
              <div className="officer-detail-file-container">
                {resolutionImage && (
                  <div style={{ fontSize: "12px", color: "#38bdf8", marginTop: "4px" }}>
                    Field worker proof image loaded: <strong>{resolutionImage.name}</strong>
                  </div>
                )}
                {!resolutionImage && (
                  <div style={{ fontSize: "12px", color: "#f59e0b", marginTop: "4px" }}>
                    A field worker proof image is required to resolve this complaint.
                  </div>
                )}
              </div>
            )}

            {requiresCompletionDetails && (
              <button onClick={() => void handleStatusUpdate()} disabled={isUpdating}>
                {isUpdating ? "Submitting..." : "Submit Resolution"}
              </button>
            )}
          </div>
        </aside>
      </div>

      <section className="officer-detail-card officer-detail-history">
        <div className="officer-detail-side-header">
          <CheckCircle2 size={18} />
          <h3>Status History</h3>
        </div>

        {history.length === 0 ? (
          <p className="officer-detail-empty-history">No history available yet.</p>
        ) : (
          <div className="officer-detail-history-list">
            {history.map((entry) => (
              <div key={entry.history_id || `${entry.status}-${entry.created_at}`} className="officer-detail-history-item">
                <div className="history-badge">
                  {entry.status || "UPDATED"}
                </div>
                <div className="history-copy">
                  <strong>{entry.message || entry.note || "Status updated"}</strong>
                  <span>{formatDate(entry.created_at || entry.timestamp)}</span>
                  {entry.status_image_url && (
                    <img
                      src={entry.status_image_url}
                      alt="Status proof"
                      className="officer-detail-history-image"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Visual Evidence Comparison: Before & After */}
      {(complaint.image_url || complaint.resolution_image_url) && (
        <section className="officer-detail-card officer-detail-evidence-section">
          <div className="officer-detail-side-header">
            <FileCheck2 size={18} />
            <h3>Visual Evidence (Before & After)</h3>
          </div>
          <div className="officer-detail-evidence-grid">
            {complaint.image_url && (
              <div className="evidence-box">
                <h4>Citizen Original Report (BEFORE)</h4>
                <div className="officer-detail-complaint-image-wrap">
                  <img
                    src={complaint.image_url}
                    alt={complaint.title || "Initial complaint evidence"}
                    className="officer-detail-complaint-image"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
            {complaint.resolution_image_url && (
              <div className="evidence-box">
                <h4>Officer Resolution Proof (AFTER)</h4>
                <div className="officer-detail-complaint-image-wrap">
                  <img
                    src={complaint.resolution_image_url}
                    alt="Officer Resolution Proof"
                    className="officer-detail-complaint-image"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />
    </div>
  );
};

export default OfficerComplaintDetails;
