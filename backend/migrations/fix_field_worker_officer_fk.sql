-- Field workers belong to municipal officers, not citizen users.
ALTER TABLE field_workers
  DROP FOREIGN KEY fk_field_worker_officer,
  ADD CONSTRAINT fk_field_worker_officer
    FOREIGN KEY (officer_id) REFERENCES officers (officer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;