// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Log when index page is loaded
    console.log('Index page loaded');
    console.log('Environment check:', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set',
      agoraAppId: process.env.NEXT_PUBLIC_AGORA_APP_ID ? 'Set' : 'Not set',
    });
  }, []);

  const handleStartDemo = () => {
    console.log('Navigating to meeting page');
    router.push('/meeting');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Head>
        <title>Demo Call App</title>
        <meta name="description" content="Start a demo call" />
      </Head>

      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Video Call Demo
        </h1>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium">Environment Status:</p>
            <ul className="mt-2 space-y-1">
              <li>
                Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}
              </li>
              <li>
                Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌'}
              </li>
              <li>
                Agora App ID: {process.env.NEXT_PUBLIC_AGORA_APP_ID ? '✅' : '❌'}
              </li>
              <li>
                Channel Name: demovideocall123
              </li>
            </ul>
          </div>

          <button
            onClick={handleStartDemo}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Start Demo Call
          </button>
        </div>
      </div>
    </div>
  );
}