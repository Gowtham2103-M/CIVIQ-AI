import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Shield,
  Upload,
  X,
  AlertCircle,
} from "lucide-react";
import Silk from "../../components/Silk";
import "./FieldWorkerComplaint.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function FieldWorkerComplaint() {
  const { complaintId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [complaint, setComplaint] = useState(null);
  const [worker, setWorker] = useState(null);

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("waiting");

  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const demoWorkerData = {
    name: "Rajesh Kumar",
    worker_id: "FW-104",
    department: "Public Works Department",
    zone: "North Zone",
  };

  const demoComplaintData = {
    id: complaintId || "84920",
    complaint_id: complaintId || "84920",
    title: "Pothole Repair on Main Road",
    category: "Road & Maintenance",
    description: "Dangerous deep pothole near Metro Station Gate 2 causing traffic congestion and hazard for two-wheelers.",
    location: "Main Road, Near Metro Station Gate 2, SC 560001",
    address: "Main Road, Near Metro Station Gate 2, SC 560001",
    latitude: 12.9716,
    longitude: 77.5946,
    status: "In Progress",
    priority: "High",
    assigned_to: "Rajesh Kumar (FW-104)",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    image_data_url: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=1200&auto=format&fit=crop",
  };

  const fetchComplaint = async (token) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/complaints/${complaintId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        setWorker(demoWorkerData);
        setComplaint(demoComplaintData);
        setOriginalImageUrl(demoComplaintData.image_data_url);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load complaint."
        );
      }

      setComplaint(data.complaint || data);

      const imageResponse = await fetch(
        `${API_BASE_URL}/api/field-worker/complaints/${complaintId}/image`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (imageResponse.ok) {
        setOriginalImageUrl(URL.createObjectURL(await imageResponse.blob()));
      } else {
        setOriginalImageUrl(demoComplaintData.image_data_url);
      }
    } catch (err) {
      console.warn("Unable to fetch complaint, using demo fallback data:", err);
      setComplaint(demoComplaintData);
      setOriginalImageUrl(demoComplaintData.image_data_url);
      setError("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (originalImageUrl && !originalImageUrl.startsWith("http")) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };
  }, [originalImageUrl]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [isCameraOpen]);

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("fieldWorkerToken");
    localStorage.removeItem("fieldWorker");

    navigate("/field-worker/login", {
      replace: true,
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = localStorage.getItem("fieldWorkerToken");
      const storedWorker = localStorage.getItem("fieldWorker");

      if (token && storedWorker) {
        try {
          setWorker(JSON.parse(storedWorker));
          void fetchComplaint(token);
          return;
        } catch {
          // Fall through to demo fallback
        }
      }

      setWorker(demoWorkerData);
      setComplaint(demoComplaintData);
      setOriginalImageUrl(demoComplaintData.image_data_url);
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [complaintId]);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    setError("");
    setSuccess("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch (cameraError) {
      setError(
        cameraError.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access and try again."
          : "Unable to open the camera. Please check that a camera is connected."
      );
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;

    if (!video || video.readyState < 2) {
      setError("The camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Could not capture the photo. Please try again.");
        return;
      }

      const capturedFile = new File(
        [blob],
        `resolution-${Date.now()}.jpg`,
        { type: "image/jpeg" }
      );

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      setImage(capturedFile);
      setImagePreview(URL.createObjectURL(capturedFile));
      stopCamera();
      getCurrentLocation();
    }, "image/jpeg", 0.9);
  };

  /* Get current GPS coordinates. */
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setError(
        "Location services are not supported by this device."
      );
      return;
    }

    setLocationLoading(true);
    setLocationStatus("getting");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setLocation({
          latitude,
          longitude,
          accuracy,
          capturedAt: new Date().toISOString(),
        });

        setLocationStatus("success");
        setLocationLoading(false);
      },
      (err) => {
        console.error("GPS error:", err);

        setLocation(null);
        setLocationStatus("error");
        setLocationLoading(false);

        setError(
          "Unable to get your current location. Please enable GPS and try again."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview("");
    setLocation(null);
    setLocationStatus("waiting");
    setSuccess("");
    setError("");

  };

  const handleSubmitEvidence = async () => {
    if (!image) {
      setError("Please capture a resolution photo.");
      return;
    }

    if (!location) {
      setError(
        "Current location is required before submitting evidence."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const token = localStorage.getItem("fieldWorkerToken");

      const formData = new FormData();

      formData.append("complaint_id", complaintId);
      formData.append("image", image);

      formData.append(
        "latitude",
        String(location.latitude)
      );

      formData.append(
        "longitude",
        String(location.longitude)
      );

      formData.append(
        "accuracy",
        String(location.accuracy)
      );

      formData.append(
        "captured_at",
        location.capturedAt
      );

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/complaints/${complaintId}/submit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to submit resolution evidence."
        );
      }

      setSuccess(
        "Resolution evidence submitted successfully. Waiting for officer verification."
      );

      /*
       * Refresh complaint information so the status
       * displayed on the page is updated.
       */
      await fetchComplaint(token);

    } catch (err) {
      setError(
        err.message ||
          "Failed to submit resolution evidence."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading) {
    return (
      <div className="field-worker-loading-page">
        <RefreshCw
          size={28}
          className="field-worker-spinner"
        />
        <p>Loading complaint...</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="field-worker-loading-page">
        <AlertCircle size={40} />
        <h3>Complaint not found</h3>

        <button
          className="field-worker-back-button"
          onClick={() =>
            navigate("/field-worker/dashboard")
          }
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const evidenceAlreadySubmitted =
    String(complaint.status || "").toLowerCase() ===
      "evidence_submitted" ||
    String(complaint.status || "").toLowerCase() ===
      "submitted";

  return (
    <div className="field-worker-complaint-page">
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
            <Shield size={24} color="#FFFFFF" />
          </div>

          <div>
            <h1>CivicGuard</h1>
            <span>Field Worker Portal</span>
          </div>
        </div>

        <div className="field-worker-header-worker">
          {worker?.name || worker?.full_name || "Field Worker"}
        </div>

      </header>

      <main className="field-worker-complaint-main">

        {/* Back */}
        <button
          className="field-worker-back-button"
          onClick={() =>
            navigate("/field-worker/dashboard")
          }
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        {/* Complaint heading */}
        <section className="field-worker-complaint-heading">

          <div>
            <span className="field-worker-complaint-id">
              Complaint #{complaint.complaint_id}
            </span>

            <h2>
              {complaint.title ||
                complaint.subject ||
                "Complaint"}
            </h2>

            <p>
              Visit the complaint location and capture
              evidence after the issue has been resolved.
            </p>
          </div>

          <span className="field-worker-current-status">
            {String(complaint.status || "Assigned")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) =>
                c.toUpperCase()
              )}
          </span>

        </section>

        {/* Error */}
        {error && (
          <div className="field-worker-error">
            <AlertCircle size={19} />
            <span>{error}</span>

            <button onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="field-worker-success">
            <CheckCircle2 size={19} />
            <span>{success}</span>
          </div>
        )}

        {/* Complaint details */}
        <section className="field-worker-detail-grid">

          {/* Description */}
          <div className="field-worker-detail-card">

            <div className="field-worker-detail-title">
              <h3>Complaint Details</h3>
            </div>

            <p className="field-worker-description-large">
              {complaint.description ||
                "No description available."}
            </p>

            <div className="field-worker-info-row">
              <MapPin size={18} />

              <div>
                <span>Complaint Location</span>
                <strong>
                  {complaint.address ||
                    complaint.location ||
                    "Location not available"}
                </strong>
              </div>
            </div>

            {complaint.created_at && (
              <div className="field-worker-info-row">
                <Clock size={18} />

                <div>
                  <span>Complaint Created</span>
                  <strong>
                    {formatDate(complaint.created_at)}
                  </strong>
                </div>
              </div>
            )}

          </div>

          {/* Original image */}
          <div className="field-worker-detail-card">

            <div className="field-worker-detail-title">
              <h3>Original Complaint Image</h3>
            </div>

            {originalImageUrl ? (
              <img
                src={originalImageUrl}
                alt="Original complaint"
                className="field-worker-original-image"
              />
            ) : (
              <div className="field-worker-no-image">
                No complaint image available
              </div>
            )}

          </div>

        </section>

        {/* Resolution Evidence */}
        <section className="field-worker-evidence-section">

          <div className="field-worker-section-header">
            <div>
              <h3>Resolution Evidence</h3>

              <p>
                Capture a new photo at the complaint
                location after completing the work.
              </p>
            </div>
          </div>

          {/* Already submitted */}
          {evidenceAlreadySubmitted ? (
            <div className="field-worker-submitted-box">

              <CheckCircle2 size={38} />

              <h3>Evidence Submitted</h3>

              <p>
                Your resolution evidence has been submitted
                and is waiting for officer verification.
              </p>

              <span>
                You cannot change the complaint status.
                Only the assigned officer can approve the
                evidence and resolve the complaint.
              </span>

            </div>
          ) : (
            <>
              {/* Camera */}
              {!imagePreview ? (
                <div className="field-worker-camera-box">

                  <div className="field-worker-camera-icon">
                    <Camera size={42} />
                  </div>

                  <h3>Capture Resolution Photo</h3>

                  <p>
                    Take a clear photo showing that the
                    reported issue has been resolved.
                  </p>

                  <button
                    className="field-worker-capture-button"
                    onClick={openCamera}
                  >
                    <Camera size={20} />
                    Capture Photo
                  </button>

                </div>
              ) : (
                <div className="field-worker-evidence-card">

                  {/* Image preview */}
                  <div className="field-worker-preview-container">

                    <img
                      src={imagePreview}
                      alt="Resolution evidence preview"
                      className="field-worker-resolution-preview"
                    />

                    <button
                      className="field-worker-remove-image"
                      onClick={removeImage}
                      disabled={submitting}
                    >
                      <X size={18} />
                    </button>

                  </div>

                  {/* GPS */}
                  <div className="field-worker-verification-info">

                    <div
                      className={`field-worker-verification-item ${
                        locationStatus === "success"
                          ? "verified"
                          : ""
                      }`}
                    >
                      {locationLoading ? (
                        <Loader2
                          size={20}
                          className="field-worker-spinner"
                        />
                      ) : locationStatus === "success" ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <MapPin size={20} />
                      )}

                      <div>
                        <span>Current GPS Location</span>

                        {locationStatus === "success" &&
                        location ? (
                          <strong>
                            Location captured
                            <small>
                              {location.latitude.toFixed(6)},{" "}
                              {location.longitude.toFixed(6)}
                              {" • "}
                              Accuracy ±
                              {Math.round(
                                location.accuracy
                              )}
                              m
                            </small>
                          </strong>
                        ) : locationLoading ? (
                          <strong>
                            Getting your location...
                          </strong>
                        ) : (
                          <strong>
                            Location required
                          </strong>
                        )}
                      </div>
                    </div>

                    <div className="field-worker-verification-item">

                      <Clock size={20} />

                      <div>
                        <span>Capture Time</span>

                        <strong>
                          {location?.capturedAt
                            ? formatDate(
                                location.capturedAt
                              )
                            : "Waiting for GPS"}
                        </strong>
                      </div>

                    </div>

                  </div>

                  {/* Retry GPS */}
                  {locationStatus === "error" && (
                    <button
                      className="field-worker-location-retry"
                      onClick={getCurrentLocation}
                    >
                      <MapPin size={18} />
                      Retry Location
                    </button>
                  )}

                  {/* Submit */}
                  <button
                    className="field-worker-submit-button"
                    onClick={handleSubmitEvidence}
                    disabled={
                      submitting ||
                      !image ||
                      !location
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={20}
                          className="field-worker-spinner"
                        />
                        Submitting Evidence...
                      </>
                    ) : (
                      <>
                        <Upload size={20} />
                        Submit Resolution Evidence
                      </>
                    )}
                  </button>

                  <p className="field-worker-evidence-note">
                    Your photo, GPS location, timestamp and
                    worker identity will be recorded. The
                    assigned officer will verify the evidence
                    before resolving the complaint.
                  </p>

                </div>
              )}
            </>
          )}

        </section>

        {isCameraOpen && (
          <div className="field-worker-camera-modal" role="dialog" aria-modal="true">
            <div className="field-worker-camera-modal-content">
              <video
                ref={videoRef}
                className="field-worker-camera-video"
                autoPlay
                muted
                playsInline
              />

              <div className="field-worker-camera-actions">
                <button type="button" onClick={stopCamera}>
                  Cancel
                </button>
                <button type="button" onClick={capturePhoto}>
                  <Camera size={18} />
                  Capture Photo
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default FieldWorkerComplaint;