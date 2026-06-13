CREATE OR REPLACE FUNCTION public.generate_due_date_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  admin_id uuid;
  days_left integer;
  when_text text;
  msg text;
  created_count integer := 0;
BEGIN
  FOR t IN
    SELECT id, title, company, due_date, assigned_to
    FROM public.tasks
    WHERE status <> 'completed'
      AND due_date IS NOT NULL
      AND due_date <= (CURRENT_DATE + 2)
  LOOP
    days_left := t.due_date - CURRENT_DATE;
    IF days_left < 0 THEN
      when_text := 'overdue';
    ELSIF days_left = 0 THEN
      when_text := 'due today';
    ELSE
      when_text := 'due in ' || days_left || ' day' || CASE WHEN days_left = 1 THEN '' ELSE 's' END;
    END IF;
    msg := 'Reminder: "' || t.title || '" is ' || when_text;

    -- Notify assignee
    IF t.assigned_to IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
         WHERE n.task_id = t.id AND n.user_id = t.assigned_to
           AND n.type = 'task_due' AND n.created_at::date = CURRENT_DATE
       ) THEN
      INSERT INTO public.notifications (user_id, title, body, task_id, type)
      VALUES (t.assigned_to, msg, COALESCE('Client: ' || t.company, NULL), t.id, 'task_due');
      created_count := created_count + 1;
    END IF;

    -- Notify all admins
    FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      IF admin_id <> COALESCE(t.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid)
         AND NOT EXISTS (
           SELECT 1 FROM public.notifications n
           WHERE n.task_id = t.id AND n.user_id = admin_id
             AND n.type = 'task_due' AND n.created_at::date = CURRENT_DATE
         ) THEN
        INSERT INTO public.notifications (user_id, title, body, task_id, type)
        VALUES (admin_id, msg, COALESCE('Client: ' || t.company, NULL), t.id, 'task_due');
        created_count := created_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN created_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_due_date_reminders() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_date_reminders() TO service_role;