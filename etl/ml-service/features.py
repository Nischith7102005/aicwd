"""
Feature extraction module for Red Team ML model
"""

import re
import hashlib
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import numpy as np
from collections import Counter
import warnings

warnings.filterwarnings("ignore")


@dataclass
class TextFeatures:
    """Extracted text features from prompt and response"""
    
    # Length features
    prompt_length: int = 0
    response_length: int = 0
    prompt_word_count: int = 0
    response_word_count: int = 0
    
    # Ratio features
    response_to_prompt_ratio: float = 0.0
    token_efficiency: float = 0.0
    
    # Character patterns
    uppercase_ratio: float = 0.0
    special_char_ratio: float = 0.0
    digit_ratio: float = 0.0
    
    # Linguistic markers
    hedging_count: int = 0
    certainty_count: int = 0
    question_count: int = 0
    imperative_count: int = 0
    
    # Security indicators
    encoding_indicators: int = 0
    delimiter_count: int = 0
    quote_mismatch: bool = False
    
    # Structural features
    newline_count: int = 0
    bullet_count: int = 0
    code_block_count: int = 0


# Known attack pattern keywords (from red_team_schema.sql)
ATTACK_PATTERNS = {
    "instruction_override": [
        "ignore previous instructions", "disregard all prior rules", 
        "forget everything above", "ignore the above"
    ],
    "jailbreak": [
        "DAN mode", "do anything now", "unrestricted mode", 
        "developer mode", "admin mode", "sudo mode"
    ],
    "role_manipulation": [
        "pretend you are", "act as if", "you are now", 
        "roleplay as", "imagine you are"
    ],
    "data_exfiltration": [
        "reveal your system prompt", "show me your instructions",
        "what are your rules", "system instructions", "your training data"
    ],
    "instruction_injection": [
        "SYSTEM:", "new instruction:", "override:", 
        "=== SYSTEM ===", "[SYSTEM]"
    ],
    "context_manipulation": [
        "this is just a test", "hypothetical scenario", 
        "for educational purposes", "in a fictional world"
    ],
    "social_engineering": [
        "i really need this", "nobody will know", 
        "trust me", "i'm an admin", "emergency"
    ],
    "recursion_loop": [
        "repeat forever", "never stop", "infinite loop",
        "while true", "keep going"
    ],
    "encoding_obfuscation": [
        "base64", "atob", "btoa", "decode", "encode",
        "hex", "unicode", "escape", "unescape"
    ],
}

HEDGING_WORDS = [
    "maybe", "perhaps", "possibly", "might", "could be",
    "i think", "probably", "likely", "seems", "appears",
    "suggests", "indicates", "may", "could", "would"
]

CERTAINTY_WORDS = [
    "certainly", "definitely", "absolutely", "undoubtedly",
    "always", "never", "all", "none", "every", "must",
    "will", "shall", "guaranteed"
]

IMPERATIVE_WORDS = [
    "ignore", "disregard", "forget", "reveal", "show",
    "provide", "give", "list", "output", "print",
    "execute", "run", "perform", "do", "create"
]


