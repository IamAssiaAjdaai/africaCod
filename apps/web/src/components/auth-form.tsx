"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { authClient } from "@africacod/auth/client";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signingUp = mode === "sign-up";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const credentials = {
        email: String(data.get("email")),
        password: String(data.get("password")),
      };
      const result = signingUp
        ? await authClient.signUp.email({
            ...credentials,
            name: String(data.get("name")),
          })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        setError(
          result.error.message ?? "Unable to sign in. Please try again.",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <p className="eyebrow">WELCOME TO AFRICACOD</p>
      <h1>{signingUp ? "Create your account" : "Sign in"}</h1>
      <p className="muted">
        {signingUp
          ? "Set up your account to manage stores and markets."
          : "Access your stores and COD operations."}
      </p>
      <form onSubmit={submit} className="stack-form">
        {signingUp && (
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              placeholder="Your name"
              minLength={2}
              maxLength={100}
              required
              disabled={pending}
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@yourbusiness.com"
            required
            disabled={pending}
          />
        </label>
        <label>
          Password
          <div className="password-input">
            <input
              type={visible ? "text" : "password"}
              name="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              minLength={signingUp ? 10 : 1}
              maxLength={128}
              placeholder={
                signingUp ? "At least 10 characters" : "Enter your password"
              }
              required
              disabled={pending}
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-green full-width" disabled={pending}>
          {pending ? "Please wait…" : signingUp ? "Create account" : "Log in"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="auth-switch">
        {signingUp ? "Already have an account?" : "New to AfricaCod?"}{" "}
        <Link href={signingUp ? "/sign-in" : "/sign-up"}>
          {signingUp ? "Log in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}
