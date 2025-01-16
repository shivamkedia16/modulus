// pages/_app.js

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import '../styles/globals.css'

// Add logging for Supabase initialization
console.log('Initializing Supabase client...')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
console.log('Supabase client initialized successfully')

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} supabaseClient={supabase} />
}

export default MyApp