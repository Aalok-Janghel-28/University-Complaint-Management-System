import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score

from .constants import CATEGORIES, INTENTS, PRIORITIES, SENTIMENTS
from .preprocessor import build_document

BATCH_SIZE = 50_000
FEATURES = 2**18


class ComplaintModelTrainer:
    def __init__(self, models_dir: Path, data_path: Path):
        self.models_dir = models_dir
        self.data_path = data_path
        self.models_dir.mkdir(parents=True, exist_ok=True)

        self.vectorizer = HashingVectorizer(
            n_features=FEATURES,
            alternate_sign=False,
            norm='l2',
            lowercase=True,
            ngram_range=(1, 2),
        )
        self.category_model = SGDClassifier(loss='log_loss', random_state=42, max_iter=1000, tol=1e-3)
        self.priority_model = SGDClassifier(loss='log_loss', random_state=43, max_iter=1000, tol=1e-3)
        self.sentiment_model = SGDClassifier(loss='log_loss', random_state=44, max_iter=1000, tol=1e-3)
        self.intent_model = SGDClassifier(loss='log_loss', random_state=45, max_iter=1000, tol=1e-3)

        self.category_initialized = False
        self.priority_initialized = False
        self.sentiment_initialized = False
        self.intent_initialized = False

    def _transform(self, texts: list[str]):
        return self.vectorizer.transform(texts)

    def _partial_train(self, model, initialized: bool, texts: list[str], labels: list[str], classes: list[str]):
        if not texts:
            return initialized, None

        matrix = self._transform(texts)
        label_array = np.array(labels)
        if not initialized:
            model.partial_fit(matrix, label_array, classes=classes)
            preds = model.predict(matrix)
            return True, float(accuracy_score(label_array, preds))

        model.partial_fit(matrix, label_array)
        preds = model.predict(matrix)
        return True, float(accuracy_score(label_array, preds))

    def train_from_csv(self, max_samples: int | None = None) -> dict:
        if not self.data_path.exists():
            raise FileNotFoundError(f'Training data not found at {self.data_path}')

        processed = 0
        category_scores: list[float] = []
        priority_scores: list[float] = []
        sentiment_scores: list[float] = []
        intent_scores: list[float] = []

        complaint_texts: list[str] = []
        complaint_categories: list[str] = []
        complaint_priorities: list[str] = []
        complaint_sentiments: list[str] = []

        chat_texts: list[str] = []
        chat_intents: list[str] = []

        with self.data_path.open('r', encoding='utf-8', newline='') as csv_file:
            reader = csv.DictReader(csv_file)
            for row in reader:
                if max_samples is not None and processed >= max_samples:
                    break

                text = build_document(row.get('title', ''), row.get('description', ''), row.get('text', ''))
                record_type = row.get('record_type', 'complaint')

                if record_type == 'chat':
                    chat_texts.append(text or row.get('text', ''))
                    chat_intents.append(row.get('intent') or 'general_help')
                else:
                    complaint_texts.append(text)
                    complaint_categories.append(row.get('category') or 'general')
                    complaint_priorities.append(row.get('priority') or 'medium')
                    complaint_sentiments.append(row.get('sentiment') or 'neutral')

                processed += 1

                if len(complaint_texts) >= BATCH_SIZE:
                    self.category_initialized, score = self._partial_train(
                        self.category_model, self.category_initialized, complaint_texts, complaint_categories, CATEGORIES
                    )
                    if score is not None:
                        category_scores.append(score)

                    self.priority_initialized, score = self._partial_train(
                        self.priority_model, self.priority_initialized, complaint_texts, complaint_priorities, PRIORITIES
                    )
                    if score is not None:
                        priority_scores.append(score)

                    self.sentiment_initialized, score = self._partial_train(
                        self.sentiment_model, self.sentiment_initialized, complaint_texts, complaint_sentiments, SENTIMENTS
                    )
                    if score is not None:
                        sentiment_scores.append(score)

                    complaint_texts, complaint_categories, complaint_priorities, complaint_sentiments = [], [], [], []

                if len(chat_texts) >= BATCH_SIZE:
                    self.intent_initialized, score = self._partial_train(
                        self.intent_model, self.intent_initialized, chat_texts, chat_intents, INTENTS
                    )
                    if score is not None:
                        intent_scores.append(score)
                    chat_texts, chat_intents = [], []

        if complaint_texts:
            self.category_initialized, score = self._partial_train(
                self.category_model, self.category_initialized, complaint_texts, complaint_categories, CATEGORIES
            )
            if score is not None:
                category_scores.append(score)
            self.priority_initialized, score = self._partial_train(
                self.priority_model, self.priority_initialized, complaint_texts, complaint_priorities, PRIORITIES
            )
            if score is not None:
                priority_scores.append(score)
            self.sentiment_initialized, score = self._partial_train(
                self.sentiment_model, self.sentiment_initialized, complaint_texts, complaint_sentiments, SENTIMENTS
            )
            if score is not None:
                sentiment_scores.append(score)

        if chat_texts:
            self.intent_initialized, score = self._partial_train(
                self.intent_model, self.intent_initialized, chat_texts, chat_intents, INTENTS
            )
            if score is not None:
                intent_scores.append(score)

        if not self.category_initialized:
            raise RuntimeError('No complaint records found for training.')

        metadata = self.save_models(
            samples_trained=processed,
            category_accuracy=round(float(np.mean(category_scores)) if category_scores else 0.0, 4),
            priority_accuracy=round(float(np.mean(priority_scores)) if priority_scores else 0.0, 4),
            sentiment_accuracy=round(float(np.mean(sentiment_scores)) if sentiment_scores else 0.0, 4),
            intent_accuracy=round(float(np.mean(intent_scores)) if intent_scores else 0.0, 4),
        )
        return metadata

    def save_models(self, **metrics) -> dict:
        joblib.dump(self.category_model, self.models_dir / 'category_model.joblib')
        joblib.dump(self.priority_model, self.models_dir / 'priority_model.joblib')
        joblib.dump(self.sentiment_model, self.models_dir / 'sentiment_model.joblib')
        joblib.dump(self.intent_model, self.models_dir / 'intent_model.joblib')
        joblib.dump(self.vectorizer, self.models_dir / 'vectorizer.joblib')

        metadata = {
            'version': datetime.now(timezone.utc).strftime('v%Y%m%d.%H%M%S'),
            'trained_at': datetime.now(timezone.utc).isoformat(),
            'samples_trained': metrics.get('samples_trained', 0),
            'category_accuracy': metrics.get('category_accuracy', 0.0),
            'priority_accuracy': metrics.get('priority_accuracy', 0.0),
            'sentiment_accuracy': metrics.get('sentiment_accuracy', 0.0),
            'intent_accuracy': metrics.get('intent_accuracy', 0.0),
            'feature_space': FEATURES,
            'algorithm': 'HashingVectorizer + SGDClassifier (incremental)',
        }
        registry_path = self.models_dir / 'registry.json'
        registry_path.write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        return metadata
