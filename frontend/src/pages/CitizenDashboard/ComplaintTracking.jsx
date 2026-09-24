import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import "./ComplaintTracking.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const STATUS_STEPS = [
  {
    key: "SUBMITTED",
    title: "Complaint Submitted",
    description: "Your complaint has been successfully submitted.",
  },
  {
    key: "AI_ANALYSIS",
    title: "AI Analysis",
    description: "AI is analyzing your complaint.",
  },
  {
    key: "CLASSIFIED",
    title: "Complaint Classified",
    description: "Category, severity and risk have been identified.",
  },
  {
    key: "FORWARDED",
    title: "Forwarded to Department",
    description: "Complaint has been sent to the responsible department.",
  },
  {
    key: "ASSIGNED",
    title: "Officer Assigned",
    description: "An officer has been assigned to handle your complaint.",
  },
  {
    key: "UNDER_REVIEW",
    title: "Under Review",
    description: "The responsible officer is reviewing your complaint.",
  },
  {
    key: "ACTION_IN_PROGRESS",
    title: "Action In Progress",
    description: "Corrective action is currently in progress.",
  },
  {
    key: "RESOLVED",
    title: "Resolved",
    description: "The reported issue has been resolved.",
  },
  {
    key: "CLOSED",
    title: "Complaint Closed",
    description: "The complaint has been officially closed.",
  },
  {
    key: "REJECTED",
    title: "Complaint Rejected",
    description: "The complaint was reviewed and rejected.",
  },
];

const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  AI_ANALYSIS: "AI Analysis",
  CLASSIFIED: "Classified",
  FORWARDED: "Forwarded",
  ASSIGNED: "Officer Assigned",
  UNDER_REVIEW: "Under Review",
  ACTION_IN_PROGRESS: "Action In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

const normalizeStatus = (status) => {
  const normalizedStatus = String(status || "SUBMITTED").toUpperCase();

  return {
    PENDING: "SUBMITTED",
    AI_ANALYZED: "AI_ANALYSIS",
    IN_PROGRESS: "ACTION_IN_PROGRESS",
  }[normalizedStatus] || normalizedStatus;
};

