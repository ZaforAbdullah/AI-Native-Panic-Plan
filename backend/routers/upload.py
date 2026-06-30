import logging

from fastapi import APIRouter, HTTPException, UploadFile, File
from starlette.concurrency import run_in_threadpool

from services import pdf_analyzer

logger = logging.getLogger("panicplan.upload")
router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 25 MB).")

    try:
        # run_in_threadpool offloads the blocking LangChain + pdfplumber call to a
        # thread so it doesn't block uvicorn's async event loop
        result = await run_in_threadpool(pdf_analyzer.analyze, contents)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as exc:
        logger.error("PDF analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail="Analysis failed. Please try again.")
