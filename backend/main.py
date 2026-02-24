from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import sqlite3

SECRET_KEY        = "viberevive-super-secret-key-change-in-production"
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 30
DB_PATH           = "viberevive.db"

app = FastAPI(title="VibeRevive API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name      TEXT NOT NULL,
            last_name       TEXT NOT NULL,
            email           TEXT UNIQUE NOT NULL,
            phone           TEXT,
            password_hash   TEXT NOT NULL,
            vibe_code       TEXT UNIQUE NOT NULL,
            bio             TEXT DEFAULT '',
            profile_image   TEXT DEFAULT '',
            profile_border  TEXT DEFAULT 'glow_purple',
            vibe_tags       TEXT DEFAULT '',
            main_vibe       TEXT DEFAULT '',
            name_changed_at TEXT DEFAULT NULL,
            created_at      TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    for col, defn in [
        ("bio",             "TEXT DEFAULT ''"),
        ("profile_image",   "TEXT DEFAULT ''"),
        ("profile_border",  "TEXT DEFAULT 'glow_purple'"),
        ("vibe_tags",       "TEXT DEFAULT ''"),
        ("main_vibe",       "TEXT DEFAULT ''"),
        ("name_changed_at", "TEXT DEFAULT NULL"),
    ]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
        except Exception:
            pass
    conn.execute("""
        CREATE TABLE IF NOT EXISTS friend_requests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id   INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            status      TEXT DEFAULT 'pending',
            sent_at     TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(sender_id, receiver_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            added_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, contact_id)
        )
    """)
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

def hash_password(p):        return pwd_context.hash(p)
def verify_password(pl, ha): return pwd_context.verify(pl, ha)

def generate_vibe_code(first, last):
    import random, string
    prefix = (first[:2] + last[:2]).upper()
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"Vibe{prefix}{suffix}"

def create_token(data):
    p = data.copy()
    p["exp"] = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(p, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email   = payload.get("sub")
        if not email: raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

def pub(u):
    return {
        "id":             u["id"],
        "first_name":     u["first_name"],
        "last_name":      u["last_name"],
        "email":          u["email"],
        "phone":          u["phone"] or "",
        "vibe_code":      u["vibe_code"],
        "bio":            u["bio"] or "",
        "profile_image":  u["profile_image"] or "",
        "profile_border": u["profile_border"] or "glow_purple",
        "vibe_tags":      u["vibe_tags"] or "",
        "main_vibe":      u["main_vibe"] or "",
        "name_changed_at": u["name_changed_at"] or "",
    }

# ── Schemas ──────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    first_name: str
    last_name:  str
    email:      str
    phone:      str = ""
    password:   str

class LoginRequest(BaseModel):
    email:    str
    password: str

class UpdateProfileRequest(BaseModel):
    display_name:   Optional[str] = None
    bio:            Optional[str] = None
    profile_image:  Optional[str] = None
    profile_border: Optional[str] = None
    vibe_tags:      Optional[str] = None
    main_vibe:      Optional[str] = None

class FriendRequestSend(BaseModel):
    vibe_code: str

class FriendRequestRespond(BaseModel):
    request_id: int
    action:     str  # "accept" or "decline"

class SendMessageRequest(BaseModel):
    receiver_id: int
    text:        str

# ── Auth ──────────────────────────────────────────────────────────────
@app.get("/")
def root(): return {"status": "VibeRevive API is running 🚀"}

@app.post("/register")
def register(data: RegisterRequest):
    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if "@" not in data.email:
        raise HTTPException(400, "Invalid email address")
    conn = get_db()
    if conn.execute("SELECT id FROM users WHERE email=?", (data.email.lower(),)).fetchone():
        conn.close(); raise HTTPException(400, "An account with this email already exists")
    vc = generate_vibe_code(data.first_name, data.last_name)
    while conn.execute("SELECT id FROM users WHERE vibe_code=?", (vc,)).fetchone():
        vc = generate_vibe_code(data.first_name, data.last_name)
    conn.execute(
        "INSERT INTO users (first_name,last_name,email,phone,password_hash,vibe_code) VALUES (?,?,?,?,?,?)",
        (data.first_name, data.last_name, data.email.lower(), data.phone, hash_password(data.password), vc)
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE email=?", (data.email.lower(),)).fetchone()
    conn.close()
    return {"token": create_token({"sub": data.email.lower()}), "user": pub(dict(user))}

@app.post("/login")
def login(data: LoginRequest):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email=?", (data.email.lower(),)).fetchone()
    conn.close()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": create_token({"sub": user["email"]}), "user": pub(dict(user))}

@app.get("/me")
def me(cu: dict = Depends(get_current_user)):
    return {"user": pub(cu)}

# ── Profile update ────────────────────────────────────────────────────
@app.put("/profile")
def update_profile(data: UpdateProfileRequest, cu: dict = Depends(get_current_user)):
    conn    = get_db()
    updates = []
    values  = []

    if data.display_name is not None:
        changed_at = cu.get("name_changed_at")
        if changed_at:
            days = (datetime.utcnow() - datetime.fromisoformat(changed_at)).days
            if days < 30:
                conn.close()
                raise HTTPException(400, f"Name locked for {30 - days} more days")
        parts = data.display_name.strip().split(" ", 1)
        fn, ln = parts[0], (parts[1] if len(parts) > 1 else "")
        nvc = generate_vibe_code(fn, ln)
        while conn.execute("SELECT id FROM users WHERE vibe_code=? AND id!=?", (nvc, cu["id"])).fetchone():
            nvc = generate_vibe_code(fn, ln)
        updates += ["first_name=?", "last_name=?", "vibe_code=?", "name_changed_at=?"]
        values  += [fn, ln, nvc, datetime.utcnow().isoformat()]

    if data.bio            is not None: updates.append("bio=?");            values.append(data.bio)
    if data.profile_image  is not None: updates.append("profile_image=?");  values.append(data.profile_image)
    if data.profile_border is not None: updates.append("profile_border=?"); values.append(data.profile_border)
    if data.vibe_tags      is not None: updates.append("vibe_tags=?");      values.append(data.vibe_tags)
    if data.main_vibe      is not None: updates.append("main_vibe=?");       values.append(data.main_vibe)

    if not updates:
        conn.close(); return {"user": pub(cu)}

    values.append(cu["id"])
    conn.execute(f"UPDATE users SET {','.join(updates)} WHERE id=?", values)
    conn.commit()
    updated = conn.execute("SELECT * FROM users WHERE id=?", (cu["id"],)).fetchone()
    conn.close()
    return {"user": pub(dict(updated))}

# ── Friend requests ───────────────────────────────────────────────────
@app.post("/friends/request")
def send_request(data: FriendRequestSend, cu: dict = Depends(get_current_user)):
    conn   = get_db()
    target = conn.execute("SELECT * FROM users WHERE vibe_code=?", (data.vibe_code.strip(),)).fetchone()
    if not target: conn.close(); raise HTTPException(404, "No user found with that VibeCode")
    if target["id"] == cu["id"]: conn.close(); raise HTTPException(400, "You can't add yourself!")
    if conn.execute("SELECT id FROM contacts WHERE user_id=? AND contact_id=?",
                    (cu["id"], target["id"])).fetchone():
        conn.close(); raise HTTPException(400, "Already in your contacts")
    if conn.execute("SELECT id FROM friend_requests WHERE sender_id=? AND receiver_id=?",
                    (cu["id"], target["id"])).fetchone():
        conn.close(); raise HTTPException(400, "Request already sent")
    # They already sent you one → auto accept
    reverse = conn.execute(
        "SELECT * FROM friend_requests WHERE sender_id=? AND receiver_id=? AND status='pending'",
        (target["id"], cu["id"])
    ).fetchone()
    if reverse:
        conn.execute("UPDATE friend_requests SET status='accepted' WHERE id=?", (reverse["id"],))
        conn.execute("INSERT OR IGNORE INTO contacts (user_id,contact_id) VALUES (?,?)", (cu["id"], target["id"]))
        conn.execute("INSERT OR IGNORE INTO contacts (user_id,contact_id) VALUES (?,?)", (target["id"], cu["id"]))
        conn.commit(); conn.close()
        return {"message": "You both added each other — now connected! 🎉", "auto_accepted": True}
    conn.execute("INSERT INTO friend_requests (sender_id,receiver_id) VALUES (?,?)", (cu["id"], target["id"]))
    conn.commit(); conn.close()
    return {"message": f"Friend request sent to {target['first_name']}! 📨", "auto_accepted": False}

@app.get("/friends/requests")
def get_requests(cu: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""
        SELECT fr.id, fr.sender_id, fr.sent_at,
               u.first_name, u.last_name, u.vibe_code, u.profile_image, u.profile_border, u.bio
        FROM friend_requests fr
        JOIN users u ON u.id = fr.sender_id
        WHERE fr.receiver_id=? AND fr.status='pending'
        ORDER BY fr.sent_at DESC
    """, (cu["id"],)).fetchall()
    conn.close()
    return {"requests": [
        {
            "id":             r["id"],
            "sender_id":      r["sender_id"],
            "sender_name":    f"{r['first_name']} {r['last_name']}".strip(),
            "vibe_code":      r["vibe_code"],
            "profile_image":  r["profile_image"] or "",
            "profile_border": r["profile_border"] or "glow_purple",
            "bio":            r["bio"] or "",
            "sent_at":        r["sent_at"],
        } for r in rows
    ]}

@app.post("/friends/respond")
def respond_request(data: FriendRequestRespond, cu: dict = Depends(get_current_user)):
    if data.action not in ("accept", "decline"):
        raise HTTPException(400, "Action must be 'accept' or 'decline'")
    conn = get_db()
    req  = conn.execute("SELECT * FROM friend_requests WHERE id=? AND receiver_id=?",
                        (data.request_id, cu["id"])).fetchone()
    if not req: conn.close(); raise HTTPException(404, "Request not found")
    if data.action == "accept":
        conn.execute("UPDATE friend_requests SET status='accepted' WHERE id=?", (data.request_id,))
        conn.execute("INSERT OR IGNORE INTO contacts (user_id,contact_id) VALUES (?,?)", (cu["id"], req["sender_id"]))
        conn.execute("INSERT OR IGNORE INTO contacts (user_id,contact_id) VALUES (?,?)", (req["sender_id"], cu["id"]))
        msg = "Friend request accepted! 🎉"
    else:
        conn.execute("UPDATE friend_requests SET status='declined' WHERE id=?", (data.request_id,))
        msg = "Declined."
    conn.commit(); conn.close()
    return {"message": msg}

# ── Contacts ──────────────────────────────────────────────────────────
@app.get("/contacts")
def get_contacts(cu: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""
        SELECT u.id, u.first_name, u.last_name, u.vibe_code,
               u.profile_image, u.profile_border,
               (SELECT text FROM messages
                WHERE (sender_id=? AND receiver_id=u.id) OR (sender_id=u.id AND receiver_id=?)
                ORDER BY sent_at DESC LIMIT 1) as last_msg,
               (SELECT sent_at FROM messages
                WHERE (sender_id=? AND receiver_id=u.id) OR (sender_id=u.id AND receiver_id=?)
                ORDER BY sent_at DESC LIMIT 1) as last_time,
               (SELECT COUNT(*) FROM messages
                WHERE sender_id=u.id AND receiver_id=? AND is_read=0) as unread
        FROM contacts c JOIN users u ON u.id=c.contact_id
        WHERE c.user_id=?
        ORDER BY last_time DESC NULLS LAST
    """, (cu["id"],cu["id"],cu["id"],cu["id"],cu["id"],cu["id"])).fetchall()
    conn.close()
    return {"contacts": [
        {
            "id":             r["id"],
            "name":           f"{r['first_name']} {r['last_name']}".strip(),
            "vibe_code":      r["vibe_code"],
            "profile_image":  r["profile_image"] or "",
            "profile_border": r["profile_border"] or "glow_purple",
            "last_msg":       r["last_msg"] or "Say hi! 👋",
            "last_time":      r["last_time"] or "",
            "unread":         r["unread"] or 0,
        } for r in rows
    ]}

# ── Messages ──────────────────────────────────────────────────────────
@app.post("/messages/send")
def send_message(data: SendMessageRequest, cu: dict = Depends(get_current_user)):
    if not data.text.strip(): raise HTTPException(400, "Empty message")
    conn = get_db()
    if not conn.execute("SELECT id FROM contacts WHERE user_id=? AND contact_id=?",
                        (cu["id"], data.receiver_id)).fetchone():
        conn.close(); raise HTTPException(403, "Not in your contacts")
    conn.execute("INSERT INTO messages (sender_id,receiver_id,text) VALUES (?,?,?)",
                 (cu["id"], data.receiver_id, data.text.strip()))
    conn.commit(); conn.close()
    return {"message": "Sent!"}

@app.get("/messages/{contact_id}")
def get_messages(contact_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=?",
                 (contact_id, cu["id"]))
    conn.commit()
    rows = conn.execute("""
        SELECT m.id, m.sender_id, m.text, m.sent_at, u.first_name, u.last_name
        FROM messages m JOIN users u ON u.id=m.sender_id
        WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
        ORDER BY m.sent_at ASC
    """, (cu["id"], contact_id, contact_id, cu["id"])).fetchall()
    conn.close()
    return {"messages": [
        {
            "id":          r["id"],
            "sender_id":   r["sender_id"],
            "text":        r["text"],
            "sent_at":     r["sent_at"],
            "is_me":       r["sender_id"] == cu["id"],
            "sender_name": f"{r['first_name']} {r['last_name']}".strip(),
        } for r in rows
    ]}