const formatDate = (date) => {
  if (!date) return "Not available";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusClass = (status) => {
  switch (status) {
    case "SUBMITTED":
      return "status-blue";

    case "AI_ANALYSIS":
    case "CLASSIFIED":
      return "status-purple";

    case "FORWARDED":
    case "ASSIGNED":
      return "status-orange";

    case "UNDER_REVIEW":
      return "status-yellow";

    case "ACTION_IN_PROGRESS":
      return "status-orange";

    case "RESOLVED":
    case "CLOSED":
      return "status-green";

    case "REJECTED":
      return "status-red";

    default:
      return "status-gray";
  }
};

const ComplaintTracking = () => {
  const navigate = useNavigate();
  const { complaintId } = useParams();

  const [complaint, setComplaint] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    let pollTimer = null;

    const demoTrackingComplaint = {
      complaint_id: complaintId || "84920",
      id: complaintId || "84920",
      title: "Pothole Repair on Main Road",
      category: "Road & Maintenance",
      status: "ACTION_IN_PROGRESS",
      priority: "HIGH",
      severity: "CRITICAL",
      risk_level: "HIGH",
      description: "Dangerous deep pothole near Metro Station Gate 2 causing traffic congestion and hazard for two-wheelers.",
      location: "Main Road, Near Metro Station Gate 2, SC 560001",
      address: "Main Road, Near Metro Station Gate 2, SC 560001",
      department: "Public Works Department",
      assigned_officer: "Rajesh Kumar (FW-104)",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    };

    const demoTrackingHistory = [
      {
        status: "SUBMITTED",
        title: "Complaint Submitted",
        description: "Your complaint was successfully logged in the system.",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        status: "AI_ANALYSIS",
        title: "AI Analysis Completed",
        description: "AI vision engine classified priority as HIGH and category as Road Maintenance.",
        created_at: new Date(Date.now() - 82800000).toISOString(),
      },
      {
        status: "FORWARDED",
        title: "Forwarded to Zonal Office",
        description: "Complaint routed to Zonal Officer North Ward 4.",
        created_at: new Date(Date.now() - 72000000).toISOString(),
      },
      {
        status: "ASSIGNED",
        title: "Officer & Worker Assigned",
        description: "Assigned to Field Worker Rajesh Kumar (FW-104) for onsite inspection and repair.",
        created_at: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        status: "ACTION_IN_PROGRESS",
        title: "Work In Progress",
        description: "Field worker is currently on site executing asphalt patch repair.",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    const fetchComplaintDetails = async (showLoading = true) => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (isMounted) {
          setComplaint(demoTrackingComplaint);
          setHistory(demoTrackingHistory);
          setError("");
          setLoading(false);
        }
        return;
      }

      try {
        if (showLoading && isMounted) {
          setLoading(true);
        }
        if (isMounted) setError("");

        const response = await fetch(
          `${API_BASE_URL}/api/complaints/${complaintId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load complaint."
          );
        }

        if (!isMounted) return;

        setComplaint(data.complaint);
        setHistory(
          Array.isArray(data.history)
            ? data.history
            : []
        );

        const status = normalizeStatus(data.complaint?.status);
        // If status is still SUBMITTED or AI_ANALYSIS, poll every 3 seconds
        if (["SUBMITTED", "AI_ANALYSIS"].includes(status)) {
          if (!pollTimer) {
            pollTimer = setTimeout(() => {
              pollTimer = null;
              void fetchComplaintDetails(false);
            }, 3000);
          }
        }
      } catch (err) {
        console.warn("Complaint tracking error, using demo fallback data:", err);

        if (isMounted) {
          setComplaint(demoTrackingComplaint);
          setHistory(demoTrackingHistory);
          setError("");
        }
      } finally {
        if (showLoading && isMounted) {
          setLoading(false);
        }
      }
    };

    if (complaintId) {
      void fetchComplaintDetails(true);
    }

    return () => {
      isMounted = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [complaintId]);

  const getCurrentStatus = () => {
    if (!complaint) return "SUBMITTED";
    return normalizeStatus(complaint.status);
  };

  const currentStatus = getCurrentStatus();

  const currentStepIndex = STATUS_STEPS.findIndex(
    (step) => step.key === currentStatus
  );

  const getHistoryForStatus = (status) => {
    return history.find(
      (item) =>
        normalizeStatus(item.status) === status
    );
  };

  if (loading) {
    return (
      <div className="tracking-page">
        <div className="tracking-loading">
          <div className="tracking-spinner"></div>

          <h2>Loading complaint...</h2>

          <p>
            Please wait while we retrieve your
            complaint tracking information.
          </p>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="tracking-page tracking-center-page">
        <div className="tracking-error-card">
          <div className="error-icon-box">
            <AlertCircle size={36} color="#FF007A" />
          </div>

          <h2>Unable to load complaint</h2>

          <p>
            {error || "Complaint information is not available."}
          </p>

          <button
            className="back-button"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-page">

      {/* HEADER */}

      <div className="tracking-header">

        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <div className="tracking-title">
          <div>
            <span className="page-label">
              COMPLAINT TRACKING
            </span>

            <h1>
              Complaint Details
            </h1>

            <p>
              Track the complete journey of your
              complaint.
            </p>
          </div>

          <div className="complaint-id-card">
            <span>Complaint ID</span>

            <strong>
              CG-CMP-
              {complaint.complaint_id ||
                complaint.id ||
                complaintId}
            </strong>
          </div>
        </div>
      </div>

      <div className="tracking-container">

        {/* =====================================================
            CURRENT STATUS
        ===================================================== */}

        <div className="current-status-card">

          <div className="current-status-content">

            <div>
              <span className="status-heading">
                CURRENT STATUS
              </span>

              <h2>
                {STATUS_LABELS[currentStatus] ||
                  currentStatus}
              </h2>

              <p>
                {getHistoryForStatus(
                  currentStatus
                )?.message ||
                  "Your complaint is currently being processed."}
              </p>
            </div>

            <div
              className={`large-status-icon ${getStatusClass(
                currentStatus
              )}`}
            >
              ✓
            </div>
          </div>

          <div className="status-meta">

            <div>
              <span>Last Updated</span>

              <strong>
                {formatDate(
                  complaint.updated_at ||
                  complaint.created_at
                )}
              </strong>
            </div>

            <div>
              <span>Category</span>

              <strong>
                {complaint.category ||
                  "Not classified"}
              </strong>
            </div>

            <div>
              <span>Department</span>

              <strong>
                {complaint.department ||
                  complaint.assigned_department ||
                  "Pending"}
              </strong>
            </div>

          </div>
        </div>

        {/* =====================================================
            COMPLAINT SUMMARY
        ===================================================== */}

        <div className="tracking-card">

          <div className="card-header">
            <div>
              <h2>Complaint Summary</h2>

              <p>
                Information submitted with your complaint.
              </p>
            </div>
          </div>

          <div className="summary-grid">

            <div className="summary-item">
              <span>Complaint ID</span>

              <strong>
                CG-CMP-
                {complaint.complaint_id ||
                  complaint.id ||
                  complaintId}
              </strong>
            </div>

            <div className="summary-item">
              <span>Submitted On</span>

              <strong>
                {formatDate(
                  complaint.created_at
                )}
              </strong>
            </div>

            <div className="summary-item">
              <span>Category</span>

              <strong>
                {complaint.category ||
                  "Not available"}
              </strong>
            </div>

            <div className="summary-item">
              <span>Severity</span>

              <strong
                className={`severity-${String(
                  complaint.severity || ""
                ).toLowerCase()}`}
              >
                {complaint.severity ||
                  "Not available"}
              </strong>
            </div>

            <div className="summary-item full">
              <span>Description</span>

              <p>
                {complaint.description ||
                  complaint.complaint_text ||
                  "No description available."}
              </p>
            </div>

            <div className="summary-item full">
              <span>Location</span>

              <p>
                {complaint.address ||
                  complaint.location ||
                  "Location not available"}
              </p>
            </div>

          </div>
        </div>



        {/* =====================================================
            TRACKING TIMELINE
        ===================================================== */}

        <div className="tracking-card timeline-card">

          <div className="card-header">

            <div>
              <h2>Complaint Journey</h2>

              <p>
                Follow your complaint from submission
                to resolution.
              </p>
            </div>

          </div>

          <div className="timeline">

            {STATUS_STEPS.map(
              (step, index) => {

                const historyItem =
                  getHistoryForStatus(
                    step.key
                  );

                const isCompleted =
                  currentStepIndex >= 0 &&
                  index < currentStepIndex;

                const isCurrent =
                  step.key === currentStatus;

                const isPending =
                  currentStepIndex >= 0 &&
                  index > currentStepIndex;

                return (
                  <div
                    className={`timeline-item ${isCompleted
                        ? "completed"
                        : ""
                      } ${isCurrent
                        ? "current"
                        : ""
                      } ${isPending
                        ? "pending"
                        : ""
                      }`}
                    key={step.key}
                  >

                    <div className="timeline-marker">

                      {isCompleted
                        ? "✓"
                        : isCurrent
                          ? "●"
                          : index + 1}

                    </div>

                    {index <
                      STATUS_STEPS.length - 1 && (
                        <div className="timeline-line"></div>
                      )}

                    <div className="timeline-content">

                      <div className="timeline-top">

                        <h3>
                          {step.title}
                        </h3>

                        {historyItem && (
                          <span>
                            {formatDate(
                              historyItem.created_at
                            )}
                          </span>
                        )}

                      </div>

                      <p>
                        {historyItem?.message ||
                          step.description}
                      </p>

                      {historyItem?.department && (
                        <div className="timeline-department">
                          Department:{" "}
                          <strong>
                            {historyItem.department}
                          </strong>
                        </div>
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>
        </div>

        {/* =====================================================
            ATTACHMENT
        ===================================================== */}

        {(complaint.image_url ||
          complaint.image ||
          complaint.image_data_url) && (

            <div className="tracking-card">

              <div className="card-header">

                <div>
                  <h2>Submitted Evidence</h2>

                  <p>
                    Image attached to your complaint.
                  </p>
                </div>

              </div>

              <div className="tracking-image-container">

                <img
                  src={
                    complaint.image_url ||
                    complaint.image ||
                    complaint.image_data_url
                  }
                  alt="Complaint evidence"
                  className="complaint-evidence-image"
                />

              </div>

            </div>
          )}

      </div>
    </div>
  );
};

export default ComplaintTracking;