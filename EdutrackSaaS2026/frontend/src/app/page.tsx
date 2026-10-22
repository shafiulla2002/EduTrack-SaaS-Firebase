"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="hero-section">
      <nav className="navbar">
        <div className="logo">EduTrack<span>SaaS</span></div>
        <div className="nav-links">
          <Link href="/login">Login</Link>
          <Link href="/register" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      <section className="hero-content">
        <h1>Modern School Management, <span>Simplified.</span></h1>
        <p>A complete independent SaaS platform for schools and colleges. Multi-tenant, secure, and built for scale.</p>
        
        <div className="cta-group">
          <Link href="/register" className="btn-primary btn-large">Launch Your Institution</Link>
          <Link href="/demo" className="btn-secondary">Request Demo</Link>
        </div>
      </section>

      <style jsx>{`
        .hero-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at top right, hsla(var(--primary), 0.05), transparent);
        }
        .navbar {
          display: flex;
          justify-content: space-between;
          padding: 2rem 5%;
          align-items: center;
        }
        .logo {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.05em;
        }
        .logo span {
          color: hsl(var(--primary));
          opacity: 0.6;
        }
        .nav-links {
          display: flex;
          gap: 2rem;
          align-items: center;
        }
        .nav-links a {
          text-decoration: none;
          color: hsl(var(--muted-foreground));
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-links a:hover {
          color: hsl(var(--foreground));
        }
        .hero-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 0 10%;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          font-size: 4rem;
          font-weight: 850;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          letter-spacing: -0.02em;
        }
        h1 span {
          background: linear-gradient(90deg, hsl(var(--primary)), #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 1.25rem;
          color: hsl(var(--muted-foreground));
          max-width: 600px;
          margin-bottom: 2.5rem;
          line-height: 1.6;
        }
        .cta-group {
          display: flex;
          gap: 1rem;
        }
        .btn-large {
          padding: 1rem 2.5rem;
          font-size: 1.1rem;
        }
        .btn-secondary {
          padding: 1rem 2.5rem;
          border-radius: var(--radius);
          border: 1px solid hsl(var(--border));
          text-decoration: none;
          color: inherit;
          font-weight: 600;
        }
      `}</style>
    </main>
  );
}
