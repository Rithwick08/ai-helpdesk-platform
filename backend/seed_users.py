from database import SessionLocal
from models.user import User
from auth.security import hash_password

def seed_users():
    db = SessionLocal()
    users_to_create = [
        {"employee_id": "ADM-001", "name": "Admin User", "email": "admin@cybershield.ai", "department": "Management", "role": "admin"},
        {"employee_id": "EMP-001", "name": "Employee User", "email": "employee@cybershield.ai", "department": "Marketing", "role": "employee"},
        {"employee_id": "IT-001", "name": "IT Support User", "email": "it@cybershield.ai", "department": "IT", "role": "it"},
        {"employee_id": "SOC-001", "name": "SOC Analyst", "email": "soc@cybershield.ai", "department": "Security", "role": "soc"},
    ]

    for user_data in users_to_create:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing:
            new_user = User(
                **user_data,
                hashed_password=hash_password("password123")
            )
            db.add(new_user)
            print(f"Created user: {user_data['email']}")
        else:
            print(f"User already exists: {user_data['email']}")
            
            # Update password for existing user just in case
            existing.hashed_password = hash_password("password123")
            
    db.commit()
    db.close()
    print("Seeding complete. Password for all users is: password123")

if __name__ == "__main__":
    seed_users()
