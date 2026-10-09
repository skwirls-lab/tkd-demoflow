"use client";

import { useState } from "react";
import { signIn, signUp, resetPassword } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";

const friendlyError = (err: unknown) => {
  const { code, message } = err as { code?: string; message?: string };
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect. Use \"Forgot password?\" if you need to reset it.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, or reset your password.";
    case "auth/network-request-failed":
      return "No connection. Check your wifi or signal and try again.";
    default:
      return message || "An error occurred";
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [info, setInfo] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.push("/roster");
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above first, then tap \"Forgot password?\" again.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setInfo(`Password reset email sent to ${email.trim()}. Check your inbox (and spam folder).`);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-belt-black px-4 py-8">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 relative w-24 h-24">
            <Image 
              src="/logo/logo.png" 
              alt="TKD DemoFlow Logo" 
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-black text-belt-white uppercase tracking-tight">
            {isSignUp ? "Create Account" : "TKD DEMOFLOW"}
          </h1>
          <p className="text-[10px] font-black text-belt-white/40 uppercase tracking-[0.2em] mt-2">
            DEMONSTRATION TEAM COMMAND CENTER
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-belt-white/80 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-belt-white/80 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          {!isSignUp && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-sm text-belt-white/60 hover:text-belt-white py-2"
              >
                Forgot password?
              </button>
            </div>
          )}

          {info && (
            <div className="bg-green-900/30 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm">
              {info}
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setInfo("");
            }}
            className="text-belt-red hover:text-red-400 text-sm"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-belt-white/40 text-xs">
            TKD DemoFlow Command Center v0.1.0
          </p>
        </div>
      </div>
    </div>
  );
}
