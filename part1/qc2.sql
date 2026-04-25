INSERT INTO Channels (workspace_id, name, channel_type, created_by)
SELECT 1, 'channel-2', 'public', 1
WHERE EXISTS (
	SELECT 1
    FROM Workspace_Members
    WHERE workspace_id = 1
    AND user_id = 1
);