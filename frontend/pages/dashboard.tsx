// dashboard.tsx
import { useState } from 'react';
import { useUser, SignedIn } from '@clerk/nextjs';

export default function Dashboard() {
  const { user } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setMessage(data.message || 'Upload complete');
  };

  return (
    <SignedIn>
      <main className="min-h-screen bg-gray-100 p-10">
        <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow">
          <h1 className="text-2xl font-bold mb-4">Welcome, {user?.firstName}</h1>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mb-4"
          />
          <button
            onClick={handleUpload}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Upload Log File
          </button>
          <p className="mt-4 text-sm text-gray-600">{message}</p>
          {/* D3.js placeholder here */}
        </div>
      </main>
    </SignedIn>
  );
}
