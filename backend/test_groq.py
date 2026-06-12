from services.ai_service import classify_incident

result = classify_incident(
    "Received a phishing email asking for my bank credentials"
)

print(result)
print(type(result))