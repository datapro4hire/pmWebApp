// pages/index.tsx
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // If already signed in, redirect to dashboard
    // (Clerk handles session in <SignedIn>)
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="max-w-2xl p-6 bg-white rounded-2xl shadow-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🧠 Process Mining AI
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Upload your event logs and let our AI map your processes, identify bottlenecks, and optimize flows.
        </p>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition">
              Sign In to Get Started
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition"
          >
            Go to Dashboard
          </button>
        </SignedIn>
      </div>
    </main>
  );
}
