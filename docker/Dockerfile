FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn pydantic requests

RUN python - <<'PY'
from pathlib import Path
Path('app.py').write_text('''\
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="AICWD Model Runner", version="1.0")

class GenerateRequest(BaseModel):
    prompts: List[str]

@app.get("/")
def root():
    return {"status": "ok", "service": "aicwd-model-runner"}

@app.post("/generate")
def generate(req: GenerateRequest):
    generated = []
    for p in req.prompts:
        p = (p or "").strip()
        if not p:
            continue
        generated.append(f"AUGMENTED: {p}")
    return {"generated_prompts": generated}
''')
PY

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
