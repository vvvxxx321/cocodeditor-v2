-- Function to create a profile with auth id, name, and email when a new user is created
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  -- Insert a row into profiles with auth.users data
  insert into public."Profile" (
    id,
    name,
    email,
    "createdAt",
    "updatedAt"
  )
  values (
    new.id,
    concat(new.raw_user_meta_data->>'firstName', ' ', new.raw_user_meta_data->>'lastName'),-- Extract name from metadata
    new.email,
    now(),
    now()
  );
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();