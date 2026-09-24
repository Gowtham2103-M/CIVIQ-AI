import { useCallback, useEffect, useState } from "react";
import "./Notifications.css";

const API_BASE_URL = "http://localhost:5000";

const Notifications = () => {
  // =====================================================
  // STATE
  // =====================================================

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNotification, setSelectedNotification] = useState(null);

  // =====================================================
  // FETCH NOTIFICATIONS
  // =====================================================

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Please login to view your notifications.");
    }

    const response = await fetch(
      `${API_BASE_URL}/api/notifications`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const contentType = response.headers.get("content-type");

    const data = contentType?.includes("application/json")
      ? await response.json()
      : {};

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to load notifications."
      );
    }

    return Array.isArray(data.notifications)
      ? data.notifications
      : [];
  }, []);

  // =====================================================
  // LOAD NOTIFICATIONS
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const notificationData = await fetchNotifications();

        if (!cancelled) {
          setNotifications(notificationData);
          setError("");
        }
      } catch (err) {
        console.error("Fetch notifications error, using demo fallback:", err);

        if (!cancelled) {
          const fallbackNotifications = [
            {
              notification_id: "notif-1",
              complaint_id: "84920",
              title: "Complaint #84920 Update",
              message: "Your complaint regarding 'Pothole on Main Road' has been assigned to Public Works Department.",
              type: "status_update",
              read: false,
              is_read: false,
              created_at: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              notification_id: "notif-2",
              complaint_id: "84915",
              title: "Investigation Scheduled",
              message: "Field worker assigned to inspect the reported location today at 2:00 PM.",
              type: "assignment",
              read: false,
              is_read: false,
              created_at: new Date(Date.now() - 86400000).toISOString(),
            },
            {
              notification_id: "notif-3",
              title: "Civic Awareness Alert",
              message: "Monsoon road maintenance drive is active in your area. Report clogged drains early.",
              type: "announcement",
              read: true,
              is_read: true,
              created_at: new Date(Date.now() - 172800000).toISOString(),
            },
          ];

          setNotifications(fallbackNotifications);
          setError("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [fetchNotifications]);

  // =====================================================
  // RETRY
  // =====================================================

  const handleRetry = async () => {
    setLoading(true);
    setError("");

    try {
      const notificationData = await fetchNotifications();

      setNotifications(notificationData);
    } catch (err) {
      console.error("Retry notifications error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CHECK READ STATUS
  // =====================================================

  const isNotificationRead = (notification) => {
    return (
      notification.is_read === true ||
      Number(notification.is_read) === 1
    );
  };

  // =====================================================
  // UNREAD COUNT
  // =====================================================

  const unreadCount = notifications.filter(
    (notification) => !isNotificationRead(notification)
  ).length;

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatTime = (date) => {
    if (!date) {
      return "Recently";
    }

    const notificationDate = new Date(date);

    if (Number.isNaN(notificationDate.getTime())) {
      return "Recently";
    }

    return notificationDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // =====================================================
  // FORMAT TYPE
  // =====================================================

  const formatType = (type) => {
    if (!type) {
      return "General";
    }

    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  // =====================================================
  // GET NOTIFICATION ICON
  // =====================================================

  const getNotificationIcon = (type) => {
    switch ((type || "").toLowerCase()) {
      case "success":
      case "resolved":
        return "✓";

      case "progress":
      case "in_progress":
        return "🔄";

      case "ai":
      case "ai_analyzed":
        return "🤖";

      case "submitted":
        return "📋";

      case "reopened":
      case "warning":
        return "⚠";

      case "rejected":
        return "✕";

      case "assigned":
        return "👤";

      case "under_review":
        return "🔍";

      default:
        return "🔔";
    }
  };

  // =====================================================
  // MARK ONE AS READ
  // =====================================================

  const markAsRead = async (notificationId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const contentType = response.headers.get("content-type");

      const responseData = contentType?.includes("application/json")
        ? await response.json()
        : {};

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Failed to mark notification as read."
        );
      }

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) =>
          notification.notification_id === notificationId
            ? {
                ...notification,
                is_read: true,
              }
            : notification
        )
      );

      setSelectedNotification((previousNotification) => {
        if (
          previousNotification &&
          previousNotification.notification_id === notificationId
        ) {
          return {
            ...previousNotification,
            is_read: true,
          };
        }

        return previousNotification;
      });
    } catch (err) {
      console.error("Mark notification as read error:", err);
    }
  };

  // =====================================================
  // MARK ALL AS READ
  // =====================================================

  const markAllAsRead = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const contentType = response.headers.get("content-type");

      const responseData = contentType?.includes("application/json")
        ? await response.json()
        : {};

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Failed to mark all notifications as read."
        );
      }

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setSelectedNotification((previousNotification) => {
        if (!previousNotification) {
          return null;
        }

        return {
          ...previousNotification,
          is_read: true,
        };
      });
    } catch (err) {
      console.error("Mark all notifications error:", err);
    }
  };

  // =====================================================
  // DELETE NOTIFICATION
  // =====================================================

  const deleteNotification = async (notificationId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const contentType = response.headers.get("content-type");

      const responseData = contentType?.includes("application/json")
        ? await response.json()
        : {};

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Failed to delete notification."
        );
      }

      setNotifications((previousNotifications) =>
        previousNotifications.filter(
          (notification) =>
            notification.notification_id !== notificationId
        )
      );

      setSelectedNotification((previousNotification) => {
        if (
          previousNotification &&
          previousNotification.notification_id === notificationId
        ) {
          return null;
        }

        return previousNotification;
      });
    } catch (err) {
      console.error("Delete notification error:", err);

      alert(
        err instanceof Error
          ? err.message
          : "Unable to delete notification."
      );
    }
  };

  // =====================================================
  // OPEN NOTIFICATION
  // =====================================================

  const openNotification = (notification) => {
    setSelectedNotification(notification);

    if (!isNotificationRead(notification)) {
      void markAsRead(notification.notification_id);
    }
  };

  // =====================================================
  // CLOSE POPUP
  // =====================================================

  const closeNotification = () => {
    setSelectedNotification(null);
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="notifications-page">
        <div className="notifications-loading">
          <div className="loading-spinner"></div>

          <h2>Loading notifications...</h2>

          <p>
            Please wait while we retrieve your updates.
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div className="notifications-page">
        <div className="notifications-error">
          <h2>Unable to load notifications</h2>

          <p>{error}</p>

          <button onClick={() => void handleRetry()}>
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
    <div className="notifications-page">

      {/* HEADER */}

      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>

          <p>
            Stay updated about your complaints and civic issues
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            className="mark-all-button"
            onClick={() => void markAllAsRead()}
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* SUMMARY */}

      <div className="notification-summary">
        <div className="notification-summary-icon">
          🔔
        </div>

        <div>
          <h2>
            {unreadCount} unread notification
            {unreadCount !== 1 ? "s" : ""}
          </h2>

          <p>
            You will receive updates when your complaint
            status changes.
          </p>
        </div>
      </div>

      {/* NOTIFICATION LIST */}

      <div className="notification-list">

        {notifications.length === 0 ? (
          <div className="empty-notifications">
            <div className="empty-notification-icon">
              🔔
            </div>

            <h2>No notifications</h2>

            <p>
              You are all caught up. New complaint updates
              will appear here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const isRead = isNotificationRead(notification);

            return (
              <div
                key={notification.notification_id}
                className={`notification-card ${
                  !isRead ? "notification-unread" : ""
                }`}
                onClick={() => openNotification(notification)}
              >
                {/* ICON */}

                <div
                  className={`notification-icon ${
                    notification.type || "info"
                  }`}
                >
                  {getNotificationIcon(notification.type)}
                </div>

                {/* ONLY TITLE */}

                <div className="notification-list-content">
                  <h3>
                    {notification.title || "Notification"}
                  </h3>
                </div>

                {/* UNREAD DOT */}

                {!isRead && (
                  <span className="unread-dot"></span>
                )}

                {/* DELETE */}

                <button
                  className="notification-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteNotification(
                      notification.notification_id
                    );
                  }}
                  title="Delete notification"
                  aria-label="Delete notification"
                >
                  ×
                </button>
              </div>
            );
          })
        )}

      </div>

      {/* NOTIFICATION DETAILS MODAL */}

      {selectedNotification && (
        <div
          className="notification-modal-overlay"
          onClick={closeNotification}
        >
          <div
            className="notification-modal"
            onClick={(event) => event.stopPropagation()}
          >

            {/* MODAL HEADER */}

            <div className="notification-modal-header">
              <div className="modal-icon">
                {getNotificationIcon(selectedNotification.type)}
              </div>

              <button
                className="notification-modal-close"
                onClick={closeNotification}
                title="Close"
                aria-label="Close notification details"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="notification-modal-body">

              <div className="notification-modal-title">
                <h2>
                  {selectedNotification.title || "Notification"}
                </h2>
              </div>

              {/* COMPLAINT ID */}

              <div className="notification-detail-row">
                <span className="detail-label">
                  Complaint ID
                </span>

                <span className="detail-value">
                  {selectedNotification.complaint_id
                    ? `#${selectedNotification.complaint_id}`
                    : "Not available"}
                </span>
              </div>

              {/* TYPE */}

              <div className="notification-detail-row">
                <span className="detail-label">
                  Type
                </span>

                <span className="detail-value">
                  {formatType(selectedNotification.type)}
                </span>
              </div>

              {/* TITLE */}

              <div className="notification-detail-section">
                <span className="detail-label">
                  Title
                </span>

                <p className="notification-full-title">
                  {selectedNotification.title || "Notification"}
                </p>
              </div>

              {/* MESSAGE */}

              <div className="notification-detail-section">
                <span className="detail-label">
                  Message
                </span>

                <p className="notification-full-message">
                  {selectedNotification.message ||
                    "No message available."}
                </p>
              </div>

              {/* RECEIVED */}

              <div className="notification-detail-row">
                <span className="detail-label">
                  Received
                </span>

                <span className="detail-value">
                  {formatTime(selectedNotification.created_at)}
                </span>
              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="notification-modal-footer">
              <button
                className="modal-close-button"
                onClick={closeNotification}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Notifications;