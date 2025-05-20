// frontend/pages/_app.tsx
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
// Optional: Import dark theme for Clerk components if desired
// import { dark } from '@clerk/themes';
import type { AppProps } from 'next/app';
import Head from 'next/head'; // For setting global head elements like title, viewport
import '../styles/globals.css'; // Your global styles

function MyApp({ Component, pageProps }: AppProps) {
  // The PRD doesn't specify complex global layouts or context beyond Clerk.
  // This setup is standard and correct for enabling Clerk across the application.

  return (
    <ClerkProvider
      {...pageProps}
      // Optional: Customize the appearance of Clerk components (Modals, UserProfile, etc.)
      // For PoC, defaults are usually fine.
      // appearance={{
      //   baseTheme: undefined, // or dark for dark mode
      //   layout: {
      //     socialButtonsPlacement: 'bottom',
      //     socialButtonsVariant: 'iconButton',
      //   },
      //   variables: {
      //     colorPrimary: '#0070f3' // Example: change primary color
      //   }
      // }}
      // Optional: Localization for Clerk components
      // localization={{
      //   signUp: { start: { title: "Create your ProcessMining AI account" } }
      // }}
    >
      <Head>
        <title>AI Process Mining PoC</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI-Powered Process Mining Proof of Concept" />
        {/* Add favicon links here if you have them in `public/` */}
        {/* <link rel="icon" href="/favicon.ico" /> */}
      </Head>
      
      {/* 
        The Component and pageProps pattern is standard for Next.js _app.tsx.
        ClerkProvider ensures authentication context is available to all components.
      */}
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

export default MyApp;