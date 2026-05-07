"use client";
import React from "react";
import Link from "next/link";
import SignupWithPassword from "../SignupWithPassword";

export default function Signup() {
  return (
    <>
      <SignupWithPassword />

      <div className="mt-4.5 text-center font-medium">
        <p>
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}
