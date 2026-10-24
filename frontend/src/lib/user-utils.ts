import { supabase } from './supabase';

export const updateExistingUsernames = async () => {
  try {
    // Get all users whose username is null or equal to their email
    const { data: users, error: fetchError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .or('username.is.null,username.eq.email');

    if (fetchError) throw fetchError;

    if (!users || users.length === 0) {
      console.log('No users need username updates');
      return;
    }

    // Update each user's username
    for (const user of users) {
      if (!user.email) continue;

      const newUsername = user.email.split('@')[0];
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Failed to update username for user ${user.id}:`, updateError);
        continue;
      }

      // Also update the user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { user_name: newUsername }
      });

      if (metadataError) {
        console.error(`Failed to update metadata for user ${user.id}:`, metadataError);
      }
    }

    console.log('Username updates completed');
  } catch (error) {
    console.error('Error updating usernames:', error);
  }
}; 