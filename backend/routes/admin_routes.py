import json
import os
from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, jsonify, request

from database import get_connection


admin_bp = Blueprint("admin", __name__)
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 8


def _secret():
    return os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")


def _admin_token():
    token = request.headers.get("Authorization", "")
    if not token.startswith("Bearer "):
        return None, (jsonify({"detail": "Authentication required"}), 401)
    try:
        claims = jwt.decode(token[7:], _secret(), algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, TypeError):
        return None, (jsonify({"detail": "Invalid or expired admin token"}), 401)
    if claims.get("role") != "admin":
        return None, (jsonify({"detail": "Admin access required"}), 403)
    return claims, None


def _date(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def _status(value):
    return (value or "").upper().replace(" ", "_")


def _admin_required(handler):
    def wrapped(*args, **kwargs):
        _, error = _admin_token()
        if error:
            return error
        return handler(*args, **kwargs)
    wrapped.__name__ = handler.__name__
    return wrapped


@admin_bp.post("/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    username = os.getenv("ADMIN_USERNAME")
    password = os.getenv("ADMIN_PASSWORD")
    if not username or not password:
        return jsonify({"detail": "Admin credentials are not configured"}), 503
    if data.get("username") != username or data.get("password") != password:
        return jsonify({"detail": "Invalid admin username or password"}), 401
    secret = _secret()
    if not secret:
        return jsonify({"detail": "JWT secret is not configured"}), 503
    expires = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": "admin", "role": "admin", "exp": expires}, secret, algorithm=JWT_ALGORITHM)
    return jsonify({"success": True, "access_token": token, "token_type": "bearer", "admin": {"name": "System Admin"}})


@admin_bp.get("/admin/dashboard/")
@admin_bp.get("/admin/dashboard")
@_admin_required
def dashboard():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS total FROM complaints")
        total = int(cur.fetchone()["total"] or 0)
        cur.execute("SELECT UPPER(status) AS status, COUNT(*) AS count FROM complaints GROUP BY status")
        counts = {"PENDING": 0, "IN_PROGRESS": 0, "RESOLVED": 0, "REJECTED": 0}
        for row in cur.fetchall():
            key = _status(row["status"])
            if key in counts:
                counts[key] += int(row["count"] or 0)
        cur.execute("SELECT COUNT(*) AS total FROM officers")
        officers = int(cur.fetchone()["total"] or 0)
        cur.execute("SELECT COUNT(*) AS total FROM officers WHERE status = 'ACTIVE'")
        active_officers = int(cur.fetchone()["total"] or 0)
        cur.execute("SELECT c.complaint_id AS id, c.status, g.department, c.created_at FROM complaints c LEFT JOIN complaint_governance g ON g.complaint_id = c.complaint_id ORDER BY c.created_at DESC LIMIT 5")
        recent = [{**row, "created_at": _date(row["created_at"])} for row in cur.fetchall()]
        cur.execute("SELECT g.department, COUNT(*) AS complaints FROM complaints c INNER JOIN complaint_governance g ON g.complaint_id = c.complaint_id WHERE g.department IS NOT NULL AND TRIM(g.department) <> '' GROUP BY g.department ORDER BY complaints DESC LIMIT 10")
        departments = cur.fetchall()
        return jsonify({"success": True, "summary": {
            "total_complaints": total, "pending_complaints": counts["PENDING"],
            "in_progress_complaints": counts["IN_PROGRESS"], "resolved_complaints": counts["RESOLVED"],
            "rejected_complaints": counts["REJECTED"], "resolution_rate": round(counts["RESOLVED"] * 100 / total, 1) if total else 0,
            "total_officers": officers, "active_officers": active_officers}, "recent_complaints": recent, "departments": departments})
    finally:
        conn.close()


def _filters(args, table_alias="c"):
    conditions, params = [], []
    search = args.get("search", "").strip()
    if search:
        conditions.append(f"(CAST({table_alias}.complaint_id AS CHAR) LIKE %s OR {table_alias}.title LIKE %s OR {table_alias}.description LIKE %s OR {table_alias}.address LIKE %s)")
        params.extend([f"%{search}%"] * 4)
    if args.get("status") and args["status"].lower() != "all":
        conditions.append(f"UPPER({table_alias}.status) = %s")
        params.append(_status(args["status"]))
    if args.get("department") and args["department"].lower() != "all":
        conditions.append(f"LOWER({table_alias}.department) = LOWER(%s)")
        params.append(args["department"])
    return conditions, params


@admin_bp.get("/admin/complaints/")
@admin_bp.get("/admin/complaints")
@_admin_required
def complaints():
    page = max(request.args.get("page", 1, type=int), 1)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    conditions, params = _filters(request.args)
    conditions = [condition.replace("c.department", "g.department") for condition in conditions]
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    conn = get_connection()
    try:
        cur = conn.cursor()
        from_clause = "FROM complaints c LEFT JOIN complaint_governance g ON g.complaint_id = c.complaint_id"
        cur.execute(f"SELECT COUNT(*) AS total {from_clause}{where}", params)
        total = int(cur.fetchone()["total"] or 0)
        cur.execute(f"SELECT c.complaint_id AS id, c.title, c.category, c.address, c.priority, c.status, g.department, c.officer_id, c.latitude, c.longitude, c.created_at {from_clause}{where} ORDER BY c.created_at DESC LIMIT %s OFFSET %s", params + [limit, (page - 1) * limit])
        rows = [{**row, "created_at": _date(row["created_at"]), "status": _status(row["status"])} for row in cur.fetchall()]
        return jsonify({"success": True, "total": total, "page": page, "limit": limit, "complaints": rows})
    finally:
        conn.close()


@admin_bp.get("/admin/complaints/<int:complaint_id>")
@_admin_required
def complaint_detail(complaint_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM complaints WHERE complaint_id = %s", (complaint_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"detail": "Complaint not found"}), 404
        for key, value in list(row.items()):
            row[key] = _date(value)
        return jsonify({"success": True, "complaint": row})
    finally:
        conn.close()


@admin_bp.patch("/admin/complaints/<int:complaint_id>/status")
@_admin_required
def complaint_status(complaint_id):
    value = _status((request.get_json(silent=True) or {}).get("status"))
    if value not in {"PENDING", "SUBMITTED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"}:
        return jsonify({"detail": "Invalid complaint status"}), 400
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE complaints SET status = %s WHERE complaint_id = %s", (value, complaint_id))
        if cur.rowcount == 0:
            return jsonify({"detail": "Complaint not found"}), 404
        conn.commit()
        return jsonify({"success": True, "complaint_id": complaint_id, "status": value})
    finally:
        conn.close()


@admin_bp.get("/admin/officers/")
@admin_bp.get("/admin/officers")
@_admin_required
def officers():
    page = max(request.args.get("page", 1, type=int), 1)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    conditions, params = [], []
    search = request.args.get("search", "").strip()
    if search:
        conditions.append("(o.full_name LIKE %s OR o.email LIKE %s OR o.employee_code LIKE %s OR o.phone LIKE %s)")
        params.extend([f"%{search}%"] * 4)
    for field in ("department", "status"):
        value = request.args.get(field)
        if value and value.lower() != "all":
            conditions.append(f"LOWER(o.{field}) = LOWER(%s)")
            params.append(value)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) AS total FROM officers o{where}", params)
        total = int(cur.fetchone()["total"] or 0)
        cur.execute(f"SELECT o.officer_id AS id, o.full_name, o.email, o.phone, o.city, o.district, o.state, o.pincode, o.department, o.designation, o.employee_code, o.status, o.last_login, COUNT(c.complaint_id) AS complaints, COALESCE(SUM(c.status IN ('RESOLVED', 'CLOSED')), 0) AS resolved, COALESCE(SUM(c.status NOT IN ('RESOLVED', 'CLOSED')), 0) AS pending FROM officers o LEFT JOIN complaints c ON c.officer_id = o.officer_id{where} GROUP BY o.officer_id, o.full_name, o.email, o.phone, o.city, o.district, o.state, o.pincode, o.department, o.designation, o.employee_code, o.status, o.last_login ORDER BY o.full_name LIMIT %s OFFSET %s", params + [limit, (page - 1) * limit])
        rows = [{**row, "last_login": _date(row["last_login"])} for row in cur.fetchall()]
        return jsonify({"success": True, "total": total, "page": page, "limit": limit, "officers": rows})
    finally:
        conn.close()


@admin_bp.get("/admin/officers/<int:officer_id>")
@_admin_required
def officer_detail(officer_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM officers WHERE officer_id = %s", (officer_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"detail": "Officer not found"}), 404
        row["last_login"] = _date(row.get("last_login"))
        row["created_at"] = _date(row.get("created_at"))
        row["updated_at"] = _date(row.get("updated_at"))
        return jsonify({"success": True, "officer": row})
    finally:
        conn.close()


@admin_bp.patch("/admin/officers/<int:officer_id>/status")
@_admin_required
def officer_status(officer_id):
    value = (request.get_json(silent=True) or {}).get("status", "").upper().replace(" ", "_")
    if value not in {"ACTIVE", "INACTIVE", "ON_LEAVE"}:
        return jsonify({"detail": "Invalid officer status"}), 400
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE officers SET status = %s WHERE officer_id = %s", (value, officer_id))
        if cur.rowcount == 0:
            return jsonify({"detail": "Officer not found"}), 404
        conn.commit()
        return jsonify({"success": True, "officer_id": officer_id, "status": value})
    finally:
        conn.close()


@admin_bp.get("/admin/live-map/")
@admin_bp.get("/admin/live-map")
@_admin_required
def live_map():
    conditions, params = ["c.latitude IS NOT NULL", "c.longitude IS NOT NULL"], []
    if request.args.get("status") and request.args["status"].lower() != "all":
        conditions.append("UPPER(c.status) = %s")
        params.append(_status(request.args["status"]))
    if request.args.get("department") and request.args["department"].lower() != "all":
        conditions.append("LOWER(c.department) = LOWER(%s)")
        params.append(request.args["department"])
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT c.complaint_id AS id, c.title, c.category, c.priority AS severity, c.status, c.department, c.address AS location, c.latitude, c.longitude, c.officer_id, c.created_at FROM complaints c WHERE {' AND '.join(conditions)} ORDER BY c.created_at DESC", params)
        rows = [{**row, "status": _status(row["status"]), "created_at": _date(row["created_at"])} for row in cur.fetchall()]
        return jsonify({"success": True, "complaints": rows, "officers": [], "statistics": {"total": len(rows), "pending": sum(_status(r["status"]) in {"PENDING", "SUBMITTED"} for r in rows), "in_progress": sum(_status(r["status"]) == "IN_PROGRESS" for r in rows), "resolved": sum(_status(r["status"]) in {"RESOLVED", "CLOSED"} for r in rows), "active_officers": 0}})
    finally:
        conn.close()


@admin_bp.get("/admin/analytics/")
@admin_bp.get("/admin/analytics")
@_admin_required
def analytics():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM analytics_insights ORDER BY generated_at DESC LIMIT 1")
        row = cur.fetchone()
        if not row:
            return jsonify({"success": True, "summary": {}, "monthlyTrend": [], "departments": [], "severity": [], "hotspots": [], "officerPerformance": [], "insights": [], "message": "No analytics snapshot available"})
        result = {"summary": {"total": row["total_complaints"], "resolved": row["resolved_complaints"], "pending": row["pending_complaints"], "inProgress": row["in_progress_complaints"], "rejected": row["rejected_complaints"], "resolutionRate": float(row["resolution_rate"] or 0), "avgResolution": float(row["average_resolution_hours"] or 0)}}
        for target, source, default in (("monthlyTrend", "trends", []), ("departments", "department_performance", []), ("severity", "category_analysis", []), ("hotspots", "hotspots", []), ("officerPerformance", "officer_performance", []), ("insights", "predictions", [])):
            value = row.get(source)
            result[target] = json.loads(value) if isinstance(value, str) else (value or default)
        cur.execute("SELECT priority AS name, COUNT(*) AS value FROM complaints WHERE priority IS NOT NULL AND TRIM(priority) <> '' GROUP BY priority ORDER BY value DESC")
        result["severity"] = [{"name": item["name"], "value": int(item["value"] or 0), "percentage": round(int(item["value"] or 0) * 100 / result["summary"]["total"], 1) if result["summary"]["total"] else 0} for item in cur.fetchall()]
        result["aiSummary"] = row.get("ai_summary")
        return jsonify({"success": True, **result})
    finally:
        conn.close()
