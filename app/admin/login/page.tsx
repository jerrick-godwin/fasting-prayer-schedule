import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdminAuthenticated()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <p className="eyebrow">United for God</p>
        <h1>Booking dashboard</h1>
        <p>Enter the organiser password to continue.</p>
        <form action={loginAction} className="admin-login-form">
          <label><span>Password</span><input name="password" type="password" autoComplete="current-password" required autoFocus /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="submit-button" type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
