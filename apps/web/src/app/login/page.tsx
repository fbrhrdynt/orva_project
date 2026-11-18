"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("nusantara-industrial");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      const payload = await response.json() as { error?: string; ok?: boolean };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "Unable to sign in. Check your details and try again.");
        return;
      }
      router.replace("/overview");
      router.refresh();
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="orva-login-page">
      <header className="orva-login-header"><Link href="/" className="orva-login-wordmark">orva<span>.</span></Link><span>ENTERPRISE BUSINESS PLATFORM</span></header>
      <section className="orva-login-card">
        <div className="orva-login-icon"><LockKeyhole size={19}/></div>
        <div className="orva-login-kicker">WORKSPACE ACCESS</div>
        <h1>Sign in to ORVA</h1>
        <p className="orva-login-description">Use your organization account to access your workspace.</p>
        <form onSubmit={handleSubmit} className="orva-login-form">
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required maxLength={254}/></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required maxLength={256}/></label>
          <label>Workspace ID<input type="text" autoComplete="organization" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} placeholder="your-workspace" required maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}"/></label>
          {error && <p className="orva-login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}<ArrowRight size={16}/></button>
        </form>
        <p className="orva-login-footnote">Access is managed by your organization administrator.</p>
      </section>
      <footer className="orva-login-footer">orva. <span>·</span> One platform. Many ways to work.</footer>
    </main>
  );
}
