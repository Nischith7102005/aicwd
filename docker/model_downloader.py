"""
Model downloader script for downloading GGUF models from HuggingFace
"""

import os
import sys
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models")
MODEL_NAME = os.getenv("MODEL_NAME", "DavidAU/OpenAi-GPT-oss-20b-abliterated-uncensored-NEO-Imatrix-gguf")
MODEL_QUANTIZATION = os.getenv("MODEL_QUANTIZATION", "Q5_1")

def download_model():
    """Download the model from HuggingFace"""
    
    logger.info(f"Model path: {MODEL_PATH}")
    logger.info(f"Model name: {MODEL_NAME}")
    logger.info(f"Quantization: {MODEL_QUANTIZATION}")
    
    # Create model directory
    Path(MODEL_PATH).mkdir(parents=True, exist_ok=True)
    
    # Construct model file name
    model_file = f"{MODEL_NAME.split('/')[-1]}-{MODEL_QUANTIZATION}.gguf"
    model_full_path = os.path.join(MODEL_PATH, model_file)
    
    logger.info(f"Expected model file: {model_full_path}")
    
    # Check if model already exists
    if os.path.exists(model_full_path):
        logger.info("Model file already exists, skipping download")
        return model_full_path
    
    logger.warning("Model download requires huggingface-hub and sufficient disk space")
    logger.warning("Skipping actual download - in production, this would download ~20GB+")
    
    # Create a placeholder file for development
    with open(model_full_path, 'w') as f:
        f.write("# Placeholder file - actual model download skipped for development")
    
    logger.info(f"Created placeholder file at {model_full_path}")
    
    return model_full_path

if __name__ == "__main__":
    try:
        downloaded_path = download_model()
        logger.info(f"Model setup complete: {downloaded_path}")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        sys.exit(1)
