from complaints.models import Complaint

CATEGORIES = [choice[0] for choice in Complaint.Category.choices]
PRIORITIES = [choice[0] for choice in Complaint.Priority.choices]
SENTIMENTS = ['negative', 'neutral', 'positive']
INTENTS = [
    'greeting',
    'water_issue',
    'electricity_issue',
    'road_issue',
    'sanitation_issue',
    'safety_issue',
    'status_check',
    'sla_escalation',
    'resolution_help',
    'general_help',
]

CATEGORY_DEPARTMENT_MAP = {
    'water_supply': 'Water Supply',
    'sanitation': 'Sanitation',
    'road': 'Road & Traffic',
    'electricity': 'Electricity',
    'public_safety': 'Public Safety',
    'waste_management': 'Sanitation',
    'healthcare': 'Healthcare',
    'education': 'Education',
    'general': 'General Services',
}
