// frontend/pages/dashboard.tsx
import { useState, ChangeEvent, FormEvent } from 'react';
import { useUser, SignedIn, UserButton } from '@clerk/nextjs'; // Added UserButton for easy sign out
import ProcessGraph from '../components/ProcessGraph'; // As per PRD Section 3 & 7
import InsightsPanel from '../components/InsightsPanel'; // As per PRD Section 3 & 7
// Assuming fetchWithAuth is set up as per PRD Section 3 (utils/fetchWithAuth.ts)
// If not, you'd use the useAuth hook from Clerk to get the token for fetch.
// For simplicity here, I'll assume fetch handles auth internally or use useAuth().getToken()
import { useAuth } from '@clerk/nextjs';


// Types based on PRD Section 5.4 (Backend API Response)
interface ProcessGraphNode {
  id: string;
  label: string;
  frequency?: number;
  avg_duration_sec?: number | null;
  // Add other properties D3/React Flow might need based on your ProcessGraph.tsx
}

interface ProcessGraphLink {
  source: string;
  target: string;
  count?: number;
  avg_lead_time_sec?: number | null;
  // Add other properties D3/React Flow might need
}

interface ProcessGraphData {
  nodes: ProcessGraphNode[];
  links: ProcessGraphLink[];
}

interface LLMInsightItem {
  activity?: string;
  reason?: string;
  loop?: string[];
  impact?: string;
  observation?: string;
  suggestion?: string;
  item?: string;
  description?: string;
  // Add any other specific fields from your LLM output structure
}

interface LLMInsightsData {
  summary: string;
  bottlenecks: LLMInsightItem[];
  rework_loops: LLMInsightItem[];
  inefficiencies: LLMInsightItem[];
  anomalies: LLMInsightItem[];
}

interface BackendSuccessData {
  processGraph: ProcessGraphData;
  llmInsights: LLMInsightsData;
}

interface BackendApiResponse {
  success: boolean;
  message: string;
  data?: BackendSuccessData | null;
}

export default function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth(); // For manually fetching token if not using fetchWithAuth utility

  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [processGraphData, setProcessGraphData] = useState<ProcessGraphData | null>(null);
  const [llmInsightsData, setLlmInsightsData] = useState<LLMInsightsData | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProcessGraphData(null); // Reset previous results when new file is selected
    setLlmInsightsData(null);
    setError(null);
    setSuccessMessage(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // PRD Section 5: Expects .csv or .xes. .xlsx also common.
      const allowedExtensions = /(\.csv|\.xes|\.xlsx)$/i;
      if (!allowedExtensions.exec(selectedFile.name)) {
          setError('Invalid file type. Please upload a .csv, .xes, or .xlsx file.');
          setFile(null);
          e.target.value = ''; // Reset file input
          return;
      }
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setProcessGraphData(null);
    setLlmInsightsData(null);

    const formData = new FormData();
    // The field name 'eventLogFile' here must match what /api/upload.ts expects
    formData.append('eventLogFile', file);

    try {
      const sessionToken = await getToken();
      if (!sessionToken) {
        setError("Authentication error. Please sign in again.");
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/upload', { // This calls our Next.js API route
        method: 'POST',
        headers: {
          // The Authorization header is handled by Clerk's middleware or
          // can be added here if '/api/upload' is not automatically protected.
          // For Next.js API routes protected by Clerk, often you don't need to manually set it.
          // However, our `/api/upload` explicitly gets token using `getAuth(req)`.
          // So, Clerk's client-side `fetch` wrapper might not automatically add it.
          // If using `fetchWithAuth.ts` from PRD, it would handle this.
          // If not, we can add it:
          // 'Authorization': `Bearer ${sessionToken}`,
        },
        body: formData,
      });

      const result: BackendApiResponse = await res.json();

      if (!res.ok || !result.success) {
        setError(result.message || 'An unknown error occurred during processing.');
        if (result.data) { // If backend sends partial data on error, you could handle it
            setProcessGraphData(result.data.processGraph || null);
            setLlmInsightsData(result.data.llmInsights || null);
        }
      } else if (result.success && result.data) {
        setSuccessMessage(result.message || 'File processed successfully!');
        setProcessGraphData(result.data.processGraph);
        setLlmInsightsData(result.data.llmInsights);
      } else {
        setError('Received an unexpected response structure from the server.');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'An unexpected error occurred. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SignedIn>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              AI Process Mining Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.firstName || user?.primaryEmailAddress?.emailAddress}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        <main className="flex-grow container mx-auto p-4 md:p-8 space-y-8">
          <section className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Upload Event Log</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Event Log File (.csv, .xes, .xlsx)
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xes,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" // More specific accept
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {file && <p className="mt-1 text-xs text-gray-500">Selected: {file.name}</p>}
              </div>
              <button
                type="submit"
                disabled={!file || isLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium text-sm leading-tight uppercase rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Upload and Analyze'
                )}
              </button>
            </form>
            {error && <p className="mt-4 text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
            {successMessage && !error && <p className="mt-4 text-sm text-green-600 bg-green-100 p-3 rounded-md">{successMessage}</p>}
          </section>

          {/* Conditional rendering based on PRD requirements */}
          {isLoading && (
            <div className="bg-white p-6 rounded-xl shadow-lg text-center">
              <p className="text-lg text-gray-700">Loading process model and insights...</p>
              {/* You could add a more sophisticated loading animation here */}
            </div>
          )}

          {!isLoading && processGraphData && llmInsightsData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <section className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Discovered Process Model</h2>
                {/* PRD Section 7: ProcessGraph.tsx */}
                <div className="h-[500px] border border-gray-200 rounded-md overflow-hidden"> {/* Set a fixed height or make it responsive */}
                   <ProcessGraph nodes={processGraphData.nodes} links={processGraphData.links} />
                </div>
              </section>

              <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">AI-Generated Insights</h2>
                {/* PRD Section 7: InsightsPanel.tsx */}
                <InsightsPanel insights={llmInsightsData} />
              </section>
            </div>
          )}
        </main>
        <footer className="text-center p-4 text-sm text-gray-500">
            Proof of Concept - AI Process Mining
        </footer>
      </div>
    </SignedIn>
  );
}