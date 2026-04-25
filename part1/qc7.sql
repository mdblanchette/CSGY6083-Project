-- This is based on the data from the insert_data.sql file
-- Alice has multiple messages with the keyword 'perpendicular' in the message body
SELECT m.message_id, c.name AS channel_name, w.name AS workspace_name, u.username AS sender, m.body, m.posted_at
FROM Messages m
JOIN Channels c ON m.channel_id = c.channel_id
JOIN Workspaces w ON c.workspace_id = w.workspace_id
JOIN Users u ON m.sender_id = u.user_id
WHERE m.body LIKE '%perpendicular%' -- finding the word 'perpendicular' anywhere in the message body
AND c.channel_id IN (
	SELECT channel_id
	FROM Channel_Members
	WHERE user_id = 1
)
AND c.workspace_id IN (
	SELECT workspace_id
	FROM Workspace_Members
	WHERE user_id = 1
)
ORDER BY m.posted_at ASC;
