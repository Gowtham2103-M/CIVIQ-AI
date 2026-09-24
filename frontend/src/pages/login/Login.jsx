import { useState } from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

const API_BASE = `${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")}/api/auth`;
const API_ROOT = API_BASE.replace(/\/api\/auth$/, "");

export default function Auth() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [forgotStep, setForgotStep] = useState("idle");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function navigateAfterLogin(token) {
    const statusResponse = await fetch(`${API_ROOT}/api/violations/account-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = await statusResponse.json();

    if (
      statusResponse.ok &&
      (statusData.account_status === "SUSPENDED" ||
        Number(statusData.violation_count) >= 3)
    ) {
      navigate("/account-suspended", { replace: true });
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  function say(type, text) {
    setNotice({ type, text });
  }

  // =========================
  // LOGIN
  // =========================

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setNotice(null);

    if (!email || !password) {
      return say("error", "Enter your email and password.");
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("user_id", data.user.id);

      say("success", "Login successful.");
      await navigateAfterLogin(data.token);
    } catch (err) {
      say("error", err.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // FORGOT PASSWORD
  // =========================

  async function sendOtp(e) {
    e.preventDefault();
    setNotice(null);

    if (!forgotEmail) {
      return say("error", "Enter your email.");
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send code.");
      }

      say("success", data.message || "Verification code sent to your email.");
      setForgotStep("otp");
    } catch (err) {
      say("error", err.message || "Error sending verification code.");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // VERIFY OTP
  // =========================

  async function verifyOtp(e) {
    e.preventDefault();
    setNotice(null);

    if (!otp) {
      return say("error", "Enter the verification code.");
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return say("error", "Verification code must be 6 digits.");
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotEmail,
          otp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to verify code.");
      }

      say("success", "Verification code verified. Now enter your new password.");
      setOtpVerified(true);
      setForgotStep("password");
    } catch (err) {
      say("error", err.message || "Error verifying code.");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // RESET PASSWORD
  // =========================

  async function submitReset(e) {
    e.preventDefault();
    setNotice(null);

    if (!newPassword) {
      return say("error", "Enter a new password.");
    }

    if (!confirmPassword) {
      return say("error", "Confirm your password.");
    }

    if (newPassword.length < 6) {
      return say("error", "Password must be at least 6 characters.");
    }

    if (newPassword !== confirmPassword) {
      return say("error", "Passwords do not match.");
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotEmail,
          otp,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password.");
      }

      say("success", data.message || "Password reset successful.");

      setForgotStep("done");
    } catch (err) {
      say("error", err.message || "Error resetting password.");
    } finally {
      setLoading(false);
    }
  }

  function closeForgotFlow() {
    setForgotStep("idle");
    setForgotEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpVerified(false);
    setNotice(null);
  }

  function goToRegister() {
    navigate("/register");
  }

  // =========================
  // GOOGLE LOGIN
  // =========================

  async function handleGoogleSuccess(credentialResponse) {
    setNotice(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/google-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Google login failed.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("user_id", data.user.id);

      await navigateAfterLogin(data.token);
    } catch (error) {
      console.error("Google login error:", error);
      say("error", error.message || "Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">

        {/* LOGIN PORTAL CARD */}
        <div className="right">
          <h2>Welcome back</h2>

          <p className="sub">
            Log in to access your CivicGuard dashboard.
          </p>

          {notice && (
            <div
              className={`notice notice-${notice.type}`}
              role="alert"
            >
              {notice.text}
            </div>
          )}

          {/* LOGIN FORM */}
          {forgotStep === "idle" && (
            <form onSubmit={handleAuthSubmit} noValidate>

              <div className="input-group">
                <label htmlFor="email">Email Address</label>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="button"
                className="link-inline forgot"
                onClick={() => {
                  setForgotStep("email");
                  setForgotEmail(email || "");
                  setNotice(null);
                }}
              >
                Forgot password?
              </button>

              <button
                className="primary-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? "Please wait..." : "Log In"}
              </button>

              <div className="divider">
                <span>OR</span>
              </div>

              <div className="google-login-wrapper">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    say("error", "Google Sign-In failed.");
                  }}
                />
              </div>

            </form>
          )}

          {/* FORGOT PASSWORD EMAIL */}
          {forgotStep === "email" && (
            <form onSubmit={sendOtp} noValidate>
              <h3>Reset Password</h3>

              <p className="sub">
                Enter your email address and we will send you a verification
                code.
              </p>

              <div className="input-group">
                <label htmlFor="forgotEmail">
                  Email Address
                </label>

                <input
                  id="forgotEmail"
                  type="email"
                  placeholder="Enter your email address"
                  value={forgotEmail}
                  onChange={(e) =>
                    setForgotEmail(e.target.value)
                  }
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="primary-btn"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>

              <button
                type="button"
                onClick={closeForgotFlow}
                className="link-inline"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* OTP VERIFICATION FORM */}
          {forgotStep === "otp" && (
            <form onSubmit={verifyOtp} noValidate>
              <h3>Verify Your Email</h3>

              <p className="sub">
                Enter the verification code sent to {forgotEmail}.
              </p>

              <div className="input-group">
                <label htmlFor="otp">
                  Verification Code
                </label>

                <input
                  id="otp"
                  className="otp-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="primary-btn"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>

              <button
                type="button"
                onClick={() => setForgotStep("email")}
                className="link-inline"
              >
                Use a Different Email
              </button>
            </form>
          )}

          {/* PASSWORD RESET FORM */}
          {forgotStep === "password" && otpVerified && (
            <form onSubmit={submitReset} noValidate>
              <h3>Create New Password</h3>

              <p className="sub">
                Enter your new password below.
              </p>

              <div className="input-group">
                <label htmlFor="newPassword">
                  New Password
                </label>

                <input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  autoComplete="new-password"
                />
              </div>

              <div className="input-group">
                <label htmlFor="confirmPassword">
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="primary-btn"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>

              <button
                type="button"
                onClick={closeForgotFlow}
                className="link-inline"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* RESET COMPLETE */}
          {forgotStep === "done" && (
            <div className="forgot-done">
              <p>
                Your password has been reset successfully. You can now log in
                with your new password.
              </p>

              <button
                onClick={closeForgotFlow}
                className="primary-btn"
              >
                Back to Login
              </button>
            </div>
          )}

          {/* SWITCH TO REGISTER */}
          {forgotStep === "idle" && (
            <div className="bottom-text">
              Don't have an account?{" "}
              <button
                type="button"
                className="link-inline"
                onClick={goToRegister}
              >
                Create Account
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}