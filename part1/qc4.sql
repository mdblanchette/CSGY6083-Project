SELECT c.channel_id, c.name AS channel_name, COUNT(ci.invitation_id) AS pending_invitations
FROM Channels c
JOIN Channel_Invitations ci ON c.channel_id = ci.channel_id
WHERE c.workspace_id = 1 AND  c.channel_type = 'public' AND  ci.status = 'pending' AND  ci.invited_at  < CURRENT_TIMESTAMP - INTERVAL '5 days'
GROUP BY c.channel_id, c.name
ORDER BY c.name;