class FeatureExtractor:
    """Extract features from LLM events for Red Team ML model"""
    
    def __init__(self):
        self.attack_pattern_regex = self._compile_attack_patterns()
    
    def _compile_attack_patterns(self) -> Dict[str, re.Pattern]:
        """Compile attack pattern regexes"""
        patterns = {}
        for category, keywords in ATTACK_PATTERNS.items():
            # Create regex that matches any of the keywords (case insensitive)
            escaped = [re.escape(k) for k in keywords]
            pattern = r'(' + '|'.join(escaped) + r')'
            patterns[category] = re.compile(pattern, re.IGNORECASE)
        return patterns
    
    def extract_text_features(self, prompt: str, response: Optional[str] = None) -> TextFeatures:
        """Extract text-based features"""
        features = TextFeatures()
        
        prompt = prompt or ""
        response = response or ""
        
        # Length features
        features.prompt_length = len(prompt)
        features.response_length = len(response)
        features.prompt_word_count = len(prompt.split())
        features.response_word_count = len(response.split())
        
        # Ratio features
        if features.prompt_length > 0:
            features.response_to_prompt_ratio = features.response_length / features.prompt_length
        
        # Character analysis
        if prompt:
            features.uppercase_ratio = sum(1 for c in prompt if c.isupper()) / len(prompt)
            features.special_char_ratio = sum(1 for c in prompt if not c.isalnum() and not c.isspace()) / len(prompt)
            features.digit_ratio = sum(1 for c in prompt if c.isdigit()) / len(prompt)
        
        # Linguistic markers
        prompt_lower = prompt.lower()
        response_lower = response.lower()
        
        features.hedging_count = sum(1 for word in HEDGING_WORDS if word in response_lower)
        features.certainty_count = sum(1 for word in CERTAINTY_WORDS if word in response_lower)
        features.question_count = prompt.count("?")
        features.imperative_count = sum(1 for word in IMPERATIVE_WORDS if word in prompt_lower)
        
        # Security indicators
        encoding_pattern = r'(\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|%[0-9a-fA-F]{2}|base64|atob|eval)'
        features.encoding_indicators = len(re.findall(encoding_pattern, prompt, re.IGNORECASE))
        features.delimiter_count = prompt.count("---") + prompt.count("===") + prompt.count("```")
        
        # Quote matching
        single_quotes = prompt.count("'")
        double_quotes = prompt.count('"')
        features.quote_mismatch = (single_quotes % 2 != 0) or (double_quotes % 2 != 0)
        
        # Structural features
        features.newline_count = prompt.count("\n")
        features.bullet_count = prompt.count("-") + prompt.count("*") + prompt.count("•")
        features.code_block_count = prompt.count("```")
        
        return features
    
    def extract_attack_pattern_features(self, prompt: str) -> Dict[str, float]:
        """Extract attack pattern match features"""
        prompt_lower = prompt.lower()
        features = {}
        
        for category, pattern in self.attack_pattern_regex.items():
            matches = len(pattern.findall(prompt))
            features[f"pattern_{category}"] = min(matches, 5)  # Cap at 5
            features[f"pattern_{category}_binary"] = 1.0 if matches > 0 else 0.0
        
        # Calculate overall pattern density
        total_matches = sum(features[f"pattern_{cat}"] for cat in ATTACK_PATTERNS.keys())
        word_count = max(len(prompt.split()), 1)
        features["pattern_density"] = total_matches / word_count * 100
        
        return features
    
    def extract_leakage_features(self, response: str) -> Dict[str, float]:
        """Extract data leakage indicators from response"""
        response = response or ""
        features = {}
        
        # API key patterns
        api_key_pattern = r'(sk-[a-zA-Z0-9]{32,}|api[_-]?key|apikey|secret[_-]?key)'
        features["leak_api_key"] = 1.0 if re.search(api_key_pattern, response, re.IGNORECASE) else 0.0
        
        # Internal IP patterns
        internal_ip_pattern = r'(10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3})'
        features["leak_internal_ip"] = 1.0 if re.search(internal_ip_pattern, response) else 0.0
        
        # Credential patterns
        cred_pattern = r'(password|secret|token|credential|auth)\s*[=:]\s*["\']?[^\s"\']+'
        features["leak_credential"] = 1.0 if re.search(cred_pattern, response, re.IGNORECASE) else 0.0
        
        # PII patterns
        features["leak_ssn"] = 1.0 if re.search(r'\b\d{3}[-.]?\d{2}[-.]?\d{4}\b', response) else 0.0
        features["leak_email"] = 1.0 if re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', response) else 0.0
        features["leak_phone"] = 1.0 if re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', response) else 0.0
        
        # System info patterns
        sys_pattern = r'(system prompt|training data|model weights|architecture|instructions)'
        features["leak_system_info"] = 1.0 if re.search(sys_pattern, response, re.IGNORECASE) else 0.0
        
        return features
    
    def extract_hallucination_features(self, prompt: str, response: str) -> Dict[str, float]:
        """Extract hallucination risk indicators"""
        response = response or ""
        prompt = prompt or ""
        features = {}
        
        response_lower = response.lower()
        
        # Hedging words indicate uncertainty
        hedging_count = sum(1 for word in HEDGING_WORDS if word in response_lower)
        features["hallucination_hedging_ratio"] = hedging_count / max(len(response.split()), 1)
        
        # Certainty words can indicate overconfidence
        certainty_count = sum(1 for word in CERTAINTY_WORDS if word in response_lower)
        features["hallucination_certainty_ratio"] = certainty_count / max(len(response.split()), 1)
        
        # Response length relative to prompt
        prompt_len = max(len(prompt), 1)
        features["response_length_ratio"] = len(response) / prompt_len
        
        # Factual claim indicators
        fact_indicators = ["is a", "was a", "are a", "were a", "has been", "have been"]
        fact_count = sum(1 for ind in fact_indicators if ind in response_lower)
        features["factual_claim_density"] = fact_count / max(len(response.split()), 1)
        
        # Unverifiable statements
        unverifiable = ["i believe", "in my opinion", "many people", "some say", "it is said"]
        unver_count = sum(1 for u in unverifiable if u in response_lower)
        features["unverifiable_ratio"] = unver_count / max(len(response.split()), 1)
        
        return features
    
    def extract_temporal_features(
        self, 
        latency_ms: int, 
        input_tokens: int, 
        output_tokens: int
    ) -> Dict[str, float]:
        """Extract temporal and token-based features"""
        features = {}
        
        features["latency_seconds"] = latency_ms / 1000.0
        features["tokens_per_second"] = output_tokens / max(latency_ms / 1000.0, 0.001)
        features["token_efficiency"] = output_tokens / max(input_tokens, 1)
        features["total_tokens"] = input_tokens + output_tokens
        features["input_output_ratio"] = input_tokens / max(output_tokens, 1)
        
        return features
    
    def extract_all_features(
        self,
        prompt: str,
        response: Optional[str] = None,
        provider: str = "",
        model: str = "",
        latency_ms: int = 0,
        input_tokens: int = 0,
        output_tokens: int = 0,
        is_adversarial: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """Extract all features for ML model input"""
        
        # Text features
        text_feats = self.extract_text_features(prompt, response)
        
        # Attack patterns
        attack_feats = self.extract_attack_pattern_features(prompt)
        
        # Leakage features
        leakage_feats = self.extract_leakage_features(response)
        
        # Hallucination features
        halluc_feats = self.extract_hallucination_features(prompt, response)
        
        # Temporal features
        temporal_feats = self.extract_temporal_features(latency_ms, input_tokens, output_tokens)
        
        # Combine all features
        features = {
            # Text features
            "prompt_length": text_feats.prompt_length,
            "response_length": text_feats.response_length,
            "prompt_word_count": text_feats.prompt_word_count,
            "response_word_count": text_feats.response_word_count,
            "response_to_prompt_ratio": text_feats.response_to_prompt_ratio,
            "uppercase_ratio": text_feats.uppercase_ratio,
            "special_char_ratio": text_feats.special_char_ratio,
            "digit_ratio": text_feats.digit_ratio,
            "hedging_count": text_feats.hedging_count,
            "certainty_count": text_feats.certainty_count,
            "question_count": text_feats.question_count,
            "imperative_count": text_feats.imperative_count,
            "encoding_indicators": text_feats.encoding_indicators,
            "delimiter_count": text_feats.delimiter_count,
            "quote_mismatch": 1.0 if text_feats.quote_mismatch else 0.0,
            "newline_count": text_feats.newline_count,
            "bullet_count": text_feats.bullet_count,
            "code_block_count": text_feats.code_block_count,
            
            # Attack patterns
            **attack_feats,
            
            # Leakage
            **leakage_feats,
            
            # Hallucination
            **halluc_feats,
            
            # Temporal
            **temporal_feats,
            
            # Metadata
            "is_adversarial": 1.0 if is_adversarial else 0.0,
        }
        
        # Encode provider and model as simple hash features
        features["provider_hash"] = int(hashlib.md5(provider.encode()).hexdigest(), 16) % 1000
        features["model_hash"] = int(hashlib.md5(model.encode()).hexdigest(), 16) % 1000
        
        return features
    
    def get_feature_names(self) -> List[str]:
        """Get list of feature names for model training"""
        sample = self.extract_all_features(
            prompt="sample prompt",
            response="sample response",
            provider="openai",
            model="gpt-4"
        )
        return list(sample.keys())


# Singleton instance
feature_extractor = FeatureExtractor()
