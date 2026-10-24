import { supabaseClient } from "@/config/supabase-client";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Session } from "@supabase/supabase-js";
  
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
  
    useEffect(() => {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setLoading(false)
        if (!session) {
          navigate('/')
        }
      })
    }, [navigate])
  
    if (loading) {
      return <div className="flex items-center justify-center h-screen">Loading...</div>
    }
  
    return session ? <>{children}</> : <Navigate to="/" />
  }
export default ProtectedRoute