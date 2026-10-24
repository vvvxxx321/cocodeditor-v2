import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { updateExistingUsernames } from "@/lib/user-utils";

const AuthPage = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up with username
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              user_name: username,
            },
          },
        });

        if (signUpError) throw signUpError;

        // The profile will be automatically created by the trigger
        // We don't need to manually create it anymore
        console.log('Sign up successful:', signUpData);

        navigate('/verify-email');
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen p-6 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
      <div className="max-w-md mx-auto">
        <Card className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}`}>
          <CardHeader>
            <CardTitle className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </CardTitle>
            <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              {isSignUp ? 'Create a new account to get started' : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAuth}>
            <CardContent className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="username" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    className={theme === 'dark' ? 'bg-gray-700/50 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className={theme === 'dark' ? 'bg-gray-700/50 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={theme === 'dark' ? 'bg-gray-700/50 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}
                />
              </div>
              {error && (
                <div className={`p-3 rounded-md ${
                  theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'
                }`}>
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className={`w-full ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsSignUp(!isSignUp)}
                className={`w-full ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;