import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MyComplaints.css";

const API_BASE_URL = "http://localhost:5000";

const MyComplaints = () => {
  const navigate = useNavigate();

  const [filter, setFilter] = useState("ALL");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // FETCH COMPLAINTS AND IMAGES
  // =====================================================

  useEffect(() => {
    let isMounted = true;
    let pollTimer = null;

    const fetchComplaints = async (showLoading = true) => {
      if (showLoading && isMounted) {
        setLoading(true);
      }
      if (isMounted) setError("");

      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Please login to view your complaints.");
        }

        const response = await fetch(
          `${API_BASE_URL}/api/my-complaints`,
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
            data?.message ||
              `Failed to load complaints (${response.status})`
          );
        }

        if (!isMounted) return;

        const list = data?.complaints || [];
        setComplaints(list);

        const hasPending = list.some((c) =>
          ["SUBMITTED", "AI_ANALYSIS"].includes(
            (c.status || "").toUpperCase()
          )
        );

        if (hasPending && !pollTimer) {
          pollTimer = setTimeout(() => {
            pollTimer = null;
            if (isMounted) {
              void fetchComplaints(false);
            }
          }, 3500);
        }
      } catch (err) {
        console.error("Fetch complaints error:", err);

        if (isMounted) {
          setError(
            err.message || "Unable to load your complaints."
          );
        }
      } finally {
        if (isMounted && showLoading) {
          setLoading(false);
        }
      }
    };

    fetchComplaints(true);

    return () => {
      isMounted = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, []);

  // =====================================================
  // FILTER COMPLAINTS
  // =====================================================

  const filteredComplaints =
    filter === "ALL"
      ? complaints
      : complaints.filter(
          (complaint) => complaint.status === filter
        );

  // =====================================================
  // STATUS COUNT
  // =====================================================

  const getStatusCount = (status) => {
    return complaints.filter(
      (complaint) => complaint.status === status
    ).length;
  };

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {
    if (!date) {
      return "Date unavailable";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // =====================================================
  // STATUS LABEL
  // =====================================================

  const getStatusLabel = (status) => {
    if (!status) {
      return "Unknown";
    }

    const labels = {
      SUBMITTED: "Submitted",
      AI_ANALYZED: "AI Analyzed",
      UNDER_REVIEW: "Under Review",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In Progress",
      RESOLVED: "Resolved",
      REJECTED: "Rejected",
      CLOSED: "Closed",
    };

    return labels[status] || status;
  };

  // =====================================================
  // NAVIGATE TO COMPLAINT
  // =====================================================

  const handleComplaintClick = (complaintId) => {
    navigate(`/complaints/${complaintId}`);
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="my-complaints-page">
        <div className="complaints-loading">
          <div className="loading-spinner"></div>

          <h2>Loading your complaints...</h2>

          <p>
            Please wait while we retrieve your complaint records.
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="my-complaints-page">

      {/* ================= HEADER ================= */}

      <header className="my-complaints-header">

        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          ←
        </button>

        <div className="header-content">
          <h1>My Complaints</h1>

          <p>
            View and track your submitted civic complaints
          </p>
        </div>

        <button
          className="raise-button"
          onClick={() => navigate("/raise-complaint")}
        >
          + Raise Complaint
        </button>

      </header>


      {/* ================= ERROR ================= */}

      {error && (
        <div className="complaints-error">

          <span>!</span>

          <div>
            <strong>Unable to load complaints</strong>
            <p>{error}</p>
          </div>

          <button
            onClick={() => window.location.reload()}
          >
            Retry
          </button>

        </div>
      )}


      {/* ================= FILTER ================= */}

      {!error && (
        <div className="complaint-filters">

          <button
            className={
              filter === "ALL"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("ALL")}
          >
            All
            <span>{complaints.length}</span>
          </button>


          <button
            className={
              filter === "SUBMITTED"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("SUBMITTED")}
          >
            Submitted
            <span>
              {getStatusCount("SUBMITTED")}
            </span>
          </button>


          <button
            className={
              filter === "REJECTED"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("REJECTED")}
          >
            Rejected
            <span>
              {getStatusCount("REJECTED")}
            </span>
          </button>


          <button
            className={
              filter === "UNDER_REVIEW"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("UNDER_REVIEW")}
          >
            Under Review
            <span>
              {getStatusCount("UNDER_REVIEW")}
            </span>
          </button>


          <button
            className={
              filter === "ASSIGNED"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("ASSIGNED")}
          >
            Assigned
            <span>
              {getStatusCount("ASSIGNED")}
            </span>
          </button>


          <button
            className={
              filter === "IN_PROGRESS"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("IN_PROGRESS")}
          >
            In Progress
            <span>
              {getStatusCount("IN_PROGRESS")}
            </span>
          </button>


          <button
            className={
              filter === "RESOLVED"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("RESOLVED")}
          >
            Resolved
            <span>
              {getStatusCount("RESOLVED")}
            </span>
          </button>

        </div>
      )}


      {/* ================= COMPLAINT LIST ================= */}

      {!error && (
        <main className="complaints-container">

          {filteredComplaints.length > 0 ? (

            filteredComplaints.map((complaint) => {

              const imageUrl = complaint.image_data_url || complaint.image_url || null;

              return (
                <div
                  className="complaint-card"
                  key={complaint.complaint_id}
                  onClick={() =>
                    handleComplaintClick(
                      complaint.complaint_id
                    )
                  }
                >

                  {/* ================= IMAGE ================= */}

                  <div className="complaint-image-container">

                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={
                          complaint.title ||
                          "Complaint"
                        }
                        className="complaint-image"
                        onError={() => {
                          console.error(
                            `Browser could not display image for complaint ${complaint.complaint_id}`
                          );
                        }}
                      />
                    ) : (
                      <div className="no-image">
                        <span>📷</span>
                        <span>No image</span>
                      </div>
                    )}

                  </div>


                  {/* ================= CONTENT ================= */}

                  <div className="complaint-content">

                    {/* ================= COMPLAINT ID ================= */}

                    <div className="complaint-field">
                      <strong>Complaint ID:</strong>
                      <span>#{complaint.complaint_id}</span>
                    </div>

                    {/* ================= TITLE ================= */}

                    <div className="complaint-field">
                      <strong>Title:</strong>
                      <span>
                        {complaint.title || "Not provided"}
                      </span>
                    </div>

                    {/* ================= LOCATION & DATE ================= */}

                    <div className="complaint-field">
                      <strong>Location:</strong>
                      <span>
                        {complaint.address ||
                          "Location unavailable"}
                      </span>
                    </div>

                    <div className="complaint-field">
                      <strong>Date:</strong>
                      <span>
                        📅{" "}
                        {formatDate(
                          complaint.created_at
                        )}
                      </span>
                    </div>

                    {/* ================= DESCRIPTION ================= */}

                    {complaint.description && (
                      <div className="complaint-field">
                        <strong>Description:</strong>
                        <p className="complaint-description">
                          {complaint.description}
                        </p>
                      </div>
                    )}

                    {/* ================= STATUS ================= */}

                    <div className="complaint-field">
                      <strong>Status:</strong>
                      <span
                        className={
                          `complaint-status ${
                            (
                              complaint.status ||
                              "UNKNOWN"
                            )
                              .toLowerCase()
                              .replace(/_/g, "-")
                          }`
                        }
                      >
                        {getStatusLabel(
                          complaint.status
                        )}
                      </span>
                    </div>

                    {/* ================= FOOTER ================= */}

                    <div className="complaint-footer">

                      <span className="view-text">
                        View Complaint & Track Status
                      </span>

                      <span className="arrow">
                        →
                      </span>

                    </div>

                  </div>

                </div>
              );
            })

          ) : (

            <div className="empty-state">

              <div className="empty-icon">
                📋
              </div>

              <h2>
                {filter === "ALL"
                  ? "No complaints yet"
                  : `No ${getStatusLabel(
                      filter
                    )} complaints`}
              </h2>

              <p>
                {filter === "ALL"
                  ? "You haven't submitted any civic complaints yet."
                  : "You don't have any complaints with this status."}
              </p>

              <button
                onClick={() =>
                  navigate("/raise-complaint")
                }
              >
                + Raise Complaint
              </button>

            </div>

          )}

        </main>
      )}

    </div>
  );
};

export default MyComplaints;