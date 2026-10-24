import React, { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-context-provider";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ProfilePage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // Load user profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // Get user metadata from Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        // Set username from profile or use email as fallback
        setUsername(data?.username || user.email?.split('@')[0] || 'User');
        setAvatarUrl(data?.avatar_url || null);
      } catch (error) {
        console.error('Error loading profile:', error);
        setMessage({ type: "error", text: "Failed to load profile data" });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setMessage(null);
    
    try {
      // Update user metadata in Supabase
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      // Update user metadata in auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          user_name: username,
          avatar_url: avatarUrl
        }
      });
      
      if (updateError) throw updateError;
      
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: "error", text: "Failed to save profile" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;
      
      // Upload image to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setAvatarUrl(data.publicUrl);
      setMessage({ type: "success", text: "Avatar uploaded successfully" });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: "error", text: "Failed to upload avatar" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen p-6 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
      <div className="max-w-2xl mx-auto">
        <Card className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}`}>
          <CardHeader>
            <CardTitle className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
              Profile Settings
            </CardTitle>
            <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              Manage your profile information and avatar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl || undefined} alt={username} />
                  <AvatarFallback className={`text-xl ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                    {username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className={`absolute bottom-0 right-0 p-1.5 rounded-full cursor-pointer ${
                    theme === 'dark' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                </label>
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={isLoading}
                />
              </div>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Click the camera icon to upload a new avatar
              </p>
            </div>
            
            {/* Username Section */}
            <div className="space-y-2">
              <Label htmlFor="username" className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Username
              </Label>
              <div className="flex items-center space-x-2">
                <User className={`h-4 w-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className={theme === 'dark' ? 'bg-gray-700/50 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}
                />
              </div>
            </div>
            
            {/* Email Section (read-only) */}
            <div className="space-y-2">
              <Label className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                Email
              </Label>
              <div className={`p-2 rounded-md ${theme === 'dark' ? 'bg-gray-700/30 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                {user?.email}
              </div>
            </div>
            
            {/* Message Display */}
            {message && (
              <div className={`p-3 rounded-md ${
                message.type === 'success' 
                  ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                  : theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'
              }`}>
                {message.text}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSaving || isLoading}
              className={theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage; 