"""Router for analytics endpoints.

Each endpoint performs SQL aggregation queries on the interaction data
populated by the ETL pipeline. All endpoints require a `lab` query
parameter to filter results by lab (e.g., "lab-01").
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth import verify_api_key
from app.database import get_session

router = APIRouter()


def _get_lab_title_pattern(lab: str) -> str:
    """Convert lab-01 to Lab 01 pattern for title matching."""
    return f"%{lab.replace('lab-', 'Lab ')}%"


@router.get("/scores")
async def get_scores(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
    api_key: str = Depends(verify_api_key),
):
    """Score distribution histogram for a given lab.

    - Find the lab item by matching title (e.g. "lab-04" → title contains "Lab 04")
    - Find all tasks that belong to this lab (parent_id = lab.id)
    - Query interactions for these items that have a score
    - Group scores into buckets: "0-25", "26-50", "51-75", "76-100"
      using CASE WHEN expressions
    - Return a JSON array:
      [{"bucket": "0-25", "count": 12}, {"bucket": "26-50", "count": 8}, ...]
    - Always return all four buckets, even if count is 0
    """
    query = text("""
        WITH lab_item AS (
            SELECT id FROM item 
            WHERE type = 'lab' AND title LIKE :lab_title_pattern
        ),
        task_items AS (
            SELECT id FROM item 
            WHERE parent_id IN (SELECT id FROM lab_item)
            UNION
            SELECT id FROM lab_item
        ),
        score_counts AS (
            SELECT 
                CASE 
                    WHEN score >= 0 AND score <= 25 THEN '0-25'
                    WHEN score >= 26 AND score <= 50 THEN '26-50'
                    WHEN score >= 51 AND score <= 75 THEN '51-75'
                    WHEN score >= 76 AND score <= 100 THEN '76-100'
                END as bucket,
                COUNT(*) as count
            FROM interacts
            WHERE item_id IN (SELECT id FROM task_items)
            AND score IS NOT NULL
            GROUP BY 
                CASE 
                    WHEN score >= 0 AND score <= 25 THEN '0-25'
                    WHEN score >= 26 AND score <= 50 THEN '26-50'
                    WHEN score >= 51 AND score <= 75 THEN '51-75'
                    WHEN score >= 76 AND score <= 100 THEN '76-100'
                END
        ),
        all_buckets AS (
            SELECT '0-25' as bucket UNION ALL
            SELECT '26-50' UNION ALL
            SELECT '51-75' UNION ALL
            SELECT '76-100'
        )
        SELECT ab.bucket, COALESCE(sc.count, 0) as count
        FROM all_buckets ab
        LEFT JOIN score_counts sc ON ab.bucket = sc.bucket
        ORDER BY ab.bucket
    """)
    
    result = await session.exec(query.bindparams(lab_title_pattern=_get_lab_title_pattern(lab)))
    rows = result.all()
    
    return [{"bucket": row[0], "count": int(row[1])} for row in rows]


@router.get("/pass-rates")
async def get_pass_rates(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
    api_key: str = Depends(verify_api_key),
):
    """Per-task pass rates for a given lab.

    - Find the lab item and its child task items
    - For each task, compute:
      - avg_score: average of interaction scores (round to 1 decimal)
      - attempts: total number of interactions
    - Return a JSON array:
      [{"task": "Repository Setup", "avg_score": 92.3, "attempts": 150}, ...]
    - Order by task title
    """
    query = text("""
        WITH lab_item AS (
            SELECT id FROM item 
            WHERE type = 'lab' AND title LIKE :lab_title_pattern
        ),
        task_items AS (
            SELECT id, title FROM item 
            WHERE parent_id IN (SELECT id FROM lab_item)
        )
        SELECT 
            t.title as task,
            ROUND(AVG(i.score), 1) as avg_score,
            COUNT(i.id) as attempts
        FROM task_items t
        LEFT JOIN interacts i ON t.id = i.item_id
        GROUP BY t.id, t.title
        ORDER BY t.title
    """)
    
    result = await session.exec(query.bindparams(lab_title_pattern=_get_lab_title_pattern(lab)))
    rows = result.all()
    
    return [
        {
            "task": row[0],
            "avg_score": float(row[1]) if row[1] is not None else 0.0,
            "attempts": int(row[2])
        }
        for row in rows
    ]


@router.get("/timeline")
async def get_timeline(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
    api_key: str = Depends(verify_api_key),
):
    """Submissions per day for a given lab.

    - Find the lab item and its child task items
    - Group interactions by date (use func.date(created_at))
    - Count the number of submissions per day
    - Return a JSON array:
      [{"date": "2026-02-28", "submissions": 45}, ...]
    - Order by date ascending
    """
    query = text("""
        WITH lab_item AS (
            SELECT id FROM item 
            WHERE type = 'lab' AND title LIKE :lab_title_pattern
        ),
        task_items AS (
            SELECT id FROM item 
            WHERE parent_id IN (SELECT id FROM lab_item)
            UNION
            SELECT id FROM lab_item
        )
        SELECT 
            DATE(created_at) as date,
            COUNT(id) as submissions
        FROM interacts
        WHERE item_id IN (SELECT id FROM task_items)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    """)
    
    result = await session.exec(query.bindparams(lab_title_pattern=_get_lab_title_pattern(lab)))
    rows = result.all()
    
    return [
        {"date": str(row[0]), "submissions": int(row[1])}
        for row in rows
    ]


@router.get("/groups")
async def get_groups(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
    api_key: str = Depends(verify_api_key),
):
    """Per-group performance for a given lab.

    - Find the lab item and its child task items
    - Join interactions with learners to get student_group
    - For each group, compute:
      - avg_score: average score (round to 1 decimal)
      - students: count of distinct learners
    - Return a JSON array:
      [{"group": "B23-CS-01", "avg_score": 78.5, "students": 25}, ...]
    - Order by group name
    """
    query = text("""
        WITH lab_item AS (
            SELECT id FROM item 
            WHERE type = 'lab' AND title LIKE :lab_title_pattern
        ),
        task_items AS (
            SELECT id FROM item 
            WHERE parent_id IN (SELECT id FROM lab_item)
            UNION
            SELECT id FROM lab_item
        )
        SELECT 
            l.student_group as "group",
            ROUND(AVG(i.score), 1) as avg_score,
            COUNT(DISTINCT l.id) as students
        FROM interacts i
        JOIN learner l ON i.learner_id = l.id
        WHERE i.item_id IN (SELECT id FROM task_items)
        GROUP BY l.student_group
        ORDER BY l.student_group
    """)
    
    result = await session.exec(query.bindparams(lab_title_pattern=_get_lab_title_pattern(lab)))
    rows = result.all()
    
    return [
        {
            "group": row[0],
            "avg_score": float(row[1]) if row[1] is not None else 0.0,
            "students": int(row[2])
        }
        for row in rows
    ]
