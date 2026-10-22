"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Logging in with:", email, password);
    // Add authentication logic here
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Login to your school portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="name@school.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn-primary w-full">Sign In</button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link href="/register">Register your school</Link></p>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle at bottom left, hsla(var(--primary), 0.05), transparent);
        }
        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        h2 {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.04em;
        }
        p {
          color: hsl(var(--muted-foreground));
          font-size: 0.9rem;
        }
        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: hsl(var(--foreground));
        }
        .w-full {
          width: 100%;
        }
        .auth-footer {
          margin-top: 1.5rem;
          text-align: center;
          font-size: 0.85rem;
        }
        .auth-footer a {
          color: hsl(var(--primary));
          text-decoration: none;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
