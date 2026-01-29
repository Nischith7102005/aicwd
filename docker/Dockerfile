FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Create a simple FastAPI app for prompt generation/augmentation
RUN echo 'from fastapi import FastAPI, HTTPException\n\
from pydantic import BaseModel\n\
from typing import List\n\
import uvicorn\n\
\n\
app = FastAPI()\n\
\n\
class PromptRequest(BaseModel):\n\
    prompts: List[str]\n\
\n\
@app.get("/")\n\
def read_root():\n\
    return {"status": "AICWD Adversarial Model Runner Active"}\n\
\n\
@app.post("/generate")\n\
async def generate_prompts(request: PromptRequest):\n\
    # Simulating uncensored model augmentation\n\
    augmented = [f"AUGMENTED: {p}" for p in request.prompts]\n\
    return {"generated_prompts": augmented}\n\
\n\
if __name__ == "__main__":\n\
    uvicorn.run(app, host="0.0.0.0", port=8000)\n\
' > app.py

# Placeholder for actual model download logic
# RUN python3 -c "from transformers import AutoModel; AutoModel.from_pretrained('DavidAU/OpenAi-GPT-oss-20b-abliterated-uncensored-NEO-Imatrix-gguf')"

EXPOSE 8000

CMD ["python3", "app.py"]
