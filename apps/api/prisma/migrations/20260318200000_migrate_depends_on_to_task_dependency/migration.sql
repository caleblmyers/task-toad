-- Migrate dependsOn JSON arrays to TaskDependency records
INSERT INTO task_dependencies (task_dependency_id, source_task_id, target_task_id, link_type, created_at)
SELECT
  gen_random_uuid(),
  dep_id::text,
  t.task_id,
  'blocks',
  NOW()
FROM tasks t,
  json_array_elements_text(t.depends_on::json) AS dep_id
WHERE t.depends_on IS NOT NULL
  AND t.depends_on != 'null'
  AND t.depends_on != '[]'
ON CONFLICT (source_task_id, target_task_id, link_type) DO NOTHING;

-- Drop the legacy column
ALTER TABLE "tasks" DROP COLUMN "depends_on";
