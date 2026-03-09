from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
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
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL, last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL, phone TEXT,
            password_hash TEXT NOT NULL, vibe_code TEXT UNIQUE NOT NULL,
            bio TEXT DEFAULT '', profile_image TEXT DEFAULT '',
            profile_border TEXT DEFAULT 'glow_purple',
            vibe_tags TEXT DEFAULT '', main_vibe TEXT DEFAULT '',
            name_changed_at TEXT DEFAULT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    for col, defn in [
        ("bio","TEXT DEFAULT ''"),("profile_image","TEXT DEFAULT ''"),
        ("profile_border","TEXT DEFAULT 'glow_purple'"),("vibe_tags","TEXT DEFAULT ''"),
        ("main_vibe","TEXT DEFAULT ''"),("name_changed_at","TEXT DEFAULT NULL"),
    ]:
        try: conn.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
        except: pass

    conn.execute("""
        CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending', sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(sender_id, receiver_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL, contact_id INTEGER NOT NULL,
            added_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, contact_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            msg_type TEXT DEFAULT 'text',
            group_invite_id INTEGER DEFAULT NULL,
            sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_read INTEGER DEFAULT 0
        )
    """)
    for col, defn in [
        ("msg_type", "TEXT DEFAULT 'text'"),
        ("group_invite_id", "INTEGER DEFAULT NULL"),
    ]:
        try: conn.execute(f"ALTER TABLE messages ADD COLUMN {col} {defn}")
        except: pass

    conn.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, image TEXT DEFAULT '',
            owner_id INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'accepted',
            joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, user_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS group_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL, sender_id INTEGER NOT NULL,
            text TEXT NOT NULL, is_system INTEGER DEFAULT 0,
            sent_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS group_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            inviter_id INTEGER NOT NULL, invitee_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, invitee_id)
        )
    """)

    # ── NEW TABLES ────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contact_nicknames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            nickname TEXT DEFAULT '',
            UNIQUE(user_id, contact_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS blocked_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            blocked_id INTEGER NOT NULL,
            blocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, blocked_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id INTEGER NOT NULL,
            reported_id INTEGER NOT NULL,
            reported_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    conn.close()
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

def pub(u):
    return {
        "id": u["id"], "first_name": u["first_name"], "last_name": u["last_name"],
        "email": u["email"], "phone": u["phone"] or "", "vibe_code": u["vibe_code"],
        "bio": u["bio"] or "", "profile_image": u["profile_image"] or "",
        "profile_border": u["profile_border"] or "glow_purple",
        "vibe_tags": u["vibe_tags"] or "", "main_vibe": u["main_vibe"] or "",
        "name_changed_at": u["name_changed_at"] or "",
    }

# ── Schemas ───────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    first_name: str; last_name: str; email: str; phone: str = ""; password: str
class LoginRequest(BaseModel):
    email: str; password: str
class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None; bio: Optional[str] = None
    profile_image: Optional[str] = None; profile_border: Optional[str] = None
    vibe_tags: Optional[str] = None; main_vibe: Optional[str] = None
class FriendRequestSend(BaseModel):
    vibe_code: str
class FriendRequestRespond(BaseModel):
    request_id: int; action: str
class SendMessageRequest(BaseModel):
    receiver_id: int; text: str; msg_type: str = "text"   # ← updated
class CreateGroupRequest(BaseModel):
    name: str; image: str = ""; invite_user_ids: List[int] = []
class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None; image: Optional[str] = None
class GroupInviteRespond(BaseModel):
    invite_id: int; action: str
class SendGroupMessageRequest(BaseModel):
    group_id: int; text: str
class InviteToGroupRequest(BaseModel):
    user_ids: List[int]
class SetNicknameRequest(BaseModel):           # ← new
    nickname: str = ""

# ── Auth ──────────────────────────────────────────────────────────────
@app.get("/")
def root(): return {"status": "VibeRevive API is running 🚀"}

@app.post("/register")
def register(data: RegisterRequest):
    if len(data.password) < 8: raise HTTPException(400, "Password must be at least 8 characters")
    if "@" not in data.email:  raise HTTPException(400, "Invalid email address")
    conn = get_db()
    if conn.execute("SELECT id FROM users WHERE email=?", (data.email.lower(),)).fetchone():
        conn.close(); raise HTTPException(400, "An account with this email already exists")
    vc = generate_vibe_code(data.first_name, data.last_name)
    while conn.execute("SELECT id FROM users WHERE vibe_code=?", (vc,)).fetchone():
        vc = generate_vibe_code(data.first_name, data.last_name)
    conn.execute("INSERT INTO users (first_name,last_name,email,phone,password_hash,vibe_code) VALUES (?,?,?,?,?,?)",
        (data.first_name, data.last_name, data.email.lower(), data.phone, hash_password(data.password), vc))
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

@app.put("/profile")
def update_profile(data: UpdateProfileRequest, cu: dict = Depends(get_current_user)):
    conn = get_db(); updates = []; values = []
    if data.display_name is not None:
        changed_at = cu.get("name_changed_at")
        if changed_at:
            days = (datetime.utcnow() - datetime.fromisoformat(changed_at)).days
            if days < 30: conn.close(); raise HTTPException(400, f"Name locked for {30-days} more days")
        parts = data.display_name.strip().split(" ", 1)
        fn, ln = parts[0], (parts[1] if len(parts) > 1 else "")
        nvc = generate_vibe_code(fn, ln)
        while conn.execute("SELECT id FROM users WHERE vibe_code=? AND id!=?", (nvc, cu["id"])).fetchone():
            nvc = generate_vibe_code(fn, ln)
        updates += ["first_name=?","last_name=?","vibe_code=?","name_changed_at=?"]
        values  += [fn, ln, nvc, datetime.utcnow().isoformat()]
    if data.bio            is not None: updates.append("bio=?");            values.append(data.bio)
    if data.profile_image  is not None: updates.append("profile_image=?");  values.append(data.profile_image)
    if data.profile_border is not None: updates.append("profile_border=?"); values.append(data.profile_border)
    if data.vibe_tags      is not None: updates.append("vibe_tags=?");      values.append(data.vibe_tags)
    if data.main_vibe      is not None: updates.append("main_vibe=?");      values.append(data.main_vibe)
    if not updates: conn.close(); return {"user": pub(cu)}
    values.append(cu["id"])
    conn.execute(f"UPDATE users SET {','.join(updates)} WHERE id=?", values)
    conn.commit()
    updated = conn.execute("SELECT * FROM users WHERE id=?", (cu["id"],)).fetchone()
    conn.close()
    return {"user": pub(dict(updated))}

# ── Friend requests ───────────────────────────────────────────────────
@app.post("/friends/request")
def send_request(data: FriendRequestSend, cu: dict = Depends(get_current_user)):
    conn = get_db()
    target = conn.execute("SELECT * FROM users WHERE vibe_code=?", (data.vibe_code.strip(),)).fetchone()
    if not target: conn.close(); raise HTTPException(404, "No user found with that VibeCode")
    if target["id"] == cu["id"]: conn.close(); raise HTTPException(400, "You can't add yourself!")
    if conn.execute("SELECT id FROM contacts WHERE user_id=? AND contact_id=?", (cu["id"], target["id"])).fetchone():
        conn.close(); raise HTTPException(400, "Already in your contacts")
    if conn.execute("SELECT id FROM friend_requests WHERE sender_id=? AND receiver_id=?", (cu["id"], target["id"])).fetchone():
        conn.close(); raise HTTPException(400, "Request already sent")
    reverse = conn.execute("SELECT * FROM friend_requests WHERE sender_id=? AND receiver_id=? AND status='pending'",
        (target["id"], cu["id"])).fetchone()
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
        FROM friend_requests fr JOIN users u ON u.id=fr.sender_id
        WHERE fr.receiver_id=? AND fr.status='pending' ORDER BY fr.sent_at DESC
    """, (cu["id"],)).fetchall()
    conn.close()
    return {"requests": [{"id":r["id"],"sender_id":r["sender_id"],
        "sender_name":f"{r['first_name']} {r['last_name']}".strip(),
        "vibe_code":r["vibe_code"],"profile_image":r["profile_image"] or "",
        "profile_border":r["profile_border"] or "glow_purple",
        "bio":r["bio"] or "","sent_at":r["sent_at"]} for r in rows]}

