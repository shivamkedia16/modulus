// pages/meeting.js
import { useState, useEffect } from 'react'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Move Agora initialization to state
let agoraClient = null;

// Utility function for logging with timestamps
const log = (message, data = null) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
  if (data) {
    console.log('Data:', data)
  }
}

export default function Meeting() {
  const [step, setStep] = useState('form')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [meetingId, setMeetingId] = useState(null)
  const [error, setError] = useState(null)
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false)

  // Initialize Agora on client side only
  useEffect(() => {
    const initializeAgora = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        setIsAgoraInitialized(true);
        log('Agora client initialized successfully');
      } catch (err) {
        log('Error initializing Agora:', err);
      }
    };

    initializeAgora();
  }, []);

  // Log component mount
  useEffect(() => {
    log('Meeting component mounted')
    return () => {
      log('Meeting component unmounting')
    }
  }, [])

  // Log step changes
  useEffect(() => {
    log(`Step changed to: ${step}`)
  }, [step])

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    log('Form submission started', formData)
    setError(null)

    try {
      // Use constant channel name for demo
      const channelName = 'modulus_demo';  // Your constant channel name
      log('Using demo channel:', channelName);

      log('Inserting meeting request into Supabase...')
      const { data, error: dbError } = await supabase
        .from('meeting_requests')
        .insert([
          {
            user_name: formData.name,
            email: formData.email,
            phone: formData.phone,
            agora_channel: channelName,
            status: 'pending'
          }
        ])
        .select()

      if (dbError) {
        log('Supabase insertion error:', dbError)
        throw dbError
      }

      log('Meeting request created successfully', data)
      setMeetingId(data[0].id)
      setStep('options')
    } catch (err) {
      const errorMessage = 'Failed to create meeting request. Please try again.'
      log('Form submission error:', err)
      setError(errorMessage)
    }
  }

  const handleJoinDemo = async () => {
    log('Join demo clicked')
    setStep('waiting')
    
    try {
      log('Setting up Supabase subscription for meeting:', meetingId)
      const subscription = supabase
        .channel('meeting_status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'meeting_requests',
            filter: `id=eq.${meetingId}`
          },
          async (payload) => {
            log('Received Supabase update:', payload)
            if (payload.new.status === 'agent_joined') {
              log('Agent joined, initializing Agora call')
              await initializeAgoraCall(payload.new.agora_channel)
              setStep('in-call')
            }
          }
        )
        .subscribe()

      return () => {
        log('Cleaning up Supabase subscription')
        subscription.unsubscribe()
      }
    } catch (err) {
      log('Error in handleJoinDemo:', err)
      setError('Failed to join meeting. Please try again.')
      setStep('options')
    }
  }

  const initializeAgoraCall = async (channelName) => {
    if (!isAgoraInitialized || !agoraClient) {
      log('Agora not initialized yet');
      setError('Video call system not ready. Please try again.');
      return;
    }

    log('Initializing Agora call for channel:', channelName)
    try {
      const token = process.env.NEXT_PUBLIC_AGORA_TOKEN;
      log('Joining with token:', token ? 'Token present' : 'No token');
      
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
      await agoraClient.join(
        process.env.NEXT_PUBLIC_AGORA_APP_ID,
        channelName,
        token,
        null
      )

      log('Creating local tracks...')
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()
      log('Local tracks created successfully')

      log('Playing local video track')
       const playLocalVideo = async () => {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      const localPlayer = document.getElementById('local-video')
      log('Local video element exists:', !!localPlayer)
      if (localPlayer) {
        try {
          await videoTrack.play('local-video', { fit: 'contain' })
          log('Local video playing successfully')
        } catch (err) {
          log('Error playing local video:', err)
        }
      } else {
        log('Local video element not found!')
      }
    }
    await playLocalVideo()

      log('Publishing local tracks...')
      await agoraClient.publish([audioTrack, videoTrack])
      log('Local tracks published successfully')

      // Handle remote user joining
      agoraClient.on('user-published', async (user, mediaType) => {
        log('Remote user published:', { userId: user.uid, mediaType })
        await agoraClient.subscribe(user, mediaType)
        log('Subscribed to remote user:', user.uid)
        
        if (mediaType === 'video') {
          const playRemoteVideo = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            const remotePlayer = document.getElementById('remote-video')
            log('Remote video element exists:', !!remotePlayer)
            if (remotePlayer) {
              try {
                await user.videoTrack.play('remote-video', { fit: 'contain' })
                log('Remote video playing successfully')
              } catch (err) {
                log('Error playing remote video:', err)
              }
            } else {
              log('Remote video element not found!')
            }
          }
          await playRemoteVideo()
        }
        if (mediaType === 'audio') {
          log('Playing remote audio')
          user.audioTrack.play()
        }
      })

      return () => {
        log('Cleaning up Agora call')
        audioTrack.close()
        videoTrack.close()
        agoraClient.leave()
      }
    } catch (err) {
      log('Error in initializeAgoraCall:', err)
      log('Agora connection details:', {
        appId: process.env.NEXT_PUBLIC_AGORA_APP_ID ? 'Present' : 'Missing',
        channel: channelName,
        tokenStatus: process.env.NEXT_PUBLIC_AGORA_TOKEN ? 'Present' : 'Missing'
      })
      setError(`Failed to initialize video call: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Demo Call</title>
        <meta name="description" content="Start your demo call" />
      </Head>

      <div className="max-w-md mx-auto">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-center text-gray-900">Start Demo Call</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Continue
            </button>
          </form>
        )}

        {step === 'options' && (
          <div className="space-y-4 bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">Choose an Option</h2>
            
            <button
              onClick={handleJoinDemo}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Join Demo Now
            </button>
            
            <button
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700"
            >
              Schedule For Later
            </button>
          </div>
        )}

        {step === 'waiting' && (
          <div className="text-center bg-white p-6 rounded-lg shadow">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">Waiting for agent...</h2>
            <p className="mt-2 text-sm text-gray-500">An agent will join shortly.</p>
          </div>
        )}

        {step === 'in-call' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="w-full bg-gray-900 rounded-lg overflow-hidden relative" style={{ height: '480px' }}>
              <div id="remote-video" className="w-full h-full absolute inset-0 bg-black"></div>
              <div id="local-video" className="absolute top-4 right-4 w-1/4 h-32 bg-gray-800 rounded overflow-hidden z-10"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}