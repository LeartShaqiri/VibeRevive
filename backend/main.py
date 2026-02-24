from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import sqlite3

# ── Config ─────────────────────────────────────────────────────────
SECRET_KEY         = "viberevive-super-secret-key-change-in-production"
ALGORITHM          = "HS256"
TOKEN_EXPIRE_DAYS  = 30
DB_PATH            = "viberevive.db"

app = FastAPI(title="VibeRevive API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ── Database ────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    # Users table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name    TEXT NOT NULL,
            last_name     TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            phone         TEXT,
            password_hash TEXT NOT NULL,
            vibe_code     TEXT UNIQUE NOT NULL,
            created_at    TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Contacts table — who added who
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            added_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, contact_id)
        )
    """)
    # Messages table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id   INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            text        TEXT NOT NULL,
            sent_at     TEXT DEFAULT CURRENT_TIMESTAMP,
            is_read     INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ── Helpers ─────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def generate_vibe_code(first_name: str, last_name: str) -> str:
    import random, string
    prefix = (first_name[:2] + last_name[:2]).upper()
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"Vibe{prefix}{suffix}"

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

# ── Schemas ─────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    first_name: str
    last_name:  str
    email:      str
    phone:      str = ""
    password:   str

class LoginRequest(BaseModel):
    email:    str
    password: str

class AddContactRequest(BaseModel):
    vibe_code: str

class SendMessageRequest(BaseModel):
    receiver_id: int
    text:        str

# ── Auth routes ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "VibeRevive API is running 🚀"}

@app.post("/register")
def register(data: RegisterRequest):
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if "@" not in data.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (data.email.lower(),)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    vibe_code = generate_vibe_code(data.first_name, data.last_name)
    while conn.execute("SELECT id FROM users WHERE vibe_code = ?", (vibe_code,)).fetchone():
        vibe_code = generate_vibe_code(data.first_name, data.last_name)

    conn.execute(
        "INSERT INTO users (first_name, last_name, email, phone, password_hash, vibe_code) VALUES (?, ?, ?, ?, ?, ?)",
        (data.first_name, data.last_name, data.email.lower(), data.phone, hash_password(data.password), vibe_code)
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (data.email.lower(),)).fetchone()
    conn.close()

    token = create_token({"sub": data.email.lower()})
    return {
        "token": token,
        "user": {
            "id":         user["id"],
            "first_name": user["first_name"],
            "last_name":  user["last_name"],
            "email":      user["email"],
            "phone":      user["phone"],
            "vibe_code":  user["vibe_code"],
        }
    }

@app.post("/login")
def login(data: LoginRequest):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (data.email.lower(),)).fetchone()
    conn.close()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_token({"sub": user["email"]})
    return {
        "token": token,
        "user": {
            "id":         user["id"],
            "first_name": user["first_name"],
            "last_name":  user["last_name"],
            "email":      user["email"],
            "phone":      user["phone"],
            "vibe_code":  user["vibe_code"],
        }
    }

@app.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "user": {
            "id":         current_user["id"],
            "first_name": current_user["first_name"],
            "last_name":  current_user["last_name"],
            "email":      current_user["email"],
            "phone":      current_user["phone"],
            "vibe_code":  current_user["vibe_code"],
        }
    }

# ── Contacts routes ──────────────────────────────────────────────────

@app.post("/contacts/add")
def add_contact(data: AddContactRequest, current_user: dict = Depends(get_current_user)):
    conn = get_db()

    # Find the user with that vibe code
    contact = conn.execute("SELECT * FROM users WHERE vibe_code = ?", (data.vibe_code.strip(),)).fetchone()
    if not contact:
        conn.close()
        raise HTTPException(status_code=404, detail="No user found with that VibeCode")

    if contact["id"] == current_user["id"]:
        conn.close()
        raise HTTPException(status_code=400, detail="You can't add yourself!")

    # Check already added
    existing = conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?",
        (current_user["id"], contact["id"])
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Already in your contacts")

    # Add contact (both ways so both can see each other)
    conn.execute("INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)", (current_user["id"], contact["id"]))
    conn.execute("INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?, ?)", (contact["id"], current_user["id"]))
    conn.commit()
    conn.close()

    return {
        "message": "Contact added!",
        "contact": {
            "id":         contact["id"],
            "first_name": contact["first_name"],
            "last_name":  contact["last_name"],
            "vibe_code":  contact["vibe_code"],
        }
    }

@app.get("/contacts")
def get_contacts(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""
        SELECT u.id, u.first_name, u.last_name, u.vibe_code,
               (SELECT text FROM messages
                WHERE (sender_id = ? AND receiver_id = u.id)
                   OR (sender_id = u.id AND receiver_id = ?)
                ORDER BY sent_at DESC LIMIT 1) as last_msg,
               (SELECT sent_at FROM messages
                WHERE (sender_id = ? AND receiver_id = u.id)
                   OR (sender_id = u.id AND receiver_id = ?)
                ORDER BY sent_at DESC LIMIT 1) as last_time,
               (SELECT COUNT(*) FROM messages
                WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread
        FROM contacts c
        JOIN users u ON u.id = c.contact_id
        WHERE c.user_id = ?
        ORDER BY last_time DESC NULLS LAST
    """, (
        current_user["id"], current_user["id"],
        current_user["id"], current_user["id"],
        current_user["id"],
        current_user["id"]
    )).fetchall()
    conn.close()

    contacts = []
    for r in rows:
        name = f"{r['first_name']} {r['last_name']}".strip()
        contacts.append({
            "id":        r["id"],
            "name":      name,
            "vibe_code": r["vibe_code"],
            "last_msg":  r["last_msg"] or "Say hi! 👋",
            "last_time": r["last_time"] or "",
            "unread":    r["unread"] or 0,
        })

    return {"contacts": contacts}

# ── Messages routes ──────────────────────────────────────────────────

@app.post("/messages/send")
def send_message(data: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    conn = get_db()
    # Make sure receiver is in contacts
    contact = conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?",
        (current_user["id"], data.receiver_id)
    ).fetchone()
    if not contact:
        conn.close()
        raise HTTPException(status_code=403, detail="This person is not in your contacts")

    conn.execute(
        "INSERT INTO messages (sender_id, receiver_id, text) VALUES (?, ?, ?)",
        (current_user["id"], data.receiver_id, data.text.strip())
    )
    conn.commit()
    conn.close()
    return {"message": "Sent!"}

@app.get("/messages/{contact_id}")
def get_messages(contact_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()

    # Mark messages as read
    conn.execute(
        "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?",
        (contact_id, current_user["id"])
    )
    conn.commit()

    rows = conn.execute("""
        SELECT m.id, m.sender_id, m.receiver_id, m.text, m.sent_at,
               u.first_name, u.last_name
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.sent_at ASC
    """, (
        current_user["id"], contact_id,
        contact_id, current_user["id"]
    )).fetchall()
    conn.close()

    messages = []
    for r in rows:
        messages.append({
            "id":          r["id"],
            "sender_id":   r["sender_id"],
            "text":        r["text"],
            "sent_at":     r["sent_at"],
            "is_me":       r["sender_id"] == current_user["id"],
            "sender_name": f"{r['first_name']} {r['last_name']}".strip(),
        })

    return {"messages": messages}