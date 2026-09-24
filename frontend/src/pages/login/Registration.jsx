import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Registration.css";

const API_BASE = `${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")}/api`;

const Registration = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!formData.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!formData.phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    if (!formData.password) {
      setError("Please enter a password.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      setSuccess(
        "Account created successfully! Redirecting to login..."
      );

      setFormData({
        full_name: "",
        email: "",
        phone: "",
        address: "",
        password: "",
        confirm_password: "",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(
        err.message || "Unable to create account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-page">

      <div className="registration-background">
        <div className="registration-circle circle-one"></div>
        <div className="registration-circle circle-two"></div>
      </div>

      <div className="registration-container">

        {/* LEFT SECTION */}
        <div className="registration-info">

          <div className="brand-logo">
            <div className="brand-icon">🛡️</div>
            <span>AI CivicGuard</span>
          </div>

          <div className="info-content">

            <span className="welcome-label">
              CITIZEN REGISTRATION
            </span>

            <h1>
              Your voice can
              <span> improve your city.</span>
            </h1>

            <p>
              Create your AI CivicGuard account to report civic
              problems, track complaints, and stay informed about
              actions taken by authorities.
            </p>

            <div className="feature-list">

              <div className="feature-item">
                <div className="feature-icon">✓</div>

                <div>
                  <strong>Report Civic Issues</strong>
                  <p>
                    Submit complaints about roads, waste,
                    infrastructure and more.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">✓</div>

                <div>
                  <strong>Track Complaints</strong>
                  <p>
                    Monitor the progress of your submitted
                    complaints.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">✓</div>

                <div>
                  <strong>Transparent Governance</strong>
                  <p>
                    Get updates about actions taken on civic
                    issues.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="registration-card">

          <div className="form-header">

            <span className="form-tag">
              CREATE ACCOUNT
            </span>

            <h2>
              Register as a Citizen
            </h2>

            <p>
              Enter your details to create your account.
            </p>

          </div>

          <form onSubmit={handleSubmit}>

            {/* FULL NAME */}
            <div className="input-group">

              <label htmlFor="full_name">
                Full Name
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  👤
                </span>

                <input
                  id="full_name"
                  type="text"
                  name="full_name"
                  placeholder="Enter your full name"
                  value={formData.full_name}
                  onChange={handleChange}
                  maxLength={100}
                  autoComplete="name"
                />

              </div>

            </div>

            {/* EMAIL */}
            <div className="input-group">

              <label htmlFor="email">
                Email Address
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  ✉
                </span>

                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  maxLength={150}
                  autoComplete="email"
                />

              </div>

            </div>

            {/* PHONE */}
            <div className="input-group">

              <label htmlFor="phone">
                Phone Number
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  📱
                </span>

                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={20}
                  autoComplete="tel"
                />

              </div>

            </div>

            {/* ADDRESS */}
            <div className="input-group">

              <label htmlFor="address">
                Address
                <span className="optional">
                  Optional
                </span>
              </label>

              <div className="textarea-wrapper">

                <span className="textarea-icon">
                  📍
                </span>

                <textarea
                  id="address"
                  name="address"
                  placeholder="Enter your residential address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                />

              </div>

            </div>

            {/* PASSWORD */}
            <div className="input-group">

              <label htmlFor="password">
                Password
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  🔒
                </span>

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>

              </div>

              <small className="password-hint">
                Minimum 6 characters
              </small>

            </div>

            {/* CONFIRM PASSWORD */}
            <div className="input-group">

              <label htmlFor="confirm_password">
                Confirm Password
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  🔐
                </span>

                <input
                  id="confirm_password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  name="confirm_password"
                  placeholder="Confirm your password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  {showConfirmPassword
                    ? "Hide"
                    : "Show"}
                </button>

              </div>

            </div>

            {/* ERROR */}
            {error && (
              <div className="form-message error-message">
                <span>!</span>
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="form-message success-message">
                <span>✓</span>
                {success}
              </div>
            )}

            {/* BUTTON */}
            <button
              type="submit"
              className="register-button"
              disabled={loading}
            >

              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Citizen Account
                  <span className="arrow">→</span>
                </>
              )}

            </button>

          </form>

          <div className="login-link">
            Already have an account?
            <Link to="/login">
              Sign in
            </Link>
          </div>

          <div className="security-note">
            <span>🔒</span>
            Your information is securely protected.
          </div>

        </div>

      </div>
    </div>
  );
};

export default Registration;