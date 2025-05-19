// pages/api/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { getAuth } from '@clerk/nextjs/server'; // For backend authentication

// Disable Next.js body parsing, as formidable handles it
export const config = {
  api: {
    bodyParser: false,
  },
};

// Define a type for the expected backend response structure (as per PRD Section 5)
// This helps with type safety when handling the backend's response.
interface BackendSuccessResponseData {
  processGraph: {
    nodes: Array<Record<string, any>>; // Define more specific types if known
    links: Array<Record<string, any>>; // Define more specific types if known
  };
  llmInsights: {
    summary: string;
    bottlenecks: Array<Record<string, any>>;
    rework_loops: Array<Record<string, any>>;
    inefficiencies: Array<Record<string, any>>;
    anomalies: Array<Record<string, any>>;
  };
}

interface BackendResponse {
  success: boolean;
  message: string;
  data?: BackendSuccessResponseData | null; // data is present on success
}


export default async function handler(req: NextApiRequest, res: NextApiResponse<BackendResponse | { message: string }>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 1. Authentication using Clerk (as per PRD Section 4)
  const { getToken, userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: No user ID found.' });
  }
  const token = await getToken();
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token available.' });
  }

  // Prepare formidable
  // We'll save the file temporarily to pass it to the backend
  // This directory can be configured or made more robust in a production setting
  const tempUploadDir = path.join(process.cwd(), '/tmp/uploads'); // Using /tmp for temporary storage
  try {
    if (!fs.existsSync(tempUploadDir)) {
      fs.mkdirSync(tempUploadDir, { recursive: true });
    }
  } catch (dirError) {
    console.error('Failed to create temp upload directory:', dirError);
    return res.status(500).json({ message: 'Server configuration error for file uploads.' });
  }

  const form = formidable({
    uploadDir: tempUploadDir,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, // Example: 100MB limit, adjust as needed
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form data:', err);
      return res.status(500).json({ message: `File upload failed: ${err.message}` });
    }

    // PRD Section 5: Expects .csv or .xes file.
    // Assuming the frontend sends the file under the field name 'eventLogFile'
    const uploadedFile = files.eventLogFile;

    if (!uploadedFile || Array.isArray(uploadedFile) || !uploadedFile.filepath) {
      return res.status(400).json({ message: 'No file uploaded or multiple files received. Please upload a single event log file.' });
    }

    const persistentFile = uploadedFile as formidable.PersistentFile;

    // Validate file type (optional but good practice based on PRD)
    const allowedMimeTypes = ['text/csv', 'application/xml', 'application/xes', 'application/vnd.ms-excel']; // .xes can be application/xml or a specific one
    const allowedExtensions = ['.csv', '.xes', '.xlsx']; // .xlsx also often requested
    
    const fileExt = path.extname(persistentFile.originalFilename || '').toLowerCase();
    if (!persistentFile.mimetype || (!allowedMimeTypes.includes(persistentFile.mimetype) && !allowedExtensions.includes(fileExt))) {
       // Clean up the invalid file immediately
      try {
        fs.unlinkSync(persistentFile.filepath);
      } catch (cleanupError) {
        console.error('Failed to cleanup invalid temp file:', cleanupError);
      }
      return res.status(400).json({ message: `Invalid file type. Please upload a .csv, .xes, or .xlsx file. Received: ${persistentFile.mimetype || fileExt}` });
    }

    // 2. Forward the file to the Flask backend (as per PRD Section 5.3)
    const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
    if (!backendApiUrl) {
      console.error('Backend API URL is not configured.');
      // Clean up before returning
      try { fs.unlinkSync(persistentFile.filepath); } catch (e) { /* ignore */ }
      return res.status(500).json({ message: 'Server configuration error: Backend API URL missing.' });
    }
    const targetUrl = `${backendApiUrl}/process`; // PRD specifies /api/process, assuming backendApiUrl includes /api

    try {
      const backendFormData = new FormData();
      const fileBuffer = fs.readFileSync(persistentFile.filepath);
      const fileBlob = new Blob([fileBuffer], { type: persistentFile.mimetype || 'application/octet-stream' });
      
      // The field name 'file' here must match what the Flask backend expects
      backendFormData.append('file', fileBlob, persistentFile.originalFilename || 'uploaded_file.csv');

      const backendResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type' for 'multipart/form-data' is set automatically by fetch when body is FormData
        },
        body: backendFormData,
      });

      // 3. Return the JSON response from the backend (as per PRD Section 5.4)
      const backendData: BackendResponse = await backendResponse.json();

      if (!backendResponse.ok) {
        // Forward the error status and message from the backend
        return res.status(backendResponse.status).json({ 
          success: backendData.success !== undefined ? backendData.success : false,
          message: backendData.message || 'Error processing file with backend.',
          data: backendData.data // include data if backend sends it on error
        });
      }

      return res.status(200).json(backendData);

    } catch (proxyError: any) {
      console.error('Error proxying request to backend:', proxyError);
      return res.status(502).json({ message: `Bad Gateway: Could not connect to backend service. ${proxyError.message}` });
    } finally {
      // 4. Clean up the temporarily saved file
      if (persistentFile && persistentFile.filepath) {
        try {
          fs.unlinkSync(persistentFile.filepath);
        } catch (cleanupError) {
          console.error('Failed to cleanup temp file:', persistentFile.filepath, cleanupError);
        }
      }
    }
  });
}