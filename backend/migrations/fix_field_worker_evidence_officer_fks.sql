-- Evidence assignments and reviews are performed by municipal officers.
ALTER TABLE field_worker_evidence
  DROP FOREIGN KEY fk_fwe_assigned_by;

ALTER TABLE field_worker_evidence
  ADD CONSTRAINT fk_fwe_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES officers (officer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE field_worker_evidence
  DROP FOREIGN KEY fk_fwe_reviewed_by;

ALTER TABLE field_worker_evidence
  ADD CONSTRAINT fk_fwe_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES officers (officer_id)
    ON DELETE SET NULL ON UPDATE CASCADE;