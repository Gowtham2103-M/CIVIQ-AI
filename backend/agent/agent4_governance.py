"""Agent 4: MySQL-backed governance analytics snapshots."""

import json
import logging
import os
import threading
import time
from datetime import datetime, date
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), os.pardir, ".env"))

try:
    from database import get_connection
except ImportError:
    from ..database import get_connection

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

logger = logging.getLogger("Agent4Governance")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )

INSIGHTS_TABLE = "analytics_insights"
DEFAULT_INTERVAL_SECONDS = int(os.getenv("ANALYTICS_INTERVAL_SECONDS", "300"))
PENDING_STATUSES = ("PENDING", "SUBMITTED", "AI_ANALYZED", "UNDER_REVIEW", "ASSIGNED")
RESOLVED_STATUSES = ("RESOLVED", "CLOSED")


def _json_default(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


class GovernanceAgent:
    """Calculate and persist one governance analytics snapshot per cycle."""

    def __init__(self) -> None:
        self.latest_insights: Optional[Dict[str, Any]] = None
        self.last_run_time: Optional[datetime] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._cycle_lock = threading.Lock()
        self._state_lock = threading.Lock()

    def run_analytics_cycle(self) -> Optional[Dict[str, Any]]:
        if not self._cycle_lock.acquire(blocking=False):
            logger.warning("Analytics cycle already running; skipping overlap.")
            return self.latest_insights

        started = time.perf_counter()
        connection = None
        try:
            logger.info("Agent 4 analytics cycle started.")
            connection = get_connection()
            with connection.cursor() as cursor:
                metrics = self.calculate_metrics(cursor)
                categories = self.analyze_categories(cursor)
                officers = self.analyze_officers(cursor)
                departments = self.analyze_departments(cursor)
                hotspots = self.find_hotspots(cursor)
                trends = self.analyze_trends(cursor)
                department_summary = self.summarize_departments(departments)
                predictions = self.generate_predictions(metrics, categories, departments, hotspots, trends)
                ai_summary = self.generate_ai_summary(
                    metrics, categories, officers, departments, hotspots, trends, predictions
                )
                result: Dict[str, Any] = {
                    "generated_at": datetime.now(),
                    **metrics,
                    "top_category": categories[0]["category"] if categories else None,
                    "top_location": hotspots[0]["location"] if hotspots else None,
                    "category_analysis": categories,
                    "department_performance": departments,
                    "department_summary": department_summary,
                    "officer_performance": officers,
                    "hotspots": hotspots,
                    "trends": trends,
                    "trend_summary": {
                        "latest_month": trends.get("latest_month"),
                        "direction": trends.get("direction"),
                        "changes": trends.get("changes", {}),
                        "department_leaders": department_summary,
                    },
                    "predictions": predictions,
                    "ai_summary": ai_summary,
                    "execution_time_ms": int((time.perf_counter() - started) * 1000),
                }
                self.save_insights(cursor, connection, result)

            with self._state_lock:
                self.latest_insights = result
                self.last_run_time = result["generated_at"]
            logger.info("Agent 4 completed successfully in %sms.", result["execution_time_ms"])
            return result
        except Exception:
            logger.exception("Agent 4 analytics failed.")
            return None
        finally:
            if connection is not None:
                connection.close()
            self._cycle_lock.release()

    @staticmethod
    def calculate_metrics(cursor) -> Dict[str, Any]:
        cursor.execute(
            """
            SELECT COUNT(*) AS total_complaints,
                   COALESCE(SUM(status IN ('RESOLVED', 'CLOSED')), 0) AS resolved_complaints,
                   COALESCE(SUM(status IN ('PENDING', 'SUBMITTED', 'AI_ANALYZED', 'UNDER_REVIEW', 'ASSIGNED')), 0) AS pending_complaints,
                   COALESCE(SUM(status = 'IN_PROGRESS'), 0) AS in_progress_complaints,
                   COALESCE(SUM(status = 'REJECTED'), 0) AS rejected_complaints,
                   COALESCE(AVG(CASE WHEN status IN ('RESOLVED', 'CLOSED')
                       AND COALESCE(resolved_at, closed_at) IS NOT NULL
                       THEN TIMESTAMPDIFF(MINUTE, created_at, COALESCE(resolved_at, closed_at)) END), 0) AS average_minutes
            FROM complaints
            """
        )
        row = cursor.fetchone() or {}
        total = int(row.get("total_complaints") or 0)
        resolved = int(row.get("resolved_complaints") or 0)
        resolution_percentage = round(resolved * 100 / total, 2) if total else 0.0
        return {
            "total_complaints": total,
            "resolved_complaints": resolved,
            "pending_complaints": int(row.get("pending_complaints") or 0),
            "in_progress_complaints": int(row.get("in_progress_complaints") or 0),
            "rejected_complaints": int(row.get("rejected_complaints") or 0),
            "resolution_percentage": resolution_percentage,
            "resolution_rate": resolution_percentage,
            "average_resolution_hours": round(float(row.get("average_minutes") or 0) / 60, 2),
        }

    @staticmethod
    def analyze_categories(cursor) -> List[Dict[str, Any]]:
        cursor.execute(
            """
            SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS category,
                   COUNT(*) AS complaints
            FROM complaints
            GROUP BY COALESCE(NULLIF(category, ''), 'Uncategorized')
            ORDER BY complaints DESC
            LIMIT 10
            """
        )
        return [{"category": row["category"], "complaints": int(row["complaints"])} for row in cursor.fetchall()]

    @staticmethod
    def analyze_officers(cursor) -> List[Dict[str, Any]]:
        cursor.execute(
            """
            SELECT o.officer_id, o.full_name AS officer_name,
                   COUNT(c.complaint_id) AS assigned,
                   COALESCE(SUM(c.status IN ('RESOLVED', 'CLOSED')), 0) AS resolved,
                   COALESCE(SUM(c.status IN ('PENDING', 'SUBMITTED', 'AI_ANALYZED', 'UNDER_REVIEW', 'ASSIGNED')), 0) AS pending,
                   COALESCE(SUM(c.status = 'IN_PROGRESS'), 0) AS in_progress
            FROM officers o
            LEFT JOIN complaints c ON c.officer_id = o.officer_id
            GROUP BY o.officer_id, o.full_name
            ORDER BY assigned DESC, resolved DESC
            LIMIT 20
            """
        )
        result = []
        for row in cursor.fetchall():
            assigned = int(row["assigned"] or 0)
            resolved = int(row["resolved"] or 0)
            result.append({
                "officer_id": row["officer_id"],
                "officer_name": row["officer_name"],
                "assigned": assigned,
                "resolved": resolved,
                "pending": int(row["pending"] or 0),
                "in_progress": int(row["in_progress"] or 0),
                "resolution_percentage": round(resolved * 100 / assigned, 2) if assigned else 0.0,
            })
        return result

    @staticmethod
    def canonical_department_name(value: Optional[str]) -> str:
        """Collapse department aliases used by the governance pipeline."""
        text = " ".join((value or "").replace("&", " and ").split()).lower()
        if not text:
            return "Unassigned Department"
        if "electric" in text:
            return "Electrical Department"
        if "road" in text or "public work" in text or "infrastructure" in text:
            return "Public Works & Infrastructure"
        if "general civic" in text or "municipal corporation" in text or "administration" in text:
            return "Civic Administration"
        return " ".join(word.capitalize() for word in text.split())

    @staticmethod
    def analyze_departments(cursor) -> List[Dict[str, Any]]:
        cursor.execute(
            """
            SELECT g.department, g.sla_hours,
                   c.complaint_id, c.status, c.created_at,
                   c.resolved_at, c.closed_at, c.officer_id,
                   EXISTS (
                       SELECT 1 FROM field_worker_evidence fw
                       WHERE fw.complaint_id = c.complaint_id
                   ) AS field_worker_assigned
            FROM complaint_governance g
            INNER JOIN complaints c ON c.complaint_id = g.complaint_id
            """
        )
        grouped: Dict[str, Dict[str, Any]] = {}
        seen = set()
        for row in cursor.fetchall():
            department = GovernanceAgent.canonical_department_name(row["department"])
            complaint_key = (department, row["complaint_id"])
            if complaint_key in seen:
                continue
            seen.add(complaint_key)
            item = grouped.setdefault(department, {
                "department": department,
                "total": 0,
                "resolved": 0,
                "pending": 0,
                "in_progress": 0,
                "rejected": 0,
                "officer_assigned": 0,
                "field_worker_assigned": 0,
                "resolution_minutes": [],
                "sla_met": 0,
                "sla_observations": 0,
            })
            status = (row["status"] or "").upper()
            item["total"] += 1
            if status in RESOLVED_STATUSES:
                item["resolved"] += 1
                completed_at = row["resolved_at"] or row["closed_at"]
                if completed_at and row["created_at"]:
                    minutes = max(0, int((completed_at - row["created_at"]).total_seconds() / 60))
                    item["resolution_minutes"].append(minutes)
                    if row["sla_hours"] is not None:
                        item["sla_observations"] += 1
                        item["sla_met"] += int(minutes <= int(row["sla_hours"]) * 60)
            elif status == "IN_PROGRESS":
                item["in_progress"] += 1
            elif status == "REJECTED":
                item["rejected"] += 1
            else:
                item["pending"] += 1
            item["officer_assigned"] += int(row["officer_id"] is not None)
            item["field_worker_assigned"] += int(row["field_worker_assigned"] or 0)

        result = []
        for item in grouped.values():
            total = item["total"]
            result.append({
                "department": item["department"],
                "total": total,
                "resolved": item["resolved"],
                "pending": item["pending"],
                "in_progress": item["in_progress"],
                "rejected": item["rejected"],
                "officer_assigned": item["officer_assigned"],
                "field_worker_assigned": item["field_worker_assigned"],
                "resolution_percentage": round(item["resolved"] * 100 / total, 2) if total else 0.0,
                "average_resolution_hours": round(sum(item["resolution_minutes"]) / len(item["resolution_minutes"]) / 60, 2)
                if item["resolution_minutes"] else 0.0,
                "sla_compliance_percentage": round(item["sla_met"] * 100 / item["sla_observations"], 2)
                if item["sla_observations"] else None,
            })
        return sorted(result, key=lambda item: (-item["total"], -item["resolution_percentage"], item["department"]))

    @staticmethod
    def summarize_departments(departments: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not departments:
            return {
                "highest_workload_department": None,
                "highest_resolved_department": None,
                "best_resolution_department": None,
            }
        highest_workload = max(departments, key=lambda item: (item["total"], item["resolved"]))
        highest_resolved = max(departments, key=lambda item: (item["resolved"], item["total"]))
        eligible = [item for item in departments if item["total"] >= 2]
        best_resolution = max(
            eligible or departments,
            key=lambda item: (item["resolution_percentage"], item["resolved"], -item["total"]),
        )

        def leader(item: Dict[str, Any]) -> Dict[str, Any]:
            return {
                "department": item["department"],
                "total": item["total"],
                "resolved": item["resolved"],
                "resolution_percentage": item["resolution_percentage"],
            }

        return {
            "highest_workload_department": leader(highest_workload),
            "highest_resolved_department": leader(highest_resolved),
            "best_resolution_department": leader(best_resolution),
        }

    @staticmethod
    def find_hotspots(cursor) -> List[Dict[str, Any]]:
        cursor.execute(
            """
            SELECT COALESCE(NULLIF(address, ''), 'Unknown location') AS location,
                   COALESCE(NULLIF(category, ''), 'Uncategorized') AS category,
                   COUNT(*) AS complaints,
                   AVG(latitude) AS latitude, AVG(longitude) AS longitude
            FROM complaints
            GROUP BY COALESCE(NULLIF(address, ''), 'Unknown location'),
                     COALESCE(NULLIF(category, ''), 'Uncategorized')
            ORDER BY complaints DESC
            LIMIT 20
            """
        )
        return [
            {"location": row["location"], "category": row["category"], "complaints": int(row["complaints"]),
             "latitude": row["latitude"], "longitude": row["longitude"]}
            for row in cursor.fetchall()
        ]

    @staticmethod
    def analyze_trends(cursor) -> Dict[str, Any]:
        cursor.execute(
            """
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
                   COUNT(*) AS received,
                   SUM(status IN ('RESOLVED', 'CLOSED')) AS resolved,
                   SUM(status = 'REJECTED') AS rejected,
                   SUM(status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')) AS open_complaints
            FROM complaints
            WHERE created_at >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH), '%Y-%m-01')
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month
            """
        )
        received_rows = {row["month"]: row for row in cursor.fetchall()}
        current_month = date.today().replace(day=1)
        months = []
        for offset in range(11, -1, -1):
            month_index = current_month.year * 12 + current_month.month - 1 - offset
            year, month = divmod(month_index, 12)
            months.append(f"{year:04d}-{month + 1:02d}")

        cursor.execute(
            """
            SELECT DATE_FORMAT(COALESCE(resolved_at, closed_at), '%Y-%m') AS month,
                   COUNT(*) AS resolved_events
            FROM complaints
            WHERE COALESCE(resolved_at, closed_at) >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH), '%Y-%m-01')
            GROUP BY DATE_FORMAT(COALESCE(resolved_at, closed_at), '%Y-%m')
            """
        )
        resolved_rows = {row["month"]: int(row["resolved_events"] or 0) for row in cursor.fetchall()}
        monthly = []
        for month in months:
            row = received_rows.get(month, {})
            received = int(row.get("received") or 0)
            resolved = int(row.get("resolved") or 0)
            monthly.append({
                "month": month,
                "received": received,
                "resolved": resolved,
                "resolved_events": resolved_rows.get(month, 0),
                "rejected": int(row.get("rejected") or 0),
                "open_complaints": int(row.get("open_complaints") or 0),
                "resolution_percentage": round(resolved * 100 / received, 2) if received else 0.0,
            })

        def change(key: str) -> Dict[str, Any]:
            recent = sum(row[key] for row in monthly[-3:])
            previous = sum(row[key] for row in monthly[-6:-3])
            difference = recent - previous
            return {
                "recent_3_months": recent,
                "previous_3_months": previous,
                "change": difference,
                "change_percentage": round(difference * 100 / previous, 2) if previous else None,
                "direction": "increasing" if difference > 0 else "decreasing" if difference < 0 else "stable",
            }

        changes = {key: change(key) for key in ("received", "resolved_events", "open_complaints", "rejected")}
        return {
            "monthly_data": monthly,
            "direction": changes["received"]["direction"],
            "changes": changes,
            "latest_month": monthly[-1] if monthly else None,
        }

    @staticmethod
    def generate_predictions(metrics, categories, departments, hotspots, trends) -> List[Dict[str, Any]]:
        predictions = []
        if trends["direction"] == "increasing":
            predictions.append({"type": "complaint_volume", "risk": "HIGH", "message": "Complaint volume increased in the latest month; review capacity and prevention measures."})
        if categories:
            predictions.append({"type": "category_risk", "risk": "MEDIUM", "category": categories[0]["category"], "complaints": categories[0]["complaints"], "message": "This is the highest-volume complaint category in the snapshot."})
        if departments:
            busiest = departments[0]
            if busiest["resolution_percentage"] < 50 and busiest["total"] >= 2:
                predictions.append({
                    "type": "department_capacity",
                    "risk": "HIGH",
                    "department": busiest["department"],
                    "complaints": busiest["total"],
                    "resolution_percentage": busiest["resolution_percentage"],
                    "message": "This department has the highest workload and a low resolution percentage; review capacity and blockers.",
                })
        if hotspots:
            predictions.append({"type": "location_risk", "risk": "MEDIUM", "location": hotspots[0]["location"], "category": hotspots[0]["category"], "complaints": hotspots[0]["complaints"], "message": "This location/category pair has the highest observed complaint concentration."})
        if metrics["in_progress_complaints"] > metrics["resolved_complaints"]:
            predictions.append({"type": "resolution_capacity", "risk": "MEDIUM", "message": "In-progress complaints exceed resolved complaints; review staffing and blockers."})
        return predictions

    @staticmethod
    def generate_ai_summary(metrics, categories, officers, departments, hotspots, trends, predictions) -> str:
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        api_key = openrouter_key or openai_key
        if OpenAI is None or not api_key:
            return "LLM unavailable. SQL analytics completed; review the highest-volume categories, hotspots, trends, and unresolved workload in this snapshot."
        aggregate = {
            "metrics": metrics,
            "categories": categories,
            "officers": officers[:10],
            "departments": departments[:10],
            "hotspots": hotspots[:10],
            "trends": trends,
            "predictions": predictions,
        }
        prompt = """Summarize this aggregated civic governance data in under 120 words. State major problems, high-risk locations/categories, resolution performance, trends, and actionable administrative recommendations. Use only supplied values; do not invent facts. Do not mention raw records.\n\n""" + json.dumps(aggregate, default=_json_default)
        try:
            client_args = {"api_key": api_key}
            if openrouter_key:
                client_args["base_url"] = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
                model = os.getenv("OPENROUTER_MODEL", "openrouter/free")
            else:
                model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
            response = OpenAI(**client_args).chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )
            return (response.choices[0].message.content or "").strip() or "LLM returned no summary. SQL analytics completed."
        except Exception:
            logger.exception("LLM governance summary failed; using fallback.")
            return "LLM unavailable. SQL analytics completed; review the highest-volume categories, hotspots, trends, and unresolved workload in this snapshot."

    @staticmethod
    def save_insights(cursor, connection, result: Dict[str, Any]) -> None:
        cursor.execute(
            """
            INSERT INTO analytics_insights
            (generated_at, total_complaints, resolved_complaints, pending_complaints,
             in_progress_complaints, rejected_complaints, resolution_rate,
             average_resolution_hours, top_category, top_location, category_analysis,
             officer_performance, department_performance, hotspots, trends,
             trend_summary, predictions, ai_summary, execution_time_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (result["generated_at"], result["total_complaints"], result["resolved_complaints"],
             result["pending_complaints"], result["in_progress_complaints"], result["rejected_complaints"],
             result["resolution_rate"], result["average_resolution_hours"], result["top_category"],
             result["top_location"], json.dumps(result["category_analysis"], default=_json_default),
             json.dumps(result["officer_performance"], default=_json_default),
             json.dumps(result["department_performance"], default=_json_default),
             json.dumps(result["hotspots"], default=_json_default),
             json.dumps(result["trends"], default=_json_default),
             json.dumps(result["trend_summary"], default=_json_default),
             json.dumps(result["predictions"], default=_json_default),
             result["ai_summary"], result["execution_time_ms"]),
        )
        connection.commit()

    def _background_loop(self, interval_seconds: int) -> None:
        self.run_analytics_cycle()
        while not self._stop_event.wait(interval_seconds):
            if not self._running:
                break
            self.run_analytics_cycle()

    def start(self, interval_seconds: Optional[int] = None) -> None:
        interval = DEFAULT_INTERVAL_SECONDS if interval_seconds is None else interval_seconds
        if interval <= 0:
            raise ValueError("interval_seconds must be greater than zero")
        with self._state_lock:
            if self._running:
                logger.warning("Agent 4 is already running.")
                return
            self._running = True
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._background_loop, args=(interval,), name="Agent4-Governance", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        with self._state_lock:
            self._running = False
            self._stop_event.set()
            thread = self._thread
        if thread and thread is not threading.current_thread():
            thread.join(timeout=10)
        with self._state_lock:
            self._thread = None

    def get_status(self) -> Dict[str, Any]:
        with self._state_lock:
            return {"agent": "Agent 4", "name": "Governance Insights Agent", "running": self._running,
                    "last_run": self.last_run_time.isoformat() if self.last_run_time else None,
                    "has_latest_insights": self.latest_insights is not None}


if __name__ == "__main__":
    result = GovernanceAgent().run_analytics_cycle()
    print(json.dumps(result, default=_json_default, indent=2))
