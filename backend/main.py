import logging
import pathlib
import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s %(message)s",
)
logger = logging.getLogger("panicplan")

logging.getLogger("pdfminer").setLevel(logging.ERROR)

load_dotenv()

from sqlalchemy.orm import Session

from database import engine, get_db
import models
from config import CORS_ORIGINS, CORS_HEADERS
from routers import auth, users, plans, sessions, lessons, streaming, chat, upload

models.Base.metadata.create_all(bind=engine)


def _migrate():
    """Add columns/tables introduced after initial schema (safe to re-run)."""
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE study_sessions ADD COLUMN user_note TEXT",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
                logger.info("Migration applied: %s", stmt[:60])
            except Exception as exc:
                if "duplicate column" not in str(exc).lower():
                    logger.debug("Migration skipped (%s): %s", type(exc).__name__, stmt[:60])


_migrate()


def _apply_sql_migrations():
    if engine.dialect.name != "postgresql":
        return
    migrations_dir = pathlib.Path(__file__).parent / "migrations"
    for sql_file in sorted(migrations_dir.glob("*.sql")):
        raw_conn = engine.raw_connection()
        try:
            cursor = raw_conn.cursor()
            cursor.execute(sql_file.read_text())
            raw_conn.commit()
            logger.info("SQL migration applied: %s", sql_file.name)
        except Exception:
            raw_conn.rollback()
            logger.exception("SQL migration failed: %s", sql_file.name)
        finally:
            raw_conn.close()


_apply_sql_migrations()

app = FastAPI(title="PanicPlan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "%s %s → %s",
        request.method,
        request.url.path,
        response.status_code,
        extra={"request_id": request_id},
    )
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    msg = str(exc)
    if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
        return JSONResponse(
            status_code=429,
            content={"detail": "AI quota exceeded — please wait a moment and try again."},
            headers=CORS_HEADERS,
        )
    if "INVALID_ARGUMENT" in msg and "API key" in msg:
        return JSONResponse(
            status_code=400,
            content={"detail": "AI API key is not configured on the server."},
            headers=CORS_HEADERS,
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=CORS_HEADERS,
    )


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(plans.router)
app.include_router(sessions.router)
app.include_router(lessons.router)
app.include_router(streaming.router)
app.include_router(chat.router)
app.include_router(upload.router)
