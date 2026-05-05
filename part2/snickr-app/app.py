from flask import Flask, session, redirect, url_for, render_template, request, flash
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_connection
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

# ─── HOME ────────────────────────────────────────────


@app.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("workspaces"))
    return redirect(url_for("login"))

# ─── REGISTER ────────────────────────────────────────


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("register.html")

    # Get form data
    email = request.form.get("email", "").strip()
    username = request.form.get("username", "").strip()
    nickname = request.form.get("nickname", "").strip() or None
    password = request.form.get("password", "")
    confirm = request.form.get("confirm", "")

    # Basic validation
    if not email or not username or not password:
        flash("Email, username, and password are required.")
        return redirect(url_for("register"))

    if password != confirm:
        flash("Passwords do not match.")
        return redirect(url_for("register"))

    if len(password) < 6:
        flash("Password must be at least 6 characters.")
        return redirect(url_for("register"))

    # Hash password and insert into database
    password_hash = generate_password_hash(password)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO users (email, username, nickname, password_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id
            """,
            (email, username, nickname, password_hash)
        )
        user = cur.fetchone()
        conn.commit()

        # Auto-login after registration
        session["user_id"] = user["user_id"]
        session["username"] = username
        flash("Account created successfully!")
        return redirect(url_for("workspaces"))

    except Exception as e:
        conn.rollback()
        # Unique violation means email or username already taken
        if "unique" in str(e).lower():
            flash("Email or username already taken.")
        else:
            flash("Something went wrong. Please try again.")
        return redirect(url_for("register"))
    finally:
        cur.close()
        conn.close()

# ─── LOGIN ───────────────────────────────────────────


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")

    if not username or not password:
        flash("Please enter both username and password.")
        return redirect(url_for("login"))

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user is None or not check_password_hash(user["password_hash"], password):
        flash("Invalid username or password.")
        return redirect(url_for("login"))

    # Set session
    session["user_id"] = user["user_id"]
    session["username"] = user["username"]
    flash(f"Welcome back, {user['username']}!")
    return redirect(url_for("workspaces"))

# ─── LOGOUT ──────────────────────────────────────────


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.")
    return redirect(url_for("login"))

# ─── WORKSPACES (placeholder) ────────────────────────


@app.route("/workspaces")
def workspaces():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("workspaces.html")


if __name__ == "__main__":
    app.run(debug=True)
