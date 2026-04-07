"""
Training script for ML Red Team Model
Usage: python train.py [--synthetic] [--database]
"""

import argparse
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import db_config, model_config
from database import db_manager
from processor import trainer
from model import model


async def train_with_database():
    """Train model using existing labeled data from database"""
    print("=" * 60)
    print("Training from Database")
    print("=" * 60)
    
    # Initialize database
    await db_manager.init_pool()
    
    try:
        success = await trainer.train_from_database(min_samples=100)
        if success:
            print("\nTraining complete!")
            print(f"Model saved to: {model_config.model_dir}")
            
            # Print feature importance
            importance = model.get_feature_importance()
            if importance:
                print("\nTop Features by Risk Type:")
                for risk, feats in importance.items():
                    print(f"\n{risk}:")
                    for name, imp in feats[:5]:
                        print(f"  - {name}: {imp:.4f}")
        else:
            print("\nTraining failed - insufficient data")
            return 1
    finally:
        await db_manager.close_pool()
    
    return 0


def train_with_synthetic():
    """Train model using synthetic attack patterns"""
    print("=" * 60)
    print("Training with Synthetic Data")
    print("=" * 60)
    
    success = trainer.train_with_synthetic_data()
    if success:
        print("\nTraining complete!")
        print(f"Model saved to: {model_config.model_dir}")
        
        # Print feature importance
        importance = model.get_feature_importance()
        if importance:
            print("\nTop Features by Risk Type:")
            for risk, feats in importance.items():
                print(f"\n{risk}:")
                for name, imp in feats[:5]:
                    print(f"  - {name}: {imp:.4f}")
        return 0
    else:
        print("\nTraining failed")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Train ML Red Team Model"
    )
    parser.add_argument(
        "--database", 
        action="store_true",
        help="Train using labeled data from database"
    )
    parser.add_argument(
        "--synthetic", 
        action="store_true",
        help="Train using synthetic attack patterns (default)"
    )
    parser.add_argument(
        "--model-dir",
        type=str,
        default=None,
        help="Directory to save model artifacts"
    )
    parser.add_argument(
        "--version",
        type=str,
        default=None,
        help="Model version tag"
    )
    
    args = parser.parse_args()
    
    # Override config if provided
    if args.model_dir:
        model_config.model_dir = args.model_dir
    if args.version:
        model_config.model_version = args.version
    
    # Determine training mode
    if args.database:
        exit_code = asyncio.run(train_with_database())
    else:
        # Default to synthetic training
        exit_code = train_with_synthetic()
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
