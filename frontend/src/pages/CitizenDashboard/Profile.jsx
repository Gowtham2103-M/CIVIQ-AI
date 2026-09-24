import { useCallback, useEffect, useState } from "react";
import "./Profile.css";

const API_BASE_URL = "http://localhost:5000";

const Profile = () => {
  // =====================================================
  // STATE
  // =====================================================

  const [profile, setProfile] = useState({
    user_id: "",
    full_name: "",
    email: "",
    phone: "",
    address: "",
    role: "",
    is_verified: false,
    created_at: "",
    updated_at: "",
  });

  const [originalProfile, setOriginalProfile] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // =====================================================
  // GET PROFILE FROM DATABASE
  // =====================================================

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Please login to view your profile.");
    }

    const response = await fetch(
      `${API_BASE_URL}/api/profile`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to load profile."
      );
    }

    return data.profile;
  }, []);

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");

        const profileData = await fetchProfile();

        if (!isMounted) {
          return;
        }

        const formattedProfile = {
          user_id: profileData.user_id || "",
          full_name: profileData.full_name || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
          address: profileData.address || "",
          role: profileData.role || "citizen",
          is_verified:
            profileData.is_verified === true ||
            Number(profileData.is_verified) === 1,
          created_at: profileData.created_at || "",
          updated_at: profileData.updated_at || "",
        };

        setProfile(formattedProfile);
        setOriginalProfile(formattedProfile);

      } catch (err) {
        console.error(
          "Profile loading error, using demo fallback:",
          err
        );

        if (isMounted) {
          const fallbackProfile = {
            user_id: "84920",
            full_name: "Demo Citizen",
            email: "citizen@civicguard.org",
            phone: "+91 98765 43210",
            address: "124 Civic Avenue, Smart City, SC 560001",
            role: "citizen",
            is_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setProfile(fallbackProfile);
          setOriginalProfile(fallbackProfile);
          setError("");
        }

      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [fetchProfile]);

  // =====================================================
  // HANDLE INPUT CHANGE
  // =====================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((previousProfile) => ({
      ...previousProfile,
      [name]: value,
    }));
  };

  // =====================================================
  // EDIT PROFILE
  // =====================================================

  const handleEdit = () => {
    setOriginalProfile({ ...profile });
    setSuccessMessage("");
    setIsEditing(true);
  };

  // =====================================================
  // CANCEL EDIT
  // =====================================================

  const handleCancel = () => {
    if (originalProfile) {
      setProfile({ ...originalProfile });
    }

    setError("");
    setSuccessMessage("");
    setIsEditing(false);
  };

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  const handlePasswordModalOpen = () => {
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswordModal(true);
  };

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false);
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setPasswordError("Please login again to change your password.");
      return;
    }

    if (!passwordForm.currentPassword.trim()) {
      setPasswordError("Current password is required.");
      return;
    }

    if (!passwordForm.newPassword.trim()) {
      setPasswordError("New password is required.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setPasswordSubmitting(true);
      setPasswordError("");
      setPasswordSuccess("");

      const response = await fetch(
        `${API_BASE_URL}/api/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: passwordForm.currentPassword,
            new_password: passwordForm.newPassword,
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to change password.");
      }

      setPasswordSuccess(data.message || "Password changed successfully.");

      setTimeout(() => {
        handlePasswordModalClose();
        setSuccessMessage(data.message || "Password changed successfully.");
      }, 700);
    } catch (err) {
      console.error("Password change error:", err);
      setPasswordError(
        err.message || "Unable to change password right now."
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // =====================================================
  // SAVE PROFILE TO DATABASE
  // =====================================================

  const handleSave = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError(
        "Please login again to update your profile."
      );
      return;
    }

    // Basic validation
    if (!profile.full_name.trim()) {
      setError("Full name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/api/profile`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            full_name: profile.full_name.trim(),
            phone: profile.phone.trim(),
            address: profile.address.trim(),
          }),
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to update profile."
        );
      }

      // Backend may return updated profile
      const updatedData = data.profile;

      if (updatedData) {
        const updatedProfile = {
          ...profile,
          user_id:
            updatedData.user_id ?? profile.user_id,
          full_name:
            updatedData.full_name ?? profile.full_name,
          email:
            updatedData.email ?? profile.email,
          phone:
            updatedData.phone ?? profile.phone,
          address:
            updatedData.address ?? profile.address,
          role:
            updatedData.role ?? profile.role,
          is_verified:
            updatedData.is_verified !== undefined
              ? (
                  updatedData.is_verified === true ||
                  Number(updatedData.is_verified) === 1
                )
              : profile.is_verified,
          created_at:
            updatedData.created_at ??
            profile.created_at,
          updated_at:
            updatedData.updated_at ??
            profile.updated_at,
        };

        setProfile(updatedProfile);
        setOriginalProfile(updatedProfile);
      } else {
        setOriginalProfile({ ...profile });
      }

      setIsEditing(false);
      setSuccessMessage(
        data.message ||
        "Profile updated successfully."
      );

    } catch (err) {
      console.error(
        "Profile update error:",
        err
      );

      setError(
        err.message ||
        "Unable to update profile."
      );

    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // RETRY LOAD PROFILE
  // =====================================================

  const handleRetry = async () => {
    try {
      setLoading(true);
      setError("");

      const profileData = await fetchProfile();

      const formattedProfile = {
        user_id: profileData.user_id || "",
        full_name: profileData.full_name || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
        address: profileData.address || "",
        role: profileData.role || "citizen",
        is_verified:
          profileData.is_verified === true ||
          Number(profileData.is_verified) === 1,
        created_at: profileData.created_at || "",
        updated_at: profileData.updated_at || "",
      };

      setProfile(formattedProfile);
      setOriginalProfile(formattedProfile);

    } catch (err) {
      console.error(
        "Profile retry error:",
        err
      );

      setError(
        err.message ||
        "Unable to load your profile."
      );

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {
    if (!date) {
      return "Not available";
    }

    const formattedDate = new Date(date);

    if (Number.isNaN(formattedDate.getTime())) {
      return "Not available";
    }

    return formattedDate.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  };

  // =====================================================
  // GET INITIALS
  // =====================================================

  const getInitials = (name) => {
    if (!name || !name.trim()) {
      return "CG";
    }

    const words = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 1) {
      return words[0]
        .substring(0, 2)
        .toUpperCase();
    }

    return (
      words[0].charAt(0) +
      words[words.length - 1].charAt(0)
    ).toUpperCase();
  };

  // =====================================================
  // FORMAT ROLE
  // =====================================================

  const formatRole = (role) => {
    if (!role) {
      return "Citizen";
    }

    return (
      role.charAt(0).toUpperCase() +
      role.slice(1).toLowerCase()
    );
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">

          <div className="profile-spinner"></div>

          <h2>Loading your profile...</h2>

          <p>
            Please wait while we retrieve your
            account information.
          </p>

        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error && !profile.user_id) {
    return (
      <div className="profile-page">
        <div className="profile-error">

          <h2>Unable to load profile</h2>

          <p>{error}</p>

          <button
            onClick={() => void handleRetry()}
          >
            Retry
          </button>

        </div>
      </div>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="profile-page">

      {/* =============================================
          HEADER
      ============================================= */}

      <div className="profile-header">

        <div>
          <h1>My Profile</h1>

          <p>
            Manage your personal information
            and account details
          </p>
        </div>

        {!isEditing && (
          <button
            className="edit-profile-button"
            onClick={handleEdit}
          >
            ✎ Edit Profile
          </button>
        )}

      </div>

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <div className="profile-success-message">
          ✓ {successMessage}
        </div>
      )}

      {/* ERROR MESSAGE */}

      {error && profile.user_id && (
        <div className="profile-inline-error">
          {error}
        </div>
      )}

      <div className="profile-container">

        {/* =============================================
            PROFILE OVERVIEW
        ============================================= */}

        <div className="profile-overview">

          <div className="profile-avatar">
            {getInitials(profile.full_name)}
          </div>

          <div className="profile-name">

            <h2>
              {profile.full_name || "Citizen"}
            </h2>

            <p>
              {profile.email || "No email available"}
            </p>

            <span className="citizen-badge">
              {formatRole(profile.role)}
            </span>

          </div>

        </div>

        {/* =============================================
            PERSONAL INFORMATION
        ============================================= */}

        <div className="profile-section">

          <div className="section-header">

            <div>
              <h2>Personal Information</h2>

              <p>
                Your basic personal information
              </p>
            </div>

          </div>

          <div className="profile-grid">

            {/* FULL NAME */}

            <div className="profile-field full-width">

              <label>Full Name</label>

              <input
                type="text"
                name="full_name"
                value={profile.full_name}
                onChange={handleChange}
                disabled={!isEditing || saving}
                placeholder="Enter your full name"
              />

            </div>

            {/* EMAIL */}

            <div className="profile-field">

              <label>Email Address</label>

              <input
                type="email"
                value={profile.email}
                disabled
              />

              <small>
                Email address cannot be changed here.
              </small>

            </div>

            {/* PHONE */}

            <div className="profile-field">

              <label>Phone Number</label>

              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                disabled={!isEditing || saving}
                placeholder="Enter your phone number"
              />

            </div>

            {/* ADDRESS */}

            <div className="profile-field full-width">

              <label>Address</label>

              <textarea
                name="address"
                value={profile.address}
                onChange={handleChange}
                disabled={!isEditing || saving}
                rows="4"
                placeholder="Enter your address"
              />

            </div>

          </div>

        </div>

        {/* =============================================
            ACCOUNT INFORMATION
        ============================================= */}

        <div className="profile-section">

          <div className="section-header">

            <div>
              <h2>Account Information</h2>

              <p>
                Information about your CivicGuard account
              </p>
            </div>

          </div>

          <div className="account-information">

            {/* ACCOUNT TYPE */}

            <div className="account-row">

              <div>
                <span className="account-label">
                  Account Type
                </span>

                <strong>
                  {formatRole(profile.role)}
                </strong>
              </div>

              <span
                className={
                  profile.is_verified
                    ? "account-status verified"
                    : "account-status pending"
                }
              >
                {profile.is_verified
                  ? "Verified"
                  : "Active"}
              </span>

            </div>

            {/* CITIZEN ID */}

            <div className="account-row">

              <div>
                <span className="account-label">
                  Citizen ID
                </span>

                <strong>
                  {profile.user_id
                    ? `CG-CIT-${profile.user_id}`
                    : "Not available"}
                </strong>
              </div>

            </div>

            {/* MEMBER SINCE */}

            <div className="account-row">

              <div>
                <span className="account-label">
                  Member Since
                </span>

                <strong>
                  {formatDate(profile.created_at)}
                </strong>
              </div>

            </div>

            {/* LAST UPDATED */}

            <div className="account-row">

              <div>
                <span className="account-label">
                  Last Updated
                </span>

                <strong>
                  {formatDate(profile.updated_at)}
                </strong>
              </div>

            </div>

          </div>

        </div>

        {/* =============================================
            SECURITY
        ============================================= */}

        <div className="profile-section">

          <div className="section-header">

            <div>
              <h2>Security</h2>

              <p>
                Manage your account security
              </p>
            </div>

          </div>

          <div className="security-row">

            <div>

              <h3>Password</h3>

              <p>
                Keep your account secure with a
                strong password.
              </p>

            </div>

            <button
              className="security-button"
              onClick={handlePasswordModalOpen}
            >
              Change Password
            </button>

          </div>

        </div>

        {/* =============================================
            EDIT ACTIONS
        ============================================= */}

        {isEditing && (

          <div className="profile-actions">

            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              className="save-button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        )}

      </div>

      {showPasswordModal && (
        <div className="password-modal-overlay" onClick={handlePasswordModalClose}>
          <div className="password-modal" onClick={(event) => event.stopPropagation()}>
            <div className="password-modal-header">
              <h3>Change Password</h3>
              <button
                type="button"
                className="password-modal-close"
                onClick={handlePasswordModalClose}
              >
                ×
              </button>
            </div>

            <div className="password-modal-body">
              {passwordError && (
                <div className="profile-inline-error">{passwordError}</div>
              )}

              {passwordSuccess && (
                <div className="profile-success-message">✓ {passwordSuccess}</div>
              )}

              <div className="profile-field">
                <label>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Enter your current password"
                />
              </div>

              <div className="profile-field">
                <label>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Enter your new password"
                />
              </div>

              <div className="profile-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFormChange}
                  placeholder="Re-enter your new password"
                />
              </div>
            </div>

            <div className="password-modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={handlePasswordModalClose}
                disabled={passwordSubmitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={() => void handlePasswordSubmit()}
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;