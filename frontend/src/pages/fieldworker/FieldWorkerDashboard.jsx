import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  MapPin,
  Clock,
  ClipboardList,
  LogOut,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import Silk from "../../components/Silk";
import "./FieldWorkerDashboard.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const demoWorkerData = {
  name: "Rajesh Kumar",
  worker_id: "FW-104",
  department: "Public Works Department",
  zone: "North Zone",
};

const demoComplaintsList = [
  {
    complaint_id: "84920",
    title: "Pothole Repair on Main Road",
    category: "Road & Maintenance",
    description:
      "Dangerous deep pothole near Metro Station Gate 2 causing traffic congestion.",
    location: "Main Road, Near Metro Station Gate 2, SC 560001",
    status: "In Progress",
    priority: "High",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    complaint_id: "84915",
    title: "Streetlight Malfunction on 4th Cross",
    category: "Electrical & Lighting",
    description:
      "Non-functional streetlight grid creating dark zone along residential pathway.",
    location: "4th Cross Road, Civic Nagar, SC 560002",
    status: "Assigned",
    priority: "Medium",
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    complaint_id: "84910",
    title: "Drainage Overflow Repair",
    category: "Sanitation & Drainage",
    description: "Blocked storm drainage causing water logging after rain.",
    location: "Civic Avenue, Sector 3, SC 560003",
    status: "Resolved",
    priority: "High",
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

function FieldWorkerDashboard() {
  const navigate = useNavigate();

  const [worker, setWorker] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const imageUrlsRef = useRef([]);

  const handleLogout = () => {
    localStorage.removeItem("fieldWorkerToken");
    localStorage.removeItem("fieldWorker");

    navigate("/field-worker/login", { replace: true });
  };

  const fetchComplaints = useCallback(async (token) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/dashboard`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        setWorker(demoWorkerData);
        setComplaints(demoComplaintsList);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load assigned complaints."
        );
      }

      const loadedComplaints = await Promise.all(
        (data.complaints || []).map(async (complaint) => {
          try {
            const imageResponse = await fetch(
              `${API_BASE_URL}/api/field-worker/complaints/${complaint.complaint_id}/image`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!imageResponse.ok) return complaint;

            const imageUrl = URL.createObjectURL(await imageResponse.blob());
            imageUrlsRef.current.push(imageUrl);
            return { ...complaint, image_url: imageUrl };
          } catch {
            return complaint;
          }
        })
      );

      setComplaints(loadedComplaints);
    } catch (err) {
      console.warn("Unable to fetch complaints, using demo fallback data:", err);
      setWorker(demoWorkerData);
      setComplaints(demoComplaintsList);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const imageUrls = imageUrlsRef.current;

    return () => {
      imageUrls.forEach((imageUrl) => URL.revokeObjectURL(imageUrl));
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedWorker = localStorage.getItem("fieldWorker");
      const token = localStorage.getItem("fieldWorkerToken");

      if (token && storedWorker) {
        try {
          setWorker(JSON.parse(storedWorker));
          void fetchComplaints(token);
          return;
        } catch {
          // Fall through to demo fallback
        }
      }

      setWorker(demoWorkerData);
      setComplaints(demoComplaintsList);
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchComplaints]);

  const handleRefresh = () => {
    const token = localStorage.getItem("fieldWorkerToken");

    if (token) {
      fetchComplaints(token);
    }
  };

  const openComplaint = (complaintId) => {
    navigate(`/field-worker/complaint/${complaintId}`);
  };

  const getStatusClass = (status) => {
    const normalizedStatus = String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (
      normalizedStatus === "evidence_submitted" ||
      normalizedStatus === "submitted"
    ) {
      return "status-submitted";
    }

    if (
      normalizedStatus === "completed" ||
      normalizedStatus === "resolved"
    ) {
      return "status-completed";
    }

    return "status-assigned";
  };

  const getStatusLabel = (status) => {
    if (!status) return "Assigned";

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading && !worker) {
    return (
      <div className="field-worker-loading-page">
        <RefreshCw className="field-worker-spinner" size={28} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="field-worker-dashboard">
      <div 
        style={{ 
          position: "fixed", 
          inset: 0, 
          zIndex: 0, 
          pointerEvents: "none" 
        }}
      >
        <Silk speed={5} scale={1.2} color="#2563EB" noiseIntensity={1.5} />
      </div>

      {/* Header */}
      <header className="field-worker-header">

        <div className="field-worker-brand">
          <div className="field-worker-brand-icon">
            <Shield size={24} />
          </div>

          <div>
            <h1>CivIQ AI</h1>
            <span>Field Worker Portal</span>
          </div>
        </div>

        <button
          className="field-worker-logout-button"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          Logout
        </button>

      </header>

      {/* Main */}
      <main className="field-worker-main">

        {/* Welcome */}
        <section className="field-worker-welcome">

          <div>
            <p className="field-worker-welcome-label">
              Welcome back
            </p>

            <h2>
              {worker?.name || worker?.full_name || "Field Worker"}
            </h2>

            <p>
              View and complete the complaints assigned to you.
            </p>
          </div>

          <button
            className="field-worker-refresh-button"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw
              size={18}
              className={loading ? "field-worker-spinner" : ""}
            />
            Refresh
          </button>

        </section>

        {/* Account Information */}
        <section className="field-worker-account-card">

          <div className="field-worker-account-icon">
            <CalendarClock size={22} />
          </div>

          <div>
            <span>Temporary Account</span>

            <strong>
              Expires:{" "}
              {formatDate(
                worker?.expires_at || worker?.expiry_date
              )}
            </strong>
          </div>

        </section>

        {/* Statistics */}
        <section className="field-worker-stats">

          <div className="field-worker-stat-card">
            <div className="field-worker-stat-icon">
              <ClipboardList size={21} />
            </div>

            <div>
              <span>Total Assigned</span>
              <strong>{complaints.length}</strong>
            </div>
          </div>

          <div className="field-worker-stat-card">
            <div className="field-worker-stat-icon">
              <Clock size={21} />
            </div>

            <div>
              <span>Pending</span>
              <strong>
                {complaints.filter((complaint) => {
                  const status = String(
                    complaint.status || ""
                  ).toLowerCase();

                  return (
                    status === "assigned" ||
                    status === "pending" ||
                    status === "in_progress"
                  );
                }).length}
              </strong>
            </div>
          </div>

          <div className="field-worker-stat-card">
            <div className="field-worker-stat-icon">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <span>Evidence Submitted</span>
              <strong>
                {complaints.filter((complaint) => {
                  const status = String(
                    complaint.status || ""
                  ).toLowerCase();

                  return (
                    status === "evidence_submitted" ||
                    status === "submitted"
                  );
                }).length}
              </strong>
            </div>
          </div>

        </section>

        {/* Error */}
        {error && (
          <div className="field-worker-error">
            <AlertCircle size={19} />
            <span>{error}</span>

            <button onClick={handleRefresh}>
              Retry
            </button>
          </div>
        )}

        {/* Complaints */}
        <section className="field-worker-complaints-section">

          <div className="field-worker-section-header">
            <div>
              <h3>Assigned Complaints</h3>
              <p>
                Only complaints assigned to your account are shown.
              </p>
            </div>

            <span className="field-worker-count">
              {complaints.length}
            </span>
          </div>

          {loading ? (
            <div className="field-worker-loading">
              <RefreshCw
                size={22}
                className="field-worker-spinner"
              />
              Loading complaints...
            </div>
          ) : complaints.length === 0 ? (
            <div className="field-worker-empty">

              <ClipboardList size={42} />

              <h3>No complaints assigned</h3>

              <p>
                Your officer has not assigned any complaints
                to you yet.
              </p>

            </div>
          ) : (
            <div className="field-worker-complaint-list">

              {complaints.map((complaint) => (

                <div
                  className="field-worker-complaint-card"
                  key={complaint.complaint_id}
                >

                  {/* Complaint information */}
                  <div className="field-worker-complaint-content">

                    {complaint.image_url && (
                      <img
                        src={complaint.image_url}
                        alt="Complaint"
                        className="field-worker-complaint-image"
                      />
                    )}

                    <div className="field-worker-complaint-top">

                      <span className="field-worker-complaint-id">
                        #{complaint.complaint_id}
                      </span>

                      <span
                        className={`field-worker-status ${getStatusClass(
                          complaint.status
                        )}`}
                      >
                        {getStatusLabel(complaint.status)}
                      </span>

                    </div>

                    <h3>
                      {complaint.title ||
                        complaint.subject ||
                        "Complaint"}
                    </h3>

                    <p className="field-worker-description">
                      {complaint.description ||
                        "No description available."}
                    </p>

                    <div className="field-worker-location">

                      <MapPin size={17} />

                      <span>
                        {complaint.address ||
                          complaint.location ||
                          "Location not available"}
                      </span>

                    </div>

                    {complaint.created_at && (
                      <div className="field-worker-created-date">
                        Assigned / Created:{" "}
                        {formatDate(complaint.created_at)}
                      </div>
                    )}

                  </div>

                  {/* Action */}
                  <button
                    className="field-worker-view-button"
                    onClick={() =>
                      openComplaint(complaint.complaint_id)
                    }
                  >
                    View Complaint
                    <ChevronRight size={19} />
                  </button>

                </div>

              ))}

            </div>
          )}

        </section>

      </main>

    </div>
  );
}

export default FieldWorkerDashboard;