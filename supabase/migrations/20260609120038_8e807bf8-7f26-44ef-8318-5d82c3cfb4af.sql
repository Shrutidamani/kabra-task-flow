-- 1. Task visibility: staff see only their tasks; managers/admins see all
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
CREATE POLICY "View own or all if manager" ON public.tasks
  FOR SELECT TO authenticated
  USING (can_manage(auth.uid()) OR auth.uid() = assigned_to OR auth.uid() = created_by);

-- 2. Attendance
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave');

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note text,
  marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view attendance" ON public.attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage attendance insert" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage attendance update" ON public.attendance
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage attendance delete" ON public.attendance
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  task_id uuid,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Notify assignee on new task
CREATE OR REPLACE FUNCTION public.notify_on_task_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, title, body, task_id, type)
    VALUES (
      NEW.assigned_to,
      'New task assigned: ' || NEW.title,
      COALESCE('Client: ' || NEW.company, 'A new task has been assigned to you.'),
      NEW.id,
      'task_assigned'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_insert AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_insert();

-- Notify all admins on task update / completion
CREATE OR REPLACE FUNCTION public.notify_on_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' THEN
      msg := 'Task completed: ' || NEW.title;
    ELSE
      msg := 'Task updated (' || NEW.status || '): ' || NEW.title;
    END IF;

    FOR admin_id IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      IF admin_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, title, body, task_id, type)
        VALUES (admin_id, msg, COALESCE('Client: ' || NEW.company, NULL), NEW.id, 'task_update');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_update AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_update();

-- 4. Push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own push subs insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own push subs delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);