import Link from "next/link";
import { RegisterForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm">You will verify your email, then choose a Business or Agency workspace.</p>
      <div className="mt-6"><RegisterForm /></div>
      <p className="mt-4 text-sm">Already registered? <Link className="underline" href="/login">Sign in</Link></p>
    </div>
  );
}
