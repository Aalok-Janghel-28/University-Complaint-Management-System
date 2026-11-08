import csv
import random
from pathlib import Path

from .constants import CATEGORIES, INTENTS, PRIORITIES, SENTIMENTS

LOCATIONS = [
    'Hostel Block A', 'Hostel Block B', 'Main Campus Gate', 'Library Building',
    'Science Block', 'Administration Wing', 'Sports Complex', 'Cafeteria Area',
    'Parking Zone 2', 'Medical Center', 'Exam Hall Block', 'Student Center',
]

TITLE_TEMPLATES = {
    'water_supply': [
        'No water supply in {location} since {days} days',
        'Low water pressure near {location}',
        'Dirty tap water reported at {location}',
        'Water leakage in pipeline at {location}',
    ],
    'sanitation': [
        'Unclean washrooms at {location}',
        'Foul smell from drainage at {location}',
        'Sanitation staff not available in {location}',
    ],
    'road': [
        'Potholes on road near {location}',
        'Broken footpath at {location}',
        'Traffic congestion issue at {location}',
    ],
    'electricity': [
        'Power outage in {location}',
        'Street lights not working at {location}',
        'Frequent voltage fluctuation in {location}',
    ],
    'public_safety': [
        'Security concern at {location}',
        'Unsafe lighting at {location} during night',
        'Unauthorized access reported at {location}',
    ],
    'waste_management': [
        'Garbage overflow near {location}',
        'Waste bins not cleared at {location}',
    ],
    'healthcare': [
        'Medical center overcrowded at {location}',
        'First aid kit unavailable at {location}',
    ],
    'education': [
        'Classroom equipment broken in {location}',
        'Internet not working in {location}',
    ],
    'general': [
        'General maintenance required at {location}',
        'Service request for {location}',
    ],
}

DESCRIPTION_TEMPLATES = [
    'Students and staff are affected due to this issue for the past {days} days.',
    'The problem is causing daily inconvenience and needs urgent attention.',
    'Multiple complaints were received from {location} regarding this matter.',
    'This issue impacts safety and normal campus operations.',
    'Please inspect and resolve this as soon as possible.',
]

PRIORITY_BY_CATEGORY = {
    'water_supply': ['medium', 'high', 'critical'],
    'sanitation': ['medium', 'high'],
    'road': ['low', 'medium', 'high'],
    'electricity': ['medium', 'high', 'critical'],
    'public_safety': ['high', 'critical'],
    'waste_management': ['medium', 'high'],
    'healthcare': ['high', 'critical'],
    'education': ['low', 'medium'],
    'general': ['low', 'medium'],
}

SENTIMENT_BY_PRIORITY = {
    'low': ['neutral', 'negative'],
    'medium': ['neutral', 'negative'],
    'high': ['negative', 'negative', 'neutral'],
    'critical': ['negative', 'negative', 'negative'],
}

CHAT_TEMPLATES = {
    'greeting': [
        'hello', 'hi chatbot', 'hey there', 'good morning', 'good evening',
    ],
    'water_issue': [
        'water not coming in hostel', 'tap water problem', 'pipe leakage issue',
        'no water supply since yesterday',
    ],
    'electricity_issue': [
        'power cut in campus', 'lights not working', 'electricity outage issue',
    ],
    'road_issue': [
        'pothole on campus road', 'broken footpath near library', 'traffic issue at gate',
    ],
    'sanitation_issue': [
        'garbage overflow near cafeteria', 'washroom cleaning issue', 'bad smell from drain',
    ],
    'safety_issue': [
        'security problem at night', 'unsafe area near parking', 'theft concern in hostel',
    ],
    'status_check': [
        'what is my complaint status', 'track complaint progress', 'where is my ticket',
    ],
    'sla_escalation': [
        'escalate urgent complaint', 'sla breach issue', 'need urgent escalation',
    ],
    'resolution_help': [
        'how to close complaint', 'resolution feedback process', 'mark complaint resolved',
    ],
    'general_help': [
        'help me with complaint', 'how does this system work', 'what can you do',
    ],
}


def _sample_record(rng: random.Random) -> dict[str, str]:
    category = rng.choice(CATEGORIES)
    location = rng.choice(LOCATIONS)
    days = rng.randint(1, 14)
    title = rng.choice(TITLE_TEMPLATES[category]).format(location=location, days=days)
    description = ' '.join(rng.sample(DESCRIPTION_TEMPLATES, k=rng.randint(2, 3))).format(
        location=location,
        days=days,
    )
    priority = rng.choice(PRIORITY_BY_CATEGORY.get(category, PRIORITIES))
    sentiment = rng.choice(SENTIMENT_BY_PRIORITY.get(priority, SENTIMENTS))
    text = f'{title}. {description}'
    return {
        'text': text,
        'title': title,
        'description': description,
        'category': category,
        'priority': priority,
        'sentiment': sentiment,
        'record_type': 'complaint',
    }


def _sample_chat_record(rng: random.Random) -> dict[str, str]:
    intent = rng.choice(INTENTS)
    text = rng.choice(CHAT_TEMPLATES[intent])
    return {
        'text': text,
        'title': '',
        'description': '',
        'category': 'general',
        'priority': 'medium',
        'sentiment': 'neutral',
        'record_type': 'chat',
        'intent': intent,
    }


def generate_records(total_samples: int, seed: int = 42) -> list[dict[str, str]]:
    rng = random.Random(seed)
    records: list[dict[str, str]] = []
    chat_ratio = 0.08
    chat_count = max(1, int(total_samples * chat_ratio))
    complaint_count = total_samples - chat_count

    for _ in range(complaint_count):
        records.append(_sample_record(rng))

    for _ in range(chat_count):
        records.append(_sample_chat_record(rng))

    rng.shuffle(records)
    return records


def write_training_csv(output_path: Path, total_samples: int, batch_size: int = 100_000, seed: int = 42) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ['text', 'title', 'description', 'category', 'priority', 'sentiment', 'record_type', 'intent']

    with output_path.open('w', encoding='utf-8', newline='') as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()

        generated = 0
        batch_index = 0
        while generated < total_samples:
            current_batch = min(batch_size, total_samples - generated)
            batch_seed = seed + batch_index
            batch_records = generate_records(current_batch, seed=batch_seed)
            for record in batch_records:
                record.setdefault('intent', '')
                writer.writerow(record)
            generated += current_batch
            batch_index += 1

    return output_path
