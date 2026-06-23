import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

def get_utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


DATABASE_URL = "sqlite:///./autocall.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "Users"

    id = Column("Id", String(50), primary_key=True, default=generate_uuid, index=True)
    email = Column("Email", String(255), unique=True, index=True)
    password_hash = Column("PasswordHash", String(255))
    name = Column("Name", String(255))
    created_at = Column("CreatedAt", DateTime, default=get_utcnow)


class Campaign(Base):
    __tablename__ = "Campaigns"

    id = Column("Id", String(50), primary_key=True, default=generate_uuid, index=True)
    user_id = Column("UserId", String(50), ForeignKey("Users.Id"), nullable=True)
    name = Column("Name", String(255), index=True, nullable=False)
    status = Column("Status", String(50), default="paused")
    progress = Column("Progress", Integer, default=0)
    total = Column("Total", Integer, default=0)
    script = Column("Script", Text, default="Chua cau hinh")
    type = Column("Type", String(50), default="callbot")
    created_at = Column("CreatedAt", DateTime, default=get_utcnow)
    updated_at = Column("UpdatedAt", DateTime, default=get_utcnow, onupdate=get_utcnow)


class Contact(Base):
    __tablename__ = "Contacts"

    id = Column("Id", String(50), primary_key=True, default=generate_uuid, index=True)
    campaign_id = Column("CampaignId", String(50), ForeignKey("Campaigns.Id"), nullable=True)
    name = Column("Name", String(255))
    phone = Column("Phone", String(50), index=True, nullable=False)
    email = Column("Email", String(255), nullable=True)
    source = Column("Source", String(255), nullable=True)
    tags = Column("Tags", Text, nullable=True)
    last_call = Column("LastCall", String(50), default="-")
    status = Column("Status", String(50), default="pending")
    created_at = Column("CreatedAt", DateTime, default=get_utcnow)


class CallLog(Base):
    __tablename__ = "CallLogs"

    id = Column("Id", String(50), primary_key=True, default=generate_uuid, index=True)
    contact_id = Column("ContactId", String(50), ForeignKey("Contacts.Id"), nullable=True)
    phone = Column("Phone", String(50), index=True, nullable=False)
    customer_name = Column("CustomerName", String(255), nullable=True)
    status = Column("Status", String(50))
    duration = Column("Duration", Integer)
    intent_code = Column("IntentCode", String(100), nullable=True)
    transcript = Column("Transcript", Text, nullable=True)
    audio_path = Column("AudioPath", Text, nullable=True)
    created_at = Column("CreatedAt", DateTime, default=get_utcnow)


class Setting(Base):
    __tablename__ = "Settings"

    key = Column("Key", String(100), primary_key=True, index=True)
    value = Column("Value", Text)


class FlowData(Base):
    __tablename__ = "FlowData"

    campaign_id = Column("CampaignId", String(50), ForeignKey("Campaigns.Id"), primary_key=True)
    nodes = Column("Nodes", Text, nullable=False, default="[]")
    edges = Column("Edges", Text, nullable=False, default="[]")
    created_at = Column("CreatedAt", DateTime, default=get_utcnow)
    updated_at = Column("UpdatedAt", DateTime, default=get_utcnow, onupdate=get_utcnow)


class Device(Base):
    __tablename__ = "Devices"

    id = Column("Id", String(50), primary_key=True, index=True)
    ip_address = Column("IpAddress", String(50), nullable=True)
    status = Column("Status", String(50), default="idle")  # idle, busy, offline
    updated_at = Column("UpdatedAt", DateTime, default=get_utcnow, onupdate=get_utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
    print("SQLite schema is ready.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
