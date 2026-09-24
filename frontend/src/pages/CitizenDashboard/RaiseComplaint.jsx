import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  PlusCircle, 
  FileText, 
  FilePlus,
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  LayoutDashboard, 
  Bell, 
  User, 
  HelpCircle 
} from "lucide-react";
import "./RaiseComplaint.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const RaiseComplaint = () => {
  const navigate = useNavigate();

  const [image, setImage] = useState(null);
  const [description, setDescription] = useState("");

  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState(
    "Requesting location access..."
  );
  const [locationPermission, setLocationPermission] =
    useState("prompt");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Success popup
  const [showSuccessPopup, setShowSuccessPopup] =
    useState(false);
  

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // ==========================================
  // LOCATION
  // ==========================================
  const requestLocation = () => {
    setError("");

    if (!navigator.geolocation) {
      setLocationPermission("unsupported");
      setLocationStatus(
        "Your browser does not support location services."
      );
      return;
    }

    setLocationStatus("Requesting location access...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationPermission("granted");
        setLocationStatus(
          "Location access granted successfully."
        );
      },

      (err) => {
        setLocation(null);

        switch (err.code) {
          case 1:
            setLocationPermission("denied");
            setLocationStatus(
              "Location permission is required to submit a complaint."
            );
            break;

          case 2:
            setLocationPermission("unavailable");
            setLocationStatus(
              "Your location is currently unavailable."
            );
            break;

          case 3:
            setLocationPermission("timeout");
            setLocationStatus(
              "Location request timed out. Please try again."
            );
            break;

          default:
            setLocationPermission("error");
            setLocationStatus(
              "Unable to get your location."
            );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // ==========================================
  // LOCATION ON PAGE LOAD
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => {
      requestLocation();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // ==========================================
  // IMAGE CLEANUP
  // ==========================================
  useEffect(() => {
    return () => {
      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }
    };
  }, [image]);

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

  // ==========================================
  // CAMERA CAPTURE
  // ==========================================
  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    setError("");

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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
        `complaint-${Date.now()}.jpg`,
        { type: "image/jpeg" }
      );

      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }

      setImage({
        file: capturedFile,
        preview: URL.createObjectURL(capturedFile),
      });
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  // ==========================================
  // REMOVE IMAGE
  // ==========================================
  const removeImage = () => {
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }

    setImage(null);

  };

  // ==========================================
  // SUBMIT
  // ==========================================
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (isSubmitting) return;

    if (!description.trim()) {
      setError("Please enter a description of the civic issue.");
      return;
    }

    if (!image?.file) {
      setError("Please take a photo of the civic issue.");
      return;
    }

    if (
      !location ||
      locationPermission !== "granted"
    ) {
      setError(
        "Location permission is required before submitting your complaint."
      );

      requestLocation();
      return;
    }

    const formData = new FormData();

    formData.append(
      "complaint_image",
      image.file
    );

    formData.append(
      "description",
      description.trim()
    );

    formData.append(
      "latitude",
      String(location.latitude)
    );

    formData.append(
      "longitude",
      String(location.longitude)
    );

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error(
          "You are not logged in. Please login again."
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/complaints`,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
          },

          body: formData,
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 403 && data?.account_status === "SUSPENDED") {
          navigate("/account-suspended");
          return;
        }
        throw new Error(
          data?.message ||
            `Failed to submit complaint (${response.status}).`
        );
      }

      // SHOW SUCCESS POPUP
      setShowSuccessPopup(true);
      
      // Reset form
      removeImage();
      setDescription("");

    

    } catch (err) {
      console.error(
        "Complaint submission error:",
        err
      );

      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // SUCCESS POPUP
  // ==========================================
  const closeSuccessPopup = () => {
    setShowSuccessPopup(false);
  };

  // ==========================================
  // UI
  // ==========================================
  return (
    <div className="dashboard-layout">

      {/* ======================================
          SIDEBAR / MENU
      ====================================== */}
      <aside className="dashboard-sidebar">

        <div className="sidebar-logo">
          <div className="logo-icon">
            <ShieldCheck size={22} color="#FFFFFF" />
          </div>

          <div>
            <h2>AI CivicGuard</h2>
            <span>Citizen Portal</span>
          </div>
        </div>

        <nav className="sidebar-menu">

          <button
            onClick={() =>
              navigate("/dashboard")
            }
            className="menu-item"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className="menu-item active"
            onClick={() =>
              navigate("/raise-complaint")
            }
          >
            <PlusCircle size={18} />
            <span>Raise Complaint</span>
          </button>

          <button
            className="menu-item"
            onClick={() =>
              navigate("/my-complaints")
            }
          >
            <FileText size={18} />
            <span>My Complaints</span>
          </button>

          <button
            className="menu-item"
            onClick={() =>
              navigate("/notifications")
            }
          >
            <Bell size={18} />
            <span>Notifications</span>
          </button>

          <button
            className="menu-item"
            onClick={() =>
              navigate("/profile")
            }
          >
            <User size={18} />
            <span>Profile</span>
          </button>

          <button
            className="menu-item"
            onClick={() =>
              navigate("/help-support")
            }
          >
            <HelpCircle size={18} />
            <span>Help & Support</span>
          </button>

        </nav>

      </aside>

      {/* ======================================
          MAIN CONTENT
      ====================================== */}
      <main className="raise-main-content">

        <div className="complaint-container">

          {/* HEADER */}
          <div className="complaint-header">

            <div className="header-icon">
              <FilePlus size={28} color="#FFFFFF" />
            </div>

            <div className="header-text">
              <h1>Raise a Complaint</h1>

              <p>
                Report a civic issue by taking a
                photo. Your current location helps
                us identify where the issue is located.
              </p>
            </div>

          </div>

          {/* FORM */}
          <form
            className="complaint-form"
            onSubmit={handleSubmit}
          >

            {/* LOCATION */}
            <div
              className={`location-permission-card ${
                locationPermission === "granted"
                  ? "permission-granted"
                  : "permission-required"
              }`}
            >

              <div className="permission-icon">
                {locationPermission === "granted" ? (
                  <CheckCircle2 size={24} color="#00D2FF" />
                ) : (
                  <MapPin size={24} color="#FF007A" />
                )}
              </div>

              <div className="permission-content">

                <h3>
                  {locationPermission ===
                  "granted"
                    ? "Location Access Granted"
                    : "Location Access Required"}
                </h3>

                <p>
                  {locationStatus}
                </p>

                {locationPermission ===
                  "granted" &&
                  location && (
                    <span className="location-coordinates">
                      Location captured successfully
                    </span>
                  )}

                {locationPermission !==
                  "granted" && (
                  <p className="permission-warning">
                    Location access is required to
                    identify the issue location and
                    route your complaint to the correct
                    authority.
                  </p>
                )}

              </div>

              {locationPermission !==
                "granted" && (
                <button
                  type="button"
                  className="allow-location-btn"
                  onClick={requestLocation}
                >
                  Allow Location
                </button>
              )}

            </div>

            {/* ISSUE PHOTO */}
<div className="form-section">
  <label className="section-label">
    Issue Photo
    <span className="required">*</span>
  </label>

  <p className="section-help">
    Take a photo of the civic issue using your device camera.
  </p>

  {!image ? (
    <div className="image-actions">

      {/* CAMERA */}
      <button
        type="button"
        className="camera-button"
        onClick={openCamera}
      >
        <span className="button-icon">
          <Camera size={32} color="#FF007A" />
        </span>

        <span>
          <strong>Take Photo</strong>
          <small>Open device camera to capture issue</small>
        </span>
      </button>

    </div>
  ) : (
    <div className="image-preview-box">

      <img
        src={image.preview}
        alt="Complaint preview"
        className="complaint-preview"
      />

      <div className="image-preview-overlay">

        <button
          type="button"
          className="change-image-btn"
          onClick={openCamera}
        >
          Retake Photo
        </button>

        <button
          type="button"
          className="remove-image-btn"
          onClick={removeImage}
        >
          Remove
        </button>

      </div>

    </div>
  )}
</div>

            {isCameraOpen && (
              <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Take complaint photo">
                <div className="camera-modal-content">
                  <video
                    ref={videoRef}
                    className="camera-video"
                    autoPlay
                    muted
                    playsInline
                  />

                  <div className="camera-modal-actions">
                    <button type="button" className="cancel-camera-btn" onClick={stopCamera}>
                      Cancel
                    </button>
                    <button type="button" className="capture-camera-btn" onClick={capturePhoto}>
                      Capture Photo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            <div className="form-section">

              <label className="section-label">
                Description
                <span className="required" aria-hidden="true">
                  *
                </span>
              </label>

              <p className="section-help">
                Describe the civic issue clearly so it can be reviewed and resolved.
              </p>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="For example: There is a large pothole in the middle of the road..."
                maxLength={1000}
                rows={6}
                required
                aria-label="Complaint description"
              />

              <div className="character-count">
                {description.length}/1000
              </div>

            </div>

            {/* ERROR */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              className="submit-complaint-button"
              disabled={isSubmitting}
            >
              <span>
                {isSubmitting
                  ? "Submitting..."
                  : "Submit Complaint"}
              </span>

              <span className="submit-arrow">
                <ArrowRight size={18} />
              </span>
            </button>

            <p className="privacy-note">
              <Lock size={14} style={{ display: "inline", marginRight: "4px" }} /> Your photo and location are used
              only for processing and routing your
              civic complaint.
            </p>

          </form>

        </div>

      </main>

      {/* ======================================
          SUCCESS POPUP
      ====================================== */}
      {showSuccessPopup && (
        <div className="success-modal-overlay">

          <div className="success-modal">

            {/* CHECK CIRCLE */}
            <div className="success-check-circle">
              <div className="success-check">
                ✓
              </div>
            </div>

            <h2>
              Complaint Submitted!
            </h2>

            <p>
              Your complaint has been successfully
              submitted and is now being processed.
            </p>

            <div className="success-modal-actions">

              <button
                className="view-complaints-btn"
                onClick={() => {
                  setShowSuccessPopup(false);
                  navigate("/my-complaints");
                }}
              >
                View My Complaints
              </button>

              <button
                className="close-success-btn"
                onClick={closeSuccessPopup}
              >
                Done
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default RaiseComplaint;