import Link from "next/link";
import Signin from "@/components/Auth/Signin";

export default function SignInPage() {
  return (
    <div>
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-bold text-dark dark:text-white"
        >
          <span>💬</span>
          <span>Snickr</span>
        </Link>
        <h1 className="mt-5 text-heading-4 font-bold text-dark dark:text-white">
          Sign in to your account
        </h1>
        <p className="mt-2 text-dark-4 dark:text-dark-6">
          Enter your email and password to access Snickr.
        </p>
      </div>

      <Signin />
    </div>
  );
}
