from complaints.models import AIInsight, Complaint, ComplaintHistory, Department

from .engine import get_ai_engine


def apply_ai_analysis(complaint: Complaint, actor=None) -> dict:
    engine = get_ai_engine()
    analysis = engine.analyze_complaint(complaint)

    complaint.category = analysis['category']
    complaint.priority = analysis['priority']
    complaint.ai_summary = analysis['summary']
    complaint.ai_confidence = analysis['confidence']
    complaint.ai_sentiment = analysis['sentiment_score']

    department = Department.objects.filter(name=analysis['recommended_department']).first()
    if department:
        complaint.department = department

    complaint.save(
        update_fields=[
            'category',
            'priority',
            'ai_summary',
            'ai_confidence',
            'ai_sentiment',
            'department',
            'updated_at',
        ]
    )

    insight = AIInsight.objects.create(
        complaint=complaint,
        summary=analysis['summary'],
        risk_score=analysis['risk_score'],
        recommendations=analysis['recommendations'],
        confidence=analysis['confidence'],
    )

    ComplaintHistory.objects.create(
        complaint=complaint,
        actor=actor,
        action='ai_analysis',
        details=f"AI auto-triage completed ({analysis['model_version']}) with {analysis['confidence']:.0%} confidence.",
    )

    analysis['insight_id'] = insight.id
    return analysis


def reload_ai_engine():
    get_ai_engine.cache_clear()
    return get_ai_engine()
