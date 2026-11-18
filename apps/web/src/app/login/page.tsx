"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("nusantara-industrial");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="orva-login-orb orva-login-orb--one" aria-hidden="true" />
      <div className="orva-login-orb orva-login-orb--two" aria-hidden="true" />
      <header className="orva-login-header">
        <Link href="/" className="orva-login-wordmark" aria-label="ORVA home">orva<span>.</span></Link>
        <span className="orva-login-header-note"><ShieldCheck size={14}/> SECURE BUSINESS PLATFORM</span>
      </header>

      <div className="orva-login-layout">
        <section className="orva-login-story">
          <div className="orva-login-story-kicker"><span/> ONE CONNECTED WORKSPACE</div>
          <h1>Clarity for every<br/><em>business move.</em></h1>
          <p>Bring your teams, operations and business information together in one connected workspace.</p>
          <div className="orva-login-feature-list">
            <div><span><Building2 size={17}/></span><div><strong>One business workspace</strong><small>Work across your organization with a shared operating view.</small></div></div>
            <div><span><LockKeyhole size={17}/></span><div><strong>Access built around your role</strong><small>Your workspace access follows your organization permissions.</small></div></div>
            <div><span><Sparkles size={17}/></span><div><strong>Designed for focused work</strong><small>Move from overview to daily operations without the clutter.</small></div></div>
          </div>
          <div className="orva-login-story-footer">ORVA <span>·</span> Enterprise business platform</div>
        </section>

        <section className="orva-login-card">
          <div className="orva-login-card-top">
            <div className="orva-login-icon"><LockKeyhole size={19}/></div>
            <span className="orva-login-secure"><span/> SECURE SIGN IN</span>
          </div>
          <div className="orva-login-kicker">WELCOME BACK</div>
          <h2>Sign in to ORVA</h2>
          <p className="orva-login-description">Enter your organization credentials to continue to your workspace.</p>

          <form onSubmit={handleSubmit} className="orva-login-form">
            <label>Email address
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required maxLength={254}/>
            </label>
            <label>Password
              <span className="orva-password-field">
                <input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required maxLength={256}/>
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
              </span>
            </label>
            <label>Workspace ID
              <input type="text" autoComplete="organization" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} placeholder="your-workspace" required maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}"/>
              <small className="orva-field-hint">The workspace identifier provided by your administrator.</small>
            </label>
            {error && <p className="orva-login-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? <><span className="orva-login-spinner"/> Signing in securely...</> : <>Continue to workspace <ArrowRight size={17}/></>}</button>
          </form>

          <div className="orva-login-assurance"><ShieldCheck size={16}/><span>Your session is protected by ORVA workspace access controls.</span></div>
          <p className="orva-login-footnote">Need access? Contact your organization administrator.</p>
        </section>
      </div>
      <footer className="orva-login-footer"><span>© {new Date().getFullYear()} ORVA</span><span>by LogiSource Digital</span><span>Enterprise workspace</span></footer>
    </main>
  );
}
