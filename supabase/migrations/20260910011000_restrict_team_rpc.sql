-- Supabase's default privileges can grant anon directly, independently of
-- PUBLIC. Explicitly remove that grant from authenticated-only RPCs.
revoke all on function public.studio_role(uuid) from anon;
revoke all on function public.list_studios() from anon;
revoke all on function public.list_studio_members(uuid) from anon;
revoke all on function public.create_studio_invite(uuid,text,text) from anon;
revoke all on function public.accept_studio_invite(text) from anon;
revoke all on function public.update_artist_appointment(uuid,timestamptz,text,text) from anon;
