SELECT 
	w.workspace_id,
	w.name AS workspace_name,
	u.user_id,
	u.username,
	u.email
FROM Workspaces w
JOIN Workspace_Members wm ON w.workspace_id = wm.workspace_id
JOIN Users u ON wm.user_id = u.user_id
WHERE wm.is_admin = TRUE
ORDER BY w.workspace_id, u.username;