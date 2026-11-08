INTENT_RESPONSES = {
    'greeting': (
        'Hello! I am the UCMS AI assistant. I can help classify complaints, suggest departments, '
        'check SLA guidance, and explain complaint status workflows.'
    ),
    'water_issue': (
        'This appears to be a Water Supply issue. Route it to the Water Supply department with medium-to-high priority. '
        'If supply is fully stopped, treat it as critical and escalate within 24 hours.'
    ),
    'electricity_issue': (
        'This looks like an Electricity issue. Assign to the Electricity department. '
        'If safety is affected (sparks, exposed wiring), mark priority as critical immediately.'
    ),
    'road_issue': (
        'This fits Road & Traffic. Create an inspection task and prioritize safety hazards such as potholes near pedestrian paths.'
    ),
    'sanitation_issue': (
        'Route this to Sanitation. Overflow or hygiene issues in hostel/cafeteria areas should be high priority.'
    ),
    'safety_issue': (
        'This is a Public Safety concern. Escalate to the Public Safety department and notify campus security if active risk exists.'
    ),
    'status_check': (
        'Open the Complaints board to filter by ticket ID, status, or priority. '
        'Each ticket detail page shows assignment, department, and timeline updates.'
    ),
    'sla_escalation': (
        'If SLA is breached or the issue is urgent, escalate to the department lead, increase priority, '
        'and send a citizen notification with the next action timestamp.'
    ),
    'resolution_help': (
        'After fix confirmation, document resolution notes, set status to resolved, and collect feedback from the submitter.'
    ),
    'general_help': (
        'I can help with complaint classification, department routing, SLA escalation, and status tracking. '
        'Describe your issue or ask about water, electricity, roads, sanitation, or safety.'
    ),
}


def build_chat_response(intent: str, confidence: float, user_message: str) -> dict:
    reply = INTENT_RESPONSES.get(intent, INTENT_RESPONSES['general_help'])
    if confidence < 0.35:
        reply = (
            f'{reply} I am moderately confident about this intent ({confidence:.0%}). '
            'Please add more details such as location, duration, and urgency.'
        )
    return {
        'reply': reply,
        'intent': intent,
        'confidence': round(confidence, 4),
        'user_message': user_message,
    }
