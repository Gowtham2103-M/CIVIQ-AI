-- ============================================================
-- AI CivicGuard — complaint_governance table
-- ============================================================
--
-- Stores Agent 2 governance decisions.
--
-- The UNIQUE KEY on complaint_id prevents
-- duplicate governance records for the same complaint.
--
-- Do not manually insert governance_id or created_at.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_governance (

    governance_id       INT             NOT NULL AUTO_INCREMENT,

    complaint_id        INT             NOT NULL,

    department          VARCHAR(100)    NOT NULL,

    priority            VARCHAR(20)     NOT NULL,

    sla_hours           INT             NOT NULL,

    escalation_level    INT             NOT NULL,

    action              TEXT            NOT NULL,

    reason              TEXT            NOT NULL,

    status              VARCHAR(30)     NOT NULL DEFAULT 'ASSIGNED',

    created_at          TIMESTAMP       NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (governance_id),

    UNIQUE KEY unique_complaint (complaint_id),

    KEY complaint_id (complaint_id)

);
