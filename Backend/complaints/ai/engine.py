import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings

from complaints.models import Complaint

from .chatbot import build_chat_response
from .constants import CATEGORIES, CATEGORY_DEPARTMENT_MAP, INTENTS, PRIORITIES, SENTIMENTS
from .preprocessor import build_document, normalize_text


class ComplaintAIEngine:
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.registry = self._load_registry()
        self.models_loaded = False
        self.vectorizer = None
        self.category_model = None
        self.priority_model = None
        self.sentiment_model = None
        self.intent_model = None
        self._load_models()

    def _load_registry(self) -> dict:
        registry_path = self.models_dir / 'registry.json'
        if not registry_path.exists():
            return {}
        return json.loads(registry_path.read_text(encoding='utf-8'))

    def _load_models(self):
        required = [
            'vectorizer.joblib',
            'category_model.joblib',
            'priority_model.joblib',
            'sentiment_model.joblib',
            'intent_model.joblib',
        ]
        if not all((self.models_dir / filename).exists() for filename in required):
            return

        self.vectorizer = joblib.load(self.models_dir / 'vectorizer.joblib')
        self.category_model = joblib.load(self.models_dir / 'category_model.joblib')
        self.priority_model = joblib.load(self.models_dir / 'priority_model.joblib')
        self.sentiment_model = joblib.load(self.models_dir / 'sentiment_model.joblib')
        self.intent_model = joblib.load(self.models_dir / 'intent_model.joblib')
        self.models_loaded = True

    def is_ready(self) -> bool:
        return self.models_loaded

    def get_status(self) -> dict:
        return {
            'ready': self.models_loaded,
            'registry': self.registry,
            'supported_categories': CATEGORIES,
            'supported_priorities': PRIORITIES,
        }

    def _predict(self, model, text: str, labels: list[str]) -> tuple[str, float]:
        matrix = self.vectorizer.transform([text])
        if hasattr(model, 'predict_proba'):
            probabilities = model.predict_proba(matrix)[0]
            index = int(np.argmax(probabilities))
            if hasattr(model, 'classes_'):
                label = model.classes_[index]
            else:
                label = labels[index]
            confidence = float(probabilities[index])
            return label, confidence

        prediction = model.predict(matrix)[0]
        return prediction, 0.65

    def _sentiment_to_score(self, sentiment: str) -> float:
        mapping = {'negative': 0.85, 'neutral': 0.5, 'positive': 0.2}
        return mapping.get(sentiment, 0.5)

    def _risk_score(self, priority: str, sentiment: str, confidence: float) -> int:
        base = {
            'low': 20,
            'medium': 40,
            'high': 65,
            'critical': 85,
        }.get(priority, 35)
        if sentiment == 'negative':
            base += 10
        if confidence > 0.8:
            base += 5
        return int(min(100, max(5, base)))

    def _recommendations(self, category: str, priority: str) -> list[str]:
        department = CATEGORY_DEPARTMENT_MAP.get(category, 'General Services')
        return [
            f'Route this complaint to the {department} department.',
            f'Set priority to {priority.replace("_", " ")} based on AI triage.',
            'Attach location evidence and update the citizen within the active SLA window.',
            'Escalate automatically if no action is taken within 24 hours for high/critical issues.',
        ]

    def _summary(self, title: str, category: str, priority: str, sentiment: str, confidence: float) -> str:
        return (
            f'AI classified "{title}" as {category.replace("_", " ")} with {priority} priority. '
            f'Sentiment signal: {sentiment}. Model confidence: {confidence:.0%}.'
        )

    def _rule_based_analyze(self, title: str, description: str) -> dict:
        text = normalize_text(f'{title} {description}')
        category = 'general'
        priority = 'medium'
        sentiment = 'neutral'

        keyword_map = {
            'water_supply': ['water', 'tap', 'pipe', 'supply'],
            'electricity': ['electric', 'power', 'light', 'voltage'],
            'road': ['road', 'pothole', 'traffic', 'footpath'],
            'sanitation': ['sanitation', 'washroom', 'toilet', 'clean'],
            'waste_management': ['garbage', 'waste', 'trash'],
            'public_safety': ['security', 'theft', 'unsafe', 'safety'],
            'healthcare': ['medical', 'health', 'clinic'],
            'education': ['classroom', 'internet', 'exam', 'lab'],
        }
        for cat, words in keyword_map.items():
            if any(word in text for word in words):
                category = cat
                break

        if any(word in text for word in ['urgent', 'critical', 'immediate', 'emergency']):
            priority = 'critical'
        elif any(word in text for word in ['not working', 'outage', 'stopped', 'overflow']):
            priority = 'high'

        if any(word in text for word in ['unsafe', 'urgent', 'not working', 'overflow', 'outage']):
            sentiment = 'negative'

        confidence = 0.55
        return self._build_analysis(title, description, category, priority, sentiment, confidence)

    def _build_analysis(self, title: str, description: str, category: str, priority: str, sentiment: str, confidence: float) -> dict:
        summary = self._summary(title or 'Complaint', category, priority, sentiment, confidence)
        return {
            'category': category,
            'priority': priority,
            'sentiment': sentiment,
            'sentiment_score': self._sentiment_to_score(sentiment),
            'confidence': round(confidence, 4),
            'summary': summary,
            'risk_score': self._risk_score(priority, sentiment, confidence),
            'recommended_department': CATEGORY_DEPARTMENT_MAP.get(category, 'General Services'),
            'recommendations': self._recommendations(category, priority),
            'model_version': self.registry.get('version', 'rule-based-fallback'),
        }

    def analyze_text(self, title: str = '', description: str = '', location: str = '') -> dict:
        document = build_document(title, description, location)
        if not document:
            return self._build_analysis(title, description, 'general', 'medium', 'neutral', 0.4)

        if not self.models_loaded:
            return self._rule_based_analyze(title, description)

        category, category_conf = self._predict(self.category_model, document, CATEGORIES)
        priority, priority_conf = self._predict(self.priority_model, document, PRIORITIES)
        sentiment, sentiment_conf = self._predict(self.sentiment_model, document, SENTIMENTS)
        confidence = float(np.mean([category_conf, priority_conf, sentiment_conf]))
        return self._build_analysis(title, description, category, priority, sentiment, confidence)

    def analyze_complaint(self, complaint: Complaint) -> dict:
        analysis = self.analyze_text(complaint.title, complaint.description, complaint.location)
        analysis['complaint_id'] = complaint.id
        analysis['ticket_id'] = complaint.ticket_id
        return analysis

    def chat(self, message: str) -> dict:
        text = normalize_text(message)
        if not text:
            return build_chat_response('general_help', 0.4, message)

        if not self.models_loaded:
            return self._rule_based_chat(message)

        intent, confidence = self._predict(self.intent_model, text, INTENTS)
        return build_chat_response(intent, confidence, message)

    def _rule_based_chat(self, message: str) -> dict:
        text = normalize_text(message)
        if text in {'hi', 'hello', 'hey'} or text.startswith('good '):
            return build_chat_response('greeting', 0.7, message)
        if any(word in text for word in ['water', 'tap', 'pipe']):
            return build_chat_response('water_issue', 0.65, message)
        if any(word in text for word in ['electric', 'power', 'light']):
            return build_chat_response('electricity_issue', 0.65, message)
        if any(word in text for word in ['road', 'pothole', 'traffic']):
            return build_chat_response('road_issue', 0.65, message)
        if any(word in text for word in ['garbage', 'waste', 'sanitation']):
            return build_chat_response('sanitation_issue', 0.65, message)
        if any(word in text for word in ['security', 'safety', 'theft']):
            return build_chat_response('safety_issue', 0.65, message)
        if any(word in text for word in ['status', 'progress', 'where']):
            return build_chat_response('status_check', 0.65, message)
        if any(word in text for word in ['sla', 'escalate', 'urgent']):
            return build_chat_response('sla_escalation', 0.65, message)
        if any(word in text for word in ['resolve', 'close', 'feedback']):
            return build_chat_response('resolution_help', 0.65, message)
        return build_chat_response('general_help', 0.5, message)


@lru_cache(maxsize=1)
def get_ai_engine() -> ComplaintAIEngine:
    models_dir = Path(settings.AI_MODELS_DIR)
    return ComplaintAIEngine(models_dir)
