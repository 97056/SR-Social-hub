import Link from "next/link";
import { LoginForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <div className="mt-6"><LoginForm /></div>
      <p className="mt-4 text-sm"><Link className="underline" href="/forgot-password">Forgot password</Link></p>
    </div>
  );
}
