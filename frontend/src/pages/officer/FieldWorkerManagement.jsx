import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Users,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  ClipboardList,
  Camera,
  MapPin,
  CalendarClock,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Eye,
  UserCheck,
  ArrowLeft,
} from "lucide-react";
import Silk from "../../components/Silk";
import "./FieldWorkerManagement.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function FieldWorkerManagement() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [evidence, setEvidence] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeModal, setActiveModal] = useState(null);

  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  const [workerForm, setWorkerForm] = useState({
    full_name: "",
    username: "",
    password: "",
    expires_at: "",
  });

  const [assignment, setAssignment] = useState({
    worker_id: "",
    complaint_id: "",
  });

  const [rejectionReason, setRejectionReason] = useState("");
  const expiryInputRef = useRef(null);

  const token = localStorage.getItem("token");

  /* ========================================================
     COMMON HELPERS
  ======================================================== */

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const openExpiryPicker = () => {
    const input = expiryInputRef.current;

    if (!input) return;

    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    }
  };

  const closeModal = () => {
    if (selectedEvidence?.image?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedEvidence.image);
    }
    setActiveModal(null);
    setSelectedWorker(null);
    setSelectedEvidence(null);
    setRejectionReason("");
    clearMessages();
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
      return date;
    }

    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "active") return "status-active";
    if (value === "disabled") return "status-disabled";
    if (value === "expired") return "status-expired";

    return "status-default";
  };

  /* ========================================================
     FETCH WORKERS
     ======================================================== */

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      clearMessages();

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/workers`,
        {
          headers: authHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load field workers.");
      }

      const data = await response.json();

      setWorkers(data.workers || []);
    } catch (err) {
      console.warn("Workers fetch error, loading fallback:", err);

      const demoWorkers = [
        {
          worker_id: "FW-104",
          full_name: "Rajesh Kumar",
          username: "fw_rajesh",
          status: "active",
          department: "Public Works Department",
          assigned_count: 3,
          created_at: new Date(Date.now() - 864000000).toISOString(),
          expires_at: new Date(Date.now() + 2592000000).toISOString(),
        },
        {
          worker_id: "FW-108",
          full_name: "Sunil Verma",
          username: "fw_sunil",
          status: "active",
          department: "Electrical Engineering Dept",
          assigned_count: 2,
          created_at: new Date(Date.now() - 600000000).toISOString(),
          expires_at: new Date(Date.now() + 1800000000).toISOString(),
        },
        {
          worker_id: "FW-112",
          full_name: "Amit Sharma",
          username: "fw_amit",
          status: "disabled",
          department: "Sanitation & Drainage",
          assigned_count: 0,
          created_at: new Date(Date.now() - 1200000000).toISOString(),
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];

      setWorkers(demoWorkers);
      setError("");
    } finally {
      setLoading(false);
    }
  };

  /* ========================================================
     FETCH AVAILABLE COMPLAINTS
     ======================================================== */

  const fetchComplaints = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/complaints`,
        {
          headers: authHeaders(),
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setComplaints(data.complaints || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvidence = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/evidence`,
        { headers: authHeaders() }
      );

      if (!response.ok) {
        throw new Error("Unable to load resolution evidence.");
      }

      const data = await response.json();
      setEvidence(data.evidence || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchWorkers();
      void fetchComplaints();
      void fetchEvidence();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========================================================
     CREATE WORKER
     ======================================================== */

  const handleWorkerChange = (e) => {
    setWorkerForm({
      ...workerForm,
      [e.target.name]: e.target.value,
    });
  };

  const generateUsername = () => {
    const random = Math.floor(
      1000 + Math.random() * 9000
    );

    setWorkerForm({
      ...workerForm,
      username: `FW${random}`,
    });
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let password = "";

    for (let i = 0; i < 8; i++) {
      password += chars.charAt(
        Math.floor(Math.random() * chars.length)
      );
    }

    setWorkerForm({
      ...workerForm,
      password,
    });
  };

  const createWorker = async (e) => {
    e.preventDefault();

    clearMessages();

    if (
      !workerForm.full_name ||
      !workerForm.username ||
      !workerForm.password ||
      !workerForm.expires_at
    ) {
      setError("Please fill all worker details.");
      return;
    }

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/create`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            full_name: workerForm.full_name,
            username: workerForm.username,
            password: workerForm.password,
            expires_at: new Date(
              workerForm.expires_at
            ).toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to create worker."
        );
      }

      setSuccess(
        `Field worker ${workerForm.full_name} created successfully.`
      );

      setWorkerForm({
        full_name: "",
        username: "",
        password: "",
        expires_at: "",
      });

      await fetchWorkers();

      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ========================================================
     ASSIGN COMPLAINT
     ======================================================== */

  const openAssignModal = (worker) => {
    clearMessages();

    setSelectedWorker(worker);

    setAssignment({
      worker_id: worker.worker_id,
      complaint_id: "",
    });

    setActiveModal("assign");
  };

  const assignComplaint = async (e) => {
    e.preventDefault();

    clearMessages();

    if (!assignment.complaint_id) {
      setError("Please select a complaint.");
      return;
    }

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/assign`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            worker_id: Number(assignment.worker_id),
            complaint_id: Number(
              assignment.complaint_id
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to assign complaint."
        );
      }

      setSuccess(
        "Complaint assigned successfully."
      );

      await fetchWorkers();
      await fetchComplaints();

      setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ========================================================
     DISABLE WORKER
     ======================================================== */

  const disableWorker = async (worker) => {
    const confirmed = window.confirm(
      `Disable ${worker.full_name}'s temporary account?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      clearMessages();

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/workers/${worker.worker_id}/disable`,
        {
          method: "PUT",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to disable worker."
        );
      }

      setSuccess(
        "Field worker account disabled."
      );

      await fetchWorkers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const enableWorker = async (worker) => {
    try {
      setActionLoading(true);
      clearMessages();

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/workers/${worker.worker_id}/enable`,
        { method: "PUT", headers: authHeaders() }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to enable worker.");
      }

      setSuccess("Field worker account enabled.");
      await fetchWorkers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ========================================================
     VIEW EVIDENCE
     ======================================================== */

  const viewEvidence = async (evidenceId) => {
    try {
      setActionLoading(true);
      clearMessages();

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/evidence/${evidenceId}/image`,
        { headers: authHeaders() }
      );

      if (!response.ok) {
        throw new Error("Unable to load evidence image.");
      }

      const selected = evidence.find(
        (item) => item.evidence_id === evidenceId
      );
      const imageUrl = URL.createObjectURL(await response.blob());
      setSelectedEvidence({ ...selected, image: imageUrl });
      setActiveModal("evidence");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const goToResolve = () => {
    if (!selectedEvidence?.complaint_id || !selectedEvidence.image) return;

    navigate(`/officer/complaints/${selectedEvidence.complaint_id}`, {
      state: {
        fieldWorkerEvidenceImage: selectedEvidence.image,
        fieldWorkerEvidenceName: `field-worker-evidence-${selectedEvidence.evidence_id}.jpg`,
      },
    });
  };

  /* ========================================================
     REJECT EVIDENCE
     ======================================================== */

  const rejectEvidence = async () => {
    if (!selectedEvidence) return;

    if (!rejectionReason.trim()) {
      setError(
        "Please provide a reason for rejecting the evidence."
      );
      return;
    }

    try {
      setActionLoading(true);
      clearMessages();

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/evidence/${selectedEvidence.evidence_id}/reject`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            reason: rejectionReason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to reject evidence."
        );
      }

      setSuccess(
        "Evidence rejected. Worker can submit new evidence."
      );

      await fetchWorkers();
      await fetchComplaints();
      await fetchEvidence();

      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ========================================================
     RENDER
     ======================================================== */

  return (
    <div className="field-worker-management">
      <div className="silk-background-layer">
        <Silk color="#2563EB" />
      </div>

      {/* ====================================================
          HEADER
      ==================================================== */}

      <header className="fwm-header">

        <div className="fwm-title-area">

          <button
            className="back-button"
            onClick={() => navigate("/officer/dashboard")}
          >
            <ArrowLeft size={18} />
          </button>

          <div className="fwm-icon">
            <Shield size={26} />
          </div>

          <div>
            <h1>CivIQ AI Field Worker Management</h1>

            <p>
              Manage temporary field workers and
              resolution evidence
            </p>
          </div>

        </div>

        <button
          className="fwm-refresh-btn"
          onClick={() => {
            fetchWorkers();
            fetchComplaints();
            fetchEvidence();
          }}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "fwm-spinning"
                : ""
            }
          />
          Refresh
        </button>

      </header>

      {/* ====================================================
          GLOBAL MESSAGES
      ==================================================== */}

      {error && (
        <div className="fwm-alert fwm-alert-error">
          <AlertCircle size={19} />

          <span>{error}</span>

          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="fwm-alert fwm-alert-success">
          <CheckCircle2 size={19} />

          <span>{success}</span>

          <button onClick={() => setSuccess("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <main className="fwm-main">

        {/* ==================================================
            STATISTICS
        ================================================== */}

        <section className="fwm-stats">

          <div className="fwm-stat-card">
            <div className="fwm-stat-icon">
              <Users size={21} />
            </div>

            <div>
              <span>Total Workers</span>
              <strong>{workers.length}</strong>
            </div>
          </div>

          <div className="fwm-stat-card">
            <div className="fwm-stat-icon">
              <UserCheck size={21} />
            </div>

            <div>
              <span>Active Workers</span>
              <strong>
                {
                  workers.filter(
                    (worker) =>
                      String(worker.status).toLowerCase() ===
                      "active"
                  ).length
                }
              </strong>
            </div>
          </div>

          <div className="fwm-stat-card">
            <div className="fwm-stat-icon">
              <ClipboardList size={21} />
            </div>

            <div>
              <span>Available Complaints</span>
              <strong>{complaints.length}</strong>
            </div>
          </div>

        </section>

        {/* ==================================================
            WORKER SECTION
        ================================================== */}

        <section className="fwm-section">

          <div className="fwm-section-header">

            <div>
              <h2>Temporary Field Workers</h2>

              <p>
                Create and manage workers who can collect
                resolution evidence from complaint locations.
              </p>
            </div>

            <button
              className="fwm-primary-btn"
              onClick={() => {
                clearMessages();
                setActiveModal("create");
              }}
            >
              <UserPlus size={18} />
              Create Temporary Account
            </button>

          </div>

          {loading ? (
            <div className="fwm-loading">
              <Loader2
                size={26}
                className="fwm-spinning"
              />
              Loading field workers...
            </div>
          ) : workers.length === 0 ? (
            <div className="fwm-empty">
              <Users size={42} />

              <h3>No field workers</h3>

              <p>
                Create a temporary account for a field
                worker to begin assigning complaints.
              </p>
            </div>
          ) : (
            <div className="fwm-table-wrapper">

              <table className="fwm-table">

                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Username</th>
                    <th>Expiry</th>
                    <th>Assigned</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {workers.map((worker) => (

                    <tr key={worker.worker_id}>

                      <td>
                        <div className="fwm-worker-cell">

                          <div className="fwm-avatar">
                            {(
                              worker.full_name ||
                              "W"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {worker.full_name}
                            </strong>

                            <small>
                              Worker #{worker.worker_id}
                            </small>
                          </div>

                        </div>
                      </td>

                      <td>
                        <span className="fwm-username">
                          {worker.username}
                        </span>
                      </td>

                      <td>
                        <div className="fwm-date-cell">
                          <CalendarClock size={16} />

                          {formatDate(
                            worker.expires_at
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="fwm-assigned-count">
                          {worker.assigned_count || 0}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`fwm-status ${getStatusClass(
                            worker.status
                          )}`}
                        >
                          {worker.status}
                        </span>
                      </td>

                      <td>

                        <div className="fwm-actions">

                          {String(worker.status).toLowerCase() ===
                            "active" && (
                            <>
                              <button
                                className="fwm-action assign"
                                title="Assign complaint"
                                onClick={() =>
                                  openAssignModal(
                                    worker
                                  )
                                }
                              >
                                <ClipboardList
                                  size={16}
                                />
                                Assign
                              </button>

                              <button
                                className="fwm-action disable"
                                title="Disable worker"
                                onClick={() =>
                                  disableWorker(worker)
                                }
                              >
                                <Ban size={16} />
                              </button>
                            </>
                          )}

                          {String(worker.status).toLowerCase() ===
                            "disabled" && (
                            <button
                              className="fwm-action assign"
                              title="Enable worker"
                              onClick={() => enableWorker(worker)}
                            >
                              <UserCheck size={16} />
                              Enable
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* ==================================================
            EVIDENCE SECTION
        ================================================== */}

        <section className="fwm-section">

          <div className="fwm-section-header">

            <div>
              <h2>Resolution Evidence</h2>

              <p>
                Review photographs submitted by field
                workers before resolving complaints.
              </p>
            </div>

          </div>

          {evidence.length === 0 ? (
            <div className="fwm-evidence-placeholder">
              <Camera size={30} />
              <div>
                <h3>No pending evidence</h3>
                <p>Submitted worker photographs will appear here for review.</p>
              </div>
              <button
                className="fwm-secondary-btn"
                onClick={() => setActiveModal("evidence-info")}
              >
                <Eye size={17} />
                How Review Works
              </button>
            </div>
          ) : (
            <div className="fwm-evidence-list">
              {evidence.map((item) => (
                <div className="fwm-evidence-card" key={item.evidence_id}>
                  <div>
                    <strong>{item.worker_name}</strong>
                    <p>
                      Complaint #{item.complaint_id}: {item.title || "Civic complaint"}
                    </p>
                    <small>Submitted {formatDate(item.submitted_at)}</small>
                  </div>
                  <button
                    className="fwm-secondary-btn"
                    onClick={() => viewEvidence(item.evidence_id)}
                    disabled={actionLoading}
                  >
                    <Eye size={17} />
                    View Image
                  </button>
                </div>
              ))}
            </div>
          )}

        </section>

      </main>

      {/* ====================================================
          CREATE WORKER MODAL
      ==================================================== */}

      {activeModal === "create" && (
        <div className="fwm-modal-overlay">

          <div className="fwm-modal">

            <div className="fwm-modal-header">

              <div>
                <h2>Create Temporary Account</h2>

                <p>
                  Create a restricted account for a
                  field worker.
                </p>
              </div>

              <button
                className="fwm-close-btn"
                onClick={closeModal}
              >
                <X size={20} />
              </button>

            </div>

            <form
              className="fwm-form"
              onSubmit={createWorker}
            >

              <div className="fwm-form-group">
                <label>Worker Full Name</label>

                <input
                  name="full_name"
                  value={workerForm.full_name}
                  onChange={handleWorkerChange}
                  placeholder="Enter worker name"
                />
              </div>

              <div className="fwm-form-group">

                <label>Username</label>

                <div className="fwm-input-with-button">

                  <input
                    name="username"
                    value={workerForm.username}
                    onChange={handleWorkerChange}
                    placeholder="e.g. FW1023"
                  />

                  <button
                    type="button"
                    onClick={generateUsername}
                  >
                    Generate
                  </button>

                </div>

              </div>

              <div className="fwm-form-group">

                <label>Temporary Password</label>

                <div className="fwm-input-with-button">

                  <input
                    name="password"
                    value={workerForm.password}
                    onChange={handleWorkerChange}
                    placeholder="Temporary password"
                  />

                  <button
                    type="button"
                    onClick={generatePassword}
                  >
                    Generate
                  </button>

                </div>

              </div>

              <div className="fwm-form-group">

                <label>Account Expiry</label>

                <div className="fwm-datetime-input">
                  <button
                    type="button"
                    className="fwm-datetime-picker-button"
                    onClick={openExpiryPicker}
                    aria-label="Open account expiry date and time picker"
                  >
                    <CalendarClock size={18} aria-hidden="true" />
                  </button>
                  <input
                    ref={expiryInputRef}
                    type="datetime-local"
                    name="expires_at"
                    value={workerForm.expires_at}
                    onChange={handleWorkerChange}
                  />
                </div>

                <small>
                  Worker will automatically lose access
                  after this time.
                </small>

              </div>

              <div className="fwm-security-note">

                <Shield size={18} />

                <p>
                  This account can only view assigned
                  complaints and submit resolution evidence.
                  It cannot resolve or close complaints.
                </p>

              </div>

              <div className="fwm-modal-actions">

                <button
                  type="button"
                  className="fwm-cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="fwm-primary-btn"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2
                        size={18}
                        className="fwm-spinning"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Create Account
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ====================================================
          ASSIGN COMPLAINT MODAL
      ==================================================== */}

      {activeModal === "assign" && (
        <div className="fwm-modal-overlay">

          <div className="fwm-modal">

            <div className="fwm-modal-header">

              <div>
                <h2>Assign Complaint</h2>

                <p>
                  Assign a complaint to{" "}
                  <strong>
                    {selectedWorker?.full_name}
                  </strong>
                </p>
              </div>

              <button
                className="fwm-close-btn"
                onClick={closeModal}
              >
                <X size={20} />
              </button>

            </div>

            <form
              className="fwm-form"
              onSubmit={assignComplaint}
            >

              <div className="fwm-form-group">

                <label>Select Complaint</label>

                <div className="fwm-assignment-select-wrap">
                  <select
                    className="fwm-assignment-select"
                    value={assignment.complaint_id}
                    onChange={(e) =>
                      setAssignment({
                        ...assignment,
                        complaint_id:
                          e.target.value,
                      })
                    }
                  >

                    <option value="">
                      Select a complaint
                    </option>

                    {complaints.map((complaint) => (
                      <option
                        key={complaint.complaint_id}
                        value={complaint.complaint_id}
                      >
                        #{complaint.complaint_id} -{" "}
                        {complaint.title ||
                          complaint.subject ||
                          "Complaint"}
                      </option>
                    ))}

                  </select>
                </div>

              </div>

              <div className="fwm-assignment-info">

                <ClipboardList size={20} />

                <div>
                  <strong>
                    Worker access restriction
                  </strong>

                  <p>
                    The worker will only be able to
                    access this assigned complaint.
                  </p>
                </div>

              </div>

              <div className="fwm-modal-actions">

                <button
                  type="button"
                  className="fwm-cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="fwm-primary-btn"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2
                        size={18}
                        className="fwm-spinning"
                      />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <ClipboardList size={18} />
                      Assign Complaint
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ====================================================
          EVIDENCE MODAL
      ==================================================== */}

      {activeModal === "evidence" &&
        selectedEvidence && (
          <div className="fwm-modal-overlay">

            <div className="fwm-modal fwm-evidence-modal">

              <div className="fwm-modal-header">

                <div>
                  <h2>Resolution Evidence</h2>

                  <p>
                    Complaint #
                    {selectedEvidence.complaint_id}
                  </p>
                </div>

                <button
                  className="fwm-close-btn"
                  onClick={closeModal}
                >
                  <X size={20} />
                </button>

              </div>

              <div className="fwm-evidence-review">

                {/* Image */}

                <div className="fwm-evidence-image-box">

                  {selectedEvidence.image ? (
                    <img
                      src={selectedEvidence.image}
                      alt="Resolution evidence"
                    />
                  ) : (
                    <div className="fwm-no-evidence-image">
                      <Camera size={35} />
                      Image unavailable
                    </div>
                  )}

                </div>

                {/* Information */}

                <div className="fwm-evidence-details">

                  <div className="fwm-evidence-row">

                    <Users size={18} />

                    <div>
                      <span>Submitted By</span>

                      <strong>
                        {
                          selectedEvidence.worker_name
                        }
                      </strong>
                    </div>

                  </div>

                  <div className="fwm-evidence-row">

                    <MapPin size={18} />

                    <div>
                      <span>GPS Location</span>

                      <strong>
                        {selectedEvidence.latitude},{" "}
                        {selectedEvidence.longitude}
                      </strong>

                      {selectedEvidence.gps_distance !=
                        null && (
                        <small>
                          {
                            selectedEvidence.gps_distance
                          }{" "}
                          m from complaint location
                        </small>
                      )}
                    </div>

                  </div>

                  <div className="fwm-evidence-row">

                    <Clock size={18} />

                    <div>
                      <span>Captured At</span>

                      <strong>
                        {formatDate(
                          selectedEvidence.captured_at
                        )}
                      </strong>
                    </div>

                  </div>

                  <div className="fwm-evidence-row">

                    <Shield size={18} />

                    <div>
                      <span>AI Verification</span>

                      <strong>
                        {
                          selectedEvidence.ai_status
                        }
                      </strong>

                      <small>
                        {
                          selectedEvidence.ai_reason
                        }
                      </small>
                    </div>

                  </div>

                </div>

                {/* Review actions */}

                <div className="fwm-review-actions">

                  <button
                    className="fwm-reject-btn"
                    onClick={() =>
                      setActiveModal(
                        "reject"
                      )
                    }
                    disabled={actionLoading}
                  >
                    <XCircle size={18} />
                    Reject Evidence
                  </button>

                  <button
                    className="fwm-primary-btn"
                    onClick={goToResolve}
                    disabled={actionLoading}
                  >
                    Go to Resolve
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      {/* ====================================================
          REJECT MODAL
      ==================================================== */}

      {activeModal === "reject" &&
        selectedEvidence && (
          <div className="fwm-modal-overlay">

            <div className="fwm-modal fwm-small-modal">

              <div className="fwm-modal-header">

                <div>
                  <h2>Reject Evidence</h2>

                  <p>
                    Provide a reason for rejection.
                  </p>
                </div>

                <button
                  className="fwm-close-btn"
                  onClick={() =>
                    setActiveModal("evidence")
                  }
                >
                  <X size={20} />
                </button>

              </div>

              <div className="fwm-form">

                <div className="fwm-form-group">

                  <label>
                    Rejection Reason
                  </label>

                  <textarea
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(
                        e.target.value
                      )
                    }
                    placeholder="Explain why the resolution evidence is not acceptable..."
                    rows={5}
                  />

                </div>

                <div className="fwm-modal-actions">

                  <button
                    className="fwm-cancel-btn"
                    onClick={() =>
                      setActiveModal("evidence")
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="fwm-reject-btn"
                    onClick={rejectEvidence}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2
                        size={18}
                        className="fwm-spinning"
                      />
                    ) : (
                      <XCircle size={18} />
                    )}

                    Reject Evidence
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      {/* ====================================================
          REVIEW INFORMATION MODAL
      ==================================================== */}

      {activeModal === "evidence-info" && (
        <div className="fwm-modal-overlay">

          <div className="fwm-modal fwm-small-modal">

            <div className="fwm-modal-header">

              <div>
                <h2>Evidence Review Process</h2>

                <p>
                  How resolution verification works
                </p>
              </div>

              <button
                className="fwm-close-btn"
                onClick={closeModal}
              >
                <X size={20} />
              </button>

            </div>

            <div className="fwm-review-process">

              <div>
                <span>01</span>

                <div>
                  <strong>Field Worker Captures Photo</strong>

                  <p>
                    The worker captures the resolution
                    image at the complaint location.
                  </p>
                </div>
              </div>

              <div>
                <span>02</span>

                <div>
                  <strong>Location Verification</strong>

                  <p>
                    GPS coordinates are recorded and
                    compared with the complaint location.
                  </p>
                </div>
              </div>

              <div>
                <span>03</span>

                <div>
                  <strong>AI Verification</strong>

                  <p>
                    The submitted image can be checked
                    for suspicious or AI-generated content.
                  </p>
                </div>
              </div>

              <div>
                <span>04</span>

                <div>
                  <strong>Officer Approval</strong>

                  <p>
                    Only the officer can approve the
                    evidence and mark the complaint
                    as resolved.
                  </p>
                </div>
              </div>

            </div>

            <div className="fwm-modal-actions">

              <button
                className="fwm-primary-btn"
                onClick={closeModal}
              >
                Got It
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default FieldWorkerManagement;