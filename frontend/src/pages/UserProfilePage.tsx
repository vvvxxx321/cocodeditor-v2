import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/auth-context-provider";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, MessageSquare, ArrowLeft, Edit2, Save, X, Upload, Camera } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  email: string;
  created_at: string;
}

const UserProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setError('Username is required');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();
        
        if (profileError) throw profileError;
        
        if (!data) {
          setError('User not found');
          return;
        }
        
        setProfile(data as UserProfile);
        setEditedUsername(data.username);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [username]);

  const handleStartChat = () => {
    if (!profile) return;
    navigate(`/chat/${profile.id}`);
  };

  const handleUpdateUsername = async () => {
    if (!profile || !currentUser) return;

    try {
      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', editedUsername)
        .neq('id', currentUser.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw checkError;
      }

      if (existingUser) {
        toast({
          title: "Error",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        return;
      }

      // Update username in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: editedUsername })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { user_name: editedUsername }
      });

      if (authError) throw authError;

      setProfile({ ...profile, username: editedUsername });
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your username has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size should be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUser.id}/${currentUser.id}-${Math.random()}.${fileExt}`;

    setIsUploading(true);

    try {
      // First, try to delete any existing avatar
      try {
        const { data: existingFiles } = await supabase.storage
          .from('avatars')
          .list(currentUser.id);

        if (existingFiles && existingFiles.length > 0) {
          await supabase.storage
            .from('avatars')
            .remove(existingFiles.map(file => `${currentUser.id}/${file.name}`));
        }
      } catch (error) {
        console.warn('Error deleting existing avatar:', error);
      }

      // Upload the new image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      // Update the local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating avatar:', error);
      let errorMessage = "Failed to update profile picture. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('duplicate')) {
          errorMessage = "An avatar with this name already exists. Please try again.";
        } else if (error.message.includes('permission')) {
          errorMessage = "You don't have permission to update your avatar. Please contact support.";
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen p-6 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
        <div className="max-w-2xl mx-auto">
          <Card className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}`}>
            <CardContent className="flex items-center justify-center p-8">
              <div className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Loading profile...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={`min-h-screen p-6 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
        <div className="max-w-2xl mx-auto">
          <Card className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}`}>
            <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className={`text-center ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                {error || 'Profile not found'}
              </div>
              <Button
                onClick={() => navigate(-1)}
                className={theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className={`min-h-screen p-6 ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
      <div className="max-w-2xl mx-auto">
        <Card className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className={theme === 'dark' ? 'hover:bg-gray-700/50 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                    {isEditing ? (
                      <Input
                        value={editedUsername}
                        onChange={(e) => setEditedUsername(e.target.value)}
                        className={`w-48 ${theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}`}
                      />
                    ) : (
                      profile.username
                    )}
                  </CardTitle>
                  <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                    User Profile
                  </CardDescription>
                </div>
              </div>
              {isOwnProfile && (
                <div className="flex space-x-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleUpdateUsername}
                        className={theme === 'dark' ? 'hover:bg-gray-700/50 text-green-400 hover:text-green-300' : 'hover:bg-gray-100 text-green-600 hover:text-green-700'}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedUsername(profile.username);
                        }}
                        className={theme === 'dark' ? 'hover:bg-gray-700/50 text-red-400 hover:text-red-300' : 'hover:bg-gray-100 text-red-600 hover:text-red-700'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditing(true)}
                      className={theme === 'dark' ? 'hover:bg-gray-700/50 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                  <AvatarFallback className={`text-xl ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                    {profile.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleUpdateAvatar}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className={`absolute bottom-0 right-0 rounded-full p-1 ${
                        theme === 'dark' 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* User Info Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Email
                </div>
                <div className={`p-2 rounded-md ${theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}`}>
                  {profile.email}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Member Since
                </div>
                <div className={`p-2 rounded-md ${theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}`}>
                  {new Date(profile.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Password Update Section - Only show for own profile */}
              {isOwnProfile && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                    Update Password
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}
                      />
                    </div>
                    <Button
                      onClick={handleUpdatePassword}
                      className={theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}
                    >
                      Update Password
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            {!isOwnProfile && (
              <Button
                onClick={handleStartChat}
                className={theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Start Chat
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage; 