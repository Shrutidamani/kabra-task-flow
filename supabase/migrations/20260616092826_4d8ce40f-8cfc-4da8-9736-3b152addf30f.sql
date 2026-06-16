ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

DROP POLICY IF EXISTS "Authenticated can view attendance" ON public.attendance;
CREATE POLICY "View own or all if manager" ON public.attendance
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.can_manage(auth.uid()));