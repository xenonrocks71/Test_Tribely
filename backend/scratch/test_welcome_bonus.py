"""
Test script verifying full registration + 1,000 Kudos welcome bonus flow.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.models.models import User, UserWallet, KudosLedger
from app.services.auth_service import auth_service
from app.services.kudos_service import kudos_service
from app.schemas.schemas import UserCreate
from fastapi.testclient import TestClient
from main import app


def test_api_registration_and_kudos():
    print("Testing registration + 1,000 Kudos welcome bonus flow...")
    engine = create_engine("sqlite:///scratch_test_welcome.db", echo=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # 1. Register new user
        reg_resp = client.post("/api/auth/register", json={
            "email": "welcome_kudos_user@tribely.com",
            "password": "Password123!",
            "full_name": "Kudos Welcome User"
        })
        print(f"Register status: {reg_resp.status_code}")
        assert reg_resp.status_code == 201

        # 2. Login to get token
        login_resp = client.post("/api/auth/login", data={
            "username": "welcome_kudos_user@tribely.com",
            "password": "Password123!"
        })
        print(f"Login status: {login_resp.status_code}")
        token = login_resp.json()["access_token"]

        # 3. Fetch Kudos wallet
        wallet_resp = client.get("/api/kudos/wallet", headers={"Authorization": f"Bearer {token}"})
        print(f"Wallet status: {wallet_resp.status_code}, payload: {wallet_resp.json()}")
        assert wallet_resp.status_code == 200

        data = wallet_resp.json()["data"]
        assert data["kudos_balance"] == 1000.0, f"Expected 1000.0 Kudos, got {data['kudos_balance']}"
        assert len(data["recent_transactions"]) >= 1, "Expected welcome bonus transaction!"
        assert data["recent_transactions"][0]["transaction_type"] == "WELCOME_BONUS"

        print("\n" + "=" * 60)
        print("[OK] VERIFICATION PASSED: Every newly registered user immediately receives 1,000 Kudos welcome bonus!")
        print("=" * 60)
    finally:
        app.dependency_overrides.clear()
        if os.path.exists("scratch_test_welcome.db"):
            os.remove("scratch_test_welcome.db")


if __name__ == "__main__":
    test_api_registration_and_kudos()
