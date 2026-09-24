-- ============================================================
-- Password Reset Tokens Table
-- ============================================================
-- Stores OTP tokens for password reset functionality

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id        INT             NOT NULL AUTO_INCREMENT,
    user_id         INT             NOT NULL,
    otp             VARCHAR(10)     NOT NULL,
    expires_at      DATETIME        NOT NULL,
    is_used         TINYINT(1)      DEFAULT 0,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (token_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    KEY idx_user_id (user_id),
    KEY idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

