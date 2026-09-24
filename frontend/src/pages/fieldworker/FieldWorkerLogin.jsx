import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Silk from "../../components/Silk";
import "./FieldWorkerLogin.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function FieldWorkerLogin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/field-worker/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Invalid login credentials."
        );
      }

      /*
       * Store only the information required by the
       * Field Worker module.
       */
      localStorage.setItem(
        "fieldWorkerToken",
        data.access_token
      );

      localStorage.setItem(
        "fieldWorker",
        JSON.stringify(data.worker)
      );

      // Go to Field Worker dashboard
      navigate("/field-worker/dashboard");

    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="field-worker-login-page">
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

      <div className="field-worker-login-card">

        {/* Logo */}
        <div className="field-worker-logo">
          <div 
            className="field-worker-logo-icon"
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              boxShadow: "0 4px 15px rgba(37, 99, 235, 0.5)",
            }}
          >
            <Shield size={28} color="#FFFFFF" />
          </div>

          <div>
            <h1>CivIQ AI</h1>
            <span>Field Worker Portal</span>
          </div>
        </div>

        {/* Heading */}
        <div className="field-worker-login-heading">
          <h2>Field Worker Login</h2>

          <p>
            Login using the temporary credentials provided
            by your officer.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="field-worker-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin}>

          {/* Username */}
          <div className="field-worker-input-group">
            <label>Username</label>

            <div className="field-worker-input-wrapper">
              <span className="field-worker-input-icon">
                <User size={18} color="#2563EB" />
              </span>

              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="field-worker-input-group">
            <label>Password</label>

            <div className="field-worker-input-wrapper">
              <span className="field-worker-input-icon">
                <Lock size={18} color="#2563EB" />
              </span>

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />

              <button
                type="button"
                className="field-worker-password-toggle"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
                disabled={loading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <EyeOff size={19} color="#94A3B8" />
                ) : (
                  <Eye size={19} color="#94A3B8" />
                )}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            type="submit"
            className="field-worker-login-button"
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
              boxShadow: "0 6px 20px rgba(37, 99, 235, 0.5)",
            }}
          >
            {loading ? (
              <>
                <Loader2
                  size={19}
                  className="field-worker-spinner"
                />
                Signing in...
              </>
            ) : (
              <>
                Sign In
              </>
            )}
          </button>

        </form>

        {/* Footer */}
        <div className="field-worker-login-footer">
          <p>
            This account is temporary and can only access
            complaints assigned by an authorized officer.
          </p>
        </div>

      </div>

    </div>
  );
}

export default FieldWorkerLogin;