@app.post("/friends/respond")
def respond_request(data: FriendRequestRespond, cu: dict = Depends(get_current_user)):
    if data.action not in ("accept","decline"): raise HTTPException(400, "Invalid action")
    conn = get_db()
    req = conn.execute("SELECT * FROM friend_requests WHERE id=? AND receiver_id=?",
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
               u.profile_image, u.profile_border, u.bio, u.vibe_tags, u.main_vibe,
               (SELECT text FROM messages
                WHERE ((sender_id=? AND receiver_id=u.id) OR (sender_id=u.id AND receiver_id=?))
                ORDER BY sent_at DESC LIMIT 1) as last_msg,
               (SELECT sent_at FROM messages
                WHERE ((sender_id=? AND receiver_id=u.id) OR (sender_id=u.id AND receiver_id=?))
                ORDER BY sent_at DESC LIMIT 1) as last_time,
               (SELECT COUNT(*) FROM messages
                WHERE sender_id=u.id AND receiver_id=? AND is_read=0
                  AND (msg_type='text'
                       OR (msg_type='group_invite' AND group_invite_id IN (
                           SELECT id FROM group_invites WHERE status='pending'
                       )))
               ) as unread
        FROM contacts c JOIN users u ON u.id=c.contact_id
        WHERE c.user_id=?
    """, (cu["id"],cu["id"],cu["id"],cu["id"],cu["id"],cu["id"])).fetchall()

    contact_ids = {r["id"] for r in rows}
    result = []
    for r in rows:
        result.append({
            "id":r["id"],"name":f"{r['first_name']} {r['last_name']}".strip(),
            "vibe_code":r["vibe_code"],"profile_image":r["profile_image"] or "",
            "profile_border":r["profile_border"] or "glow_purple","bio":r["bio"] or "",
            "vibe_tags":r["vibe_tags"] or "","main_vibe":r["main_vibe"] or "",
            "last_msg":r["last_msg"] or "Say hi! 👋","last_time":r["last_time"] or "",
            "unread":r["unread"] or 0
        })

    invite_senders = conn.execute("""
        SELECT DISTINCT u.id, u.first_name, u.last_name, u.vibe_code,
               u.profile_image, u.profile_border, u.bio, u.vibe_tags, u.main_vibe,
               m.text as last_msg, m.sent_at as last_time,
               (SELECT COUNT(*) FROM messages
                WHERE sender_id=u.id AND receiver_id=? AND is_read=0
                  AND msg_type='group_invite'
                  AND group_invite_id IN (SELECT id FROM group_invites WHERE status='pending')
               ) as unread
        FROM messages m JOIN users u ON u.id=m.sender_id
        WHERE m.receiver_id=? AND m.msg_type='group_invite'
          AND u.id NOT IN ({})
        ORDER BY m.sent_at DESC
    """.format(','.join('?' * len(contact_ids)) if contact_ids else 'SELECT -1'),
    (cu["id"], cu["id"], *contact_ids) if contact_ids else (cu["id"], cu["id"])
    ).fetchall()

    for r in invite_senders:
        if r["id"] not in contact_ids:
            result.append({
                "id":r["id"],"name":f"{r['first_name']} {r['last_name']}".strip(),
                "vibe_code":r["vibe_code"],"profile_image":r["profile_image"] or "",
                "profile_border":r["profile_border"] or "glow_purple","bio":r["bio"] or "",
                "vibe_tags":r["vibe_tags"] or "","main_vibe":r["main_vibe"] or "",
                "last_msg":r["last_msg"] or "","last_time":r["last_time"] or "",
                "unread":r["unread"] or 0
            })

    result.sort(key=lambda x: x["last_time"] or "", reverse=True)
    conn.close()
    return {"contacts": result}

# ── DM Messages ───────────────────────────────────────────────────────
@app.post("/messages/send")
def send_message(data: SendMessageRequest, cu: dict = Depends(get_current_user)):
    if not data.text.strip(): raise HTTPException(400, "Empty message")
    conn = get_db()
    if not conn.execute("SELECT id FROM contacts WHERE user_id=? AND contact_id=?",
                        (cu["id"], data.receiver_id)).fetchone():
        conn.close(); raise HTTPException(403, "Not in your contacts")
    conn.execute("INSERT INTO messages (sender_id,receiver_id,text,msg_type) VALUES (?,?,?,?)",
                 (cu["id"], data.receiver_id, data.text.strip(), data.msg_type))
    conn.commit(); conn.close()
    return {"message": "Sent!"}

@app.get("/messages/{contact_id}")
def get_messages(contact_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=?",
                 (contact_id, cu["id"]))
    conn.commit()
    rows = conn.execute("""
        SELECT m.id, m.sender_id, m.text, m.sent_at, m.msg_type, m.group_invite_id,
               u.first_name, u.last_name
        FROM messages m JOIN users u ON u.id=m.sender_id
        WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
        ORDER BY m.sent_at ASC
    """, (cu["id"],contact_id,contact_id,cu["id"])).fetchall()

    # Fetch nickname for this contact
    nn_row = conn.execute(
        "SELECT nickname FROM contact_nicknames WHERE user_id=? AND contact_id=?",
        (cu["id"], contact_id)
    ).fetchone()
    nickname = nn_row["nickname"] if nn_row else ""

    result = []
    for r in rows:
        msg = {
            "id": r["id"], "sender_id": r["sender_id"], "text": r["text"],
            "sent_at": r["sent_at"], "is_me": r["sender_id"] == cu["id"],
            "sender_name": f"{r['first_name']} {r['last_name']}".strip(),
            "msg_type": r["msg_type"] or "text",
            "group_invite": None,
        }
        if r["msg_type"] == "group_invite" and r["group_invite_id"]:
            inv = conn.execute("""
                SELECT gi.id, gi.status, gi.group_id, g.name as group_name, g.image as group_image
                FROM group_invites gi JOIN groups g ON g.id=gi.group_id
                WHERE gi.id=?
            """, (r["group_invite_id"],)).fetchone()
            if inv:
                msg["group_invite"] = {
                    "invite_id":   inv["id"],
                    "group_id":    inv["group_id"],
                    "group_name":  inv["group_name"],
                    "group_image": inv["group_image"] or "",
                    "status":      inv["status"],
                }
            else:
                msg["group_invite"] = {
                    "invite_id":   r["group_invite_id"],
                    "group_id":    None,
                    "group_name":  "Deleted group",
                    "group_image": "",
                    "status":      "deleted",
                }
        result.append(msg)
    conn.close()
    return {"messages": result, "nickname": nickname}

# ── Delete chat (clears messages, removes from contacts until next msg) ─
@app.delete("/messages/{contact_id}")
def delete_chat(contact_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute("""
        DELETE FROM messages
        WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
    """, (cu["id"], contact_id, contact_id, cu["id"]))
    conn.execute("DELETE FROM contacts WHERE user_id=? AND contact_id=?", (cu["id"], contact_id))
    conn.commit(); conn.close()
    return {"message": "Chat deleted."}

# ── Set nickname for a contact ────────────────────────────────────────
@app.post("/contacts/{contact_id}/nickname")
def set_nickname(contact_id: int, data: SetNicknameRequest, cu: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute("""
        INSERT INTO contact_nicknames (user_id, contact_id, nickname)
        VALUES (?,?,?)
        ON CONFLICT(user_id, contact_id) DO UPDATE SET nickname=excluded.nickname
    """, (cu["id"], contact_id, data.nickname.strip()))
    conn.commit(); conn.close()
    return {"message": "Nickname saved!"}

# ── Block a user ──────────────────────────────────────────────────────
@app.post("/contacts/{contact_id}/block")
def block_user(contact_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute("INSERT OR IGNORE INTO blocked_users (user_id, blocked_id) VALUES (?,?)",
                 (cu["id"], contact_id))
    conn.execute("DELETE FROM contacts WHERE user_id=? AND contact_id=?", (cu["id"], contact_id))
    conn.commit(); conn.close()
    return {"message": "User blocked."}

# ── Report a user ─────────────────────────────────────────────────────
@app.post("/contacts/{contact_id}/report")
def report_user(contact_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    conn.execute("INSERT INTO reports (reporter_id, reported_id) VALUES (?,?)",
                 (cu["id"], contact_id))
    conn.commit(); conn.close()
    return {"message": "Report submitted."}

# ── Groups ────────────────────────────────────────────────────────────
@app.post("/groups/create")
def create_group(data: CreateGroupRequest, cu: dict = Depends(get_current_user)):
    if not data.name.strip(): raise HTTPException(400, "Group name required")
    conn = get_db()
    conn.execute("INSERT INTO groups (name,image,owner_id) VALUES (?,?,?)",
                 (data.name.strip(), data.image, cu["id"]))
    conn.commit()
    group_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO group_members (group_id,user_id,status) VALUES (?,?,'accepted')",
                 (group_id, cu["id"]))
    creator_name = f"{cu['first_name']} {cu['last_name']}".strip()
    conn.execute("INSERT INTO group_messages (group_id,sender_id,text,is_system) VALUES (?,?,?,1)",
                 (group_id, cu["id"], f"🎉 {data.name.strip()} was created"))
    conn.execute("INSERT INTO group_messages (group_id,sender_id,text,is_system) VALUES (?,?,?,1)",
                 (group_id, cu["id"], f"👑 {creator_name} is the owner"))
    for uid in data.invite_user_ids:
        contact = conn.execute("SELECT id FROM contacts WHERE user_id=? AND contact_id=?",
                               (cu["id"], uid)).fetchone()
        if not contact: continue
        try:
            conn.execute("INSERT INTO group_invites (group_id,inviter_id,invitee_id) VALUES (?,?,?)",
                         (group_id, cu["id"], uid))
            conn.commit()
            invite_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        except: continue
        invite_text = f"{creator_name} invited you to join {data.name.strip()}"
        conn.execute("""
            INSERT INTO messages (sender_id, receiver_id, text, msg_type, group_invite_id)
            VALUES (?,?,?,?,?)
        """, (cu["id"], uid, invite_text, "group_invite", invite_id))
    conn.commit()
    group = conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
    conn.close()
    return {"group": {"id":group["id"],"name":group["name"],"image":group["image"] or "",
                      "owner_id":group["owner_id"],"created_at":group["created_at"]}}

@app.get("/groups")
def get_groups(cu: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""
        SELECT g.id, g.name, g.image, g.owner_id, g.created_at,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id AND status='accepted') as member_count,
               (SELECT text FROM group_messages WHERE group_id=g.id ORDER BY sent_at DESC LIMIT 1) as last_msg,
               (SELECT sent_at FROM group_messages WHERE group_id=g.id ORDER BY sent_at DESC LIMIT 1) as last_time
        FROM groups g JOIN group_members gm ON gm.group_id=g.id
        WHERE gm.user_id=? AND gm.status='accepted'
        ORDER BY last_time DESC NULLS LAST
    """, (cu["id"],)).fetchall()
    conn.close()
    return {"groups": [{"id":r["id"],"name":r["name"],"image":r["image"] or "",
        "owner_id":r["owner_id"],"member_count":r["member_count"],
        "last_msg":r["last_msg"] or "","last_time":r["last_time"] or "",
        "created_at":r["created_at"]} for r in rows]}

@app.get("/groups/{group_id}/messages")
def get_group_messages(group_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    member = conn.execute("SELECT id FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'",
                          (group_id, cu["id"])).fetchone()
    if not member: conn.close(); raise HTTPException(403, "Not a member of this group")
    rows = conn.execute("""
        SELECT gm.id, gm.sender_id, gm.text, gm.is_system, gm.sent_at,
               u.first_name, u.last_name, u.profile_image
        FROM group_messages gm JOIN users u ON u.id=gm.sender_id
        WHERE gm.group_id=? ORDER BY gm.sent_at ASC
    """, (group_id,)).fetchall()
    members = conn.execute("""
        SELECT u.id, u.first_name, u.last_name, u.profile_image, u.profile_border, g.owner_id
        FROM group_members gm
        JOIN users u ON u.id=gm.user_id
        JOIN groups g ON g.id=gm.group_id
        WHERE gm.group_id=? AND gm.status='accepted'
    """, (group_id,)).fetchall()
    group = conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
    non_members = conn.execute("""
        SELECT u.id, u.first_name, u.last_name, u.profile_image
        FROM contacts c JOIN users u ON u.id=c.contact_id
        WHERE c.user_id=?
          AND u.id NOT IN (SELECT user_id FROM group_members WHERE group_id=? AND status='accepted')
    """, (cu["id"], group_id)).fetchall()
    conn.close()
    return {
        "messages": [{"id":r["id"],"sender_id":r["sender_id"],"text":r["text"],
            "is_system":bool(r["is_system"]),"sent_at":r["sent_at"],
            "is_me":r["sender_id"]==cu["id"],
            "sender_name":f"{r['first_name']} {r['last_name']}".strip(),
            "sender_image":r["profile_image"] or ""} for r in rows],
        "members": [{"id":m["id"],"name":f"{m['first_name']} {m['last_name']}".strip(),
            "profile_image":m["profile_image"] or "","profile_border":m["profile_border"] or "",
            "is_owner":m["id"]==m["owner_id"]} for m in members],
        "non_members": [{"id":n["id"],"name":f"{n['first_name']} {n['last_name']}".strip(),
            "profile_image":n["profile_image"] or ""} for n in non_members],
        "group": {"id":group["id"],"name":group["name"],"image":group["image"] or "",
                  "owner_id":group["owner_id"],"created_at":group["created_at"]},
    }

@app.post("/groups/{group_id}/message")
def send_group_message(group_id: int, data: SendGroupMessageRequest, cu: dict = Depends(get_current_user)):
    if not data.text.strip(): raise HTTPException(400, "Empty message")
    conn = get_db()
    member = conn.execute("SELECT id FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'",
                          (group_id, cu["id"])).fetchone()
    if not member: conn.close(); raise HTTPException(403, "Not a member")
    conn.execute("INSERT INTO group_messages (group_id,sender_id,text) VALUES (?,?,?)",
                 (group_id, cu["id"], data.text.strip()))
    conn.commit(); conn.close()
    return {"message": "Sent!"}

@app.put("/groups/{group_id}")
def update_group(group_id: int, data: UpdateGroupRequest, cu: dict = Depends(get_current_user)):
    conn = get_db()
    group = conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
    if not group: conn.close(); raise HTTPException(404, "Group not found")
    if group["owner_id"] != cu["id"]: conn.close(); raise HTTPException(403, "Only the owner can edit this group")
    updates = []; values = []
    if data.name  is not None: updates.append("name=?");  values.append(data.name.strip())
    if data.image is not None: updates.append("image=?"); values.append(data.image)
    if not updates: conn.close(); return {"message": "Nothing to update"}
    values.append(group_id)
    conn.execute(f"UPDATE groups SET {','.join(updates)} WHERE id=?", values)
    conn.commit(); conn.close()
    return {"message": "Group updated!"}

@app.delete("/groups/{group_id}")
def delete_group(group_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    group = conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
    if not group: conn.close(); raise HTTPException(404, "Group not found")
    if group["owner_id"] != cu["id"]: conn.close(); raise HTTPException(403, "Only the owner can delete this group")
    conn.execute("DELETE FROM group_messages WHERE group_id=?", (group_id,))
    conn.execute("DELETE FROM group_members  WHERE group_id=?", (group_id,))
    conn.execute("DELETE FROM group_invites  WHERE group_id=?", (group_id,))
    conn.execute("DELETE FROM groups         WHERE id=?",       (group_id,))
    conn.commit(); conn.close()
    return {"message": "Group deleted permanently."}

@app.post("/groups/{group_id}/leave")
def leave_group(group_id: int, cu: dict = Depends(get_current_user)):
    conn = get_db()
    group = conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
    if not group: conn.close(); raise HTTPException(404, "Group not found")
    if group["owner_id"] == cu["id"]:
        conn.close(); raise HTTPException(400, "Owners can't leave — delete the group instead")
    member = conn.execute("SELECT id FROM group_members WHERE group_id=? AND user_id=?",
                          (group_id, cu["id"])).fetchone()
    if not member: conn.close(); raise HTTPException(404, "Not in this group")
    conn.execute("DELETE FROM group_members WHERE group_id=? AND user_id=?", (group_id, cu["id"]))
    user_name = f"{cu['first_name']} {cu['last_name']}".strip()
    conn.execute("INSERT INTO group_messages (group_id,sender_id,text,is_system) VALUES (?,?,?,1)",
                 (group_id, cu["id"], f"👋 {user_name} left the group"))
    conn.commit(); conn.close()
    return {"message": "You left the group."}

@app.post("/groups/{group_id}/invite")
def invite_to_group(group_id: int, data: InviteToGroupRequest, cu: dict = Depends(get_current_user)):
    conn = get_db()
    group = conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
    if not group: conn.close(); raise HTTPException(404, "Group not found")
    member = conn.execute("SELECT id FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'",
                          (group_id, cu["id"])).fetchone()
    if not member: conn.close(); raise HTTPException(403, "Not a member of this group")
    inviter_name = f"{cu['first_name']} {cu['last_name']}".strip()
    sent = 0
    for uid in data.user_ids:
        contact = conn.execute("SELECT id FROM contacts WHERE user_id=? AND contact_id=?",
                               (cu["id"], uid)).fetchone()
        if not contact: continue
        already_member = conn.execute("SELECT id FROM group_members WHERE group_id=? AND user_id=?",
                               (group_id, uid)).fetchone()
        if already_member: continue
        existing = conn.execute("SELECT id FROM group_invites WHERE group_id=? AND invitee_id=?",
                                (group_id, uid)).fetchone()
        if existing:
            invite_id = existing["id"]
            conn.execute("UPDATE group_invites SET status='pending', inviter_id=?, sent_at=CURRENT_TIMESTAMP WHERE id=?",
                         (cu["id"], invite_id))
            conn.commit()
        else:
            conn.execute("INSERT INTO group_invites (group_id,inviter_id,invitee_id,status) VALUES (?,?,?,'pending')",
                         (group_id, cu["id"], uid))
            conn.commit()
            invite_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        invite_text = f"{inviter_name} invited you to join {group['name']}"
        conn.execute(
            "INSERT INTO messages (sender_id, receiver_id, text, msg_type, group_invite_id) VALUES (?,?,?,?,?)",
            (cu["id"], uid, invite_text, "group_invite", invite_id)
        )
        conn.commit()
        sent += 1
    conn.close()
    if sent == 0:
        raise HTTPException(400, "No invites sent — they may already be members")
    return {"message": f"Invited {sent} person(s)!"}

@app.post("/groups/invites/respond")
def respond_group_invite(data: GroupInviteRespond, cu: dict = Depends(get_current_user)):
    if data.action not in ("accept","decline"): raise HTTPException(400, "Invalid action")
    conn = get_db()
    invite = conn.execute("SELECT * FROM group_invites WHERE id=? AND invitee_id=?",
                          (data.invite_id, cu["id"])).fetchone()
    if not invite: conn.close(); raise HTTPException(404, "Invite not found")
    if invite["status"] != "pending":
        conn.close(); raise HTTPException(400, "Already responded to this invite")
    if data.action == "accept":
        conn.execute("UPDATE group_invites SET status='accepted' WHERE id=?", (data.invite_id,))
        conn.execute("INSERT OR IGNORE INTO group_members (group_id,user_id,status) VALUES (?,?,'accepted')",
                     (invite["group_id"], cu["id"]))
        user_name = f"{cu['first_name']} {cu['last_name']}".strip()
        conn.execute("INSERT INTO group_messages (group_id,sender_id,text,is_system) VALUES (?,?,?,1)",
                     (invite["group_id"], cu["id"], f"👋 {user_name} joined the Vibe Squad!"))
    else:
        conn.execute("UPDATE group_invites SET status='declined' WHERE id=?", (data.invite_id,))
    conn.commit(); conn.close()
    return {"message": "Joined!" if data.action == "accept" else "Declined."}

@app.get("/groups/invites/pending")
def get_group_invites(cu: dict = Depends(get_current_user)):
    return {"invites": []}