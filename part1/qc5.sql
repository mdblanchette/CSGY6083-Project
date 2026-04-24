SELECT
	m.message_id,
	m.sender_id,
	u.username,
	m.body,
	m.posted_at
FROM Messages m
JOIN Users u ON m.sender_id = u.user_id
WHERE m.channel_id = 4
ORDER BY m.posted_at ASC;