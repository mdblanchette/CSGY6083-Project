SELECT 
	m.message_id,
	c.name AS channel_name,
	w.name AS workspace_name,
	m.body,
	m.posted_at
FROM Messages m
JOIN Channels c ON m.channel_id   = c.channel_id
JOIN Workspaces w ON c.workspace_id = w.workspace_id
WHERE m.sender_id = 5
ORDER BY m.posted_at ASC;