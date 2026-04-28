-- =============================================
-- USERS (6 users)
-- =============================================
-- Password hashes are bcrypt placeholders
INSERT INTO Users (email, username, nickname, password_hash, created_at) VALUES
('alice@example.com',   'alice',   'Ali',     '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', NOW() - INTERVAL '30 days'),
('bob@example.com',     'bob',     'Bobby',   '$2b$12$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', NOW() - INTERVAL '30 days'),
('charlie@example.com', 'charlie', 'Chuck',   '$2b$12$CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', NOW() - INTERVAL '28 days'),
('diana@example.com',   'diana',   'Di',      '$2b$12$DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', NOW() - INTERVAL '28 days'),
('eve@example.com',     'eve',     'Evie',    '$2b$12$EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', NOW() - INTERVAL '25 days'),
('frank@example.com',   'frank',   'Frankie', '$2b$12$FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', NOW() - INTERVAL '20 days');
-- user_ids: alice=1, bob=2, charlie=3, diana=4, eve=5, frank=6


-- =============================================
-- WORKSPACES (2)
-- =============================================
INSERT INTO Workspaces (name, description, created_by, created_at) VALUES
('Engineering Team', 'Workspace for the engineering department', 1, NOW() - INTERVAL '15 days'),   -- ws 1, by Alice
('Design Team',      'Workspace for the design department',      2, NOW() - INTERVAL '14 days');   -- ws 2, by Bob


-- =============================================
-- WORKSPACE MEMBERS
-- =============================================
-- Workspace 1 (Engineering): Alice(admin), Bob(admin), Charlie, Diana, Eve
-- Workspace 2 (Design):      Bob(admin), Diana(admin), Eve, Frank
--
-- NOT in ws 1: Frank(6)
-- NOT in ws 2: Alice(1), Charlie(3)
INSERT INTO Workspace_Members (workspace_id, user_id, is_admin) VALUES
(1, 1, TRUE),    -- Alice  — admin of Engineering
(1, 2, TRUE),    -- Bob    — admin of Engineering
(1, 3, FALSE),   -- Charlie
(1, 4, FALSE),   -- Diana
(1, 5, FALSE),   -- Eve
(2, 2, TRUE),    -- Bob    — admin of Design
(2, 4, TRUE),    -- Diana  — admin of Design
(2, 5, FALSE),   -- Eve
(2, 6, FALSE);   -- Frank


-- =============================================
-- WORKSPACE INVITATIONS (for general completeness)
-- =============================================
INSERT INTO Workspace_Invitations (workspace_id, inviter, invitee, status, invited_at) VALUES
(2, 2, 1, 'pending',  NOW() - INTERVAL '10 days'),   -- Bob invited Alice to Design, still pending
(1, 1, 6, 'declined', NOW() - INTERVAL '12 days');   -- Alice invited Frank to Engineering, declined


-- =============================================
-- CHANNELS (7 channels across 2 workspaces)
-- =============================================
INSERT INTO Channels (workspace_id, name, channel_type, created_by, created_at) VALUES
(1, 'general',        'public',  1, NOW() - INTERVAL '15 days'),   -- ch 1, same day as ws1
(1, 'backend',        'public',  2, NOW() - INTERVAL '13 days'),   -- ch 2
(1, 'secret-project', 'private', 1, NOW() - INTERVAL '10 days'),   -- ch 3
(1, 'alice-charlie',  'direct',  1, NOW() - INTERVAL '8 days'),    -- ch 4
(2, 'design-general', 'public',  2, NOW() - INTERVAL '14 days'),   -- ch 5, same day as ws2
(2, 'ui-review',      'public',  4, NOW() - INTERVAL '12 days'),   -- ch 6
(2, 'bob-diana',      'direct',  2, NOW() - INTERVAL '9 days');    -- ch 7


-- =============================================
-- CHANNEL MEMBERS
-- =============================================
INSERT INTO Channel_Members (channel_id, user_id, is_admin) VALUES
-- Ch 1 (general, public, ws1)
(1, 1, TRUE),    -- Alice (admin)
(1, 2, FALSE),   -- Bob
(1, 3, FALSE),   -- Charlie
(1, 4, FALSE),   -- Diana

-- Ch 2 (backend, public, ws1)
(2, 1, TRUE),    -- Alice (admin)
(2, 2, FALSE),   -- Bob
(2, 3, FALSE),   -- Charlie
(2, 5, FALSE),   -- Eve

-- Ch 3 (secret-project, private, ws1)
(3, 1, TRUE),    -- Alice (admin)
(3, 3, FALSE),   -- Charlie

-- Ch 4 (alice-charlie DM, ws1)
(4, 1, FALSE),   -- Alice
(4, 3, FALSE),   -- Charlie

-- Ch 5 (design-general, public, ws2)
(5, 2, TRUE),    -- Bob (admin)
(5, 4, FALSE),   -- Diana
(5, 5, FALSE),   -- Eve
(5, 6, FALSE),   -- Frank

-- Ch 6 (ui-review, public, ws2)
(6, 2, FALSE),   -- Bob
(6, 4, TRUE),    -- Diana (admin)

-- Ch 7 (bob-diana DM, ws2)
(7, 2, FALSE),   -- Bob
(7, 4, FALSE);   -- Diana


-- =============================================
-- CHANNEL INVITATIONS
-- =============================================
INSERT INTO Channel_Invitations (channel_id, inviter, invitee, status, invited_at) VALUES

-- ---- Workspace 1 public channels ----

-- Ch 1 (general): Eve invited 10 days ago, pending, NOT a member → COUNTS
(1, 1, 5, 'pending',  NOW() - INTERVAL '10 days'),
-- Ch 1 (general): Frank invited 3 days ago, pending → does NOT count (< 5 days)
(1, 2, 6, 'pending',  NOW() - INTERVAL '3 days'),

-- Ch 2 (backend): Diana invited 8 days ago, pending, NOT a member → COUNTS
(2, 1, 4, 'pending',  NOW() - INTERVAL '8 days'),
-- Ch 2 (backend): Charlie invited 12 days ago, accepted, IS a member → does NOT count (joined)
(2, 2, 3, 'accepted', NOW() - INTERVAL '12 days'),

-- ---- Workspace 2 public channels ----

-- Ch 5 (design-general): Alice invited 4 days ago, pending → does NOT count (< 5 days)
(5, 2, 1, 'pending',  NOW() - INTERVAL '4 days'),

-- Ch 6 (ui-review): Frank invited 10 days ago, pending, NOT a member → COUNTS
(6, 4, 6, 'pending',  NOW() - INTERVAL '10 days'),
-- Ch 6 (ui-review): Eve invited 7 days ago, declined, NOT a member → edge case
(6, 4, 5, 'declined', NOW() - INTERVAL '7 days'),
-- Ch 6 (ui-review): Charlie invited 6 days ago, pending, NOT a member, NOT in ws2 → edge case
(6, 2, 3, 'pending',  NOW() - INTERVAL '6 days');


-- =============================================
-- MESSAGES (23 messages across all channels)
-- =============================================
INSERT INTO Messages (channel_id, sender_id, body, posted_at) VALUES

-- ---- Channel 1: general (public, ws1) — 6 messages ----
(1, 1, 'Hey everyone, welcome to the general channel!',
       NOW() - INTERVAL '7 days'),
(1, 2, 'Thanks Alice! Excited to get started.',
       NOW() - INTERVAL '7 days' + INTERVAL '30 minutes'),
(1, 3, 'Does anyone know if the two lines are perpendicular?',
       NOW() - INTERVAL '6 days'),
(1, 4, 'I think they might be perpendicular, yes.',
       NOW() - INTERVAL '6 days' + INTERVAL '15 minutes'),
(1, 1, 'Let''s focus on the project timeline.',
       NOW() - INTERVAL '5 days'),
(1, 2, 'Agreed. I''ll draft a schedule.',
       NOW() - INTERVAL '4 days'),

-- ---- Channel 2: backend (public, ws1) — 4 messages ----
(2, 1, 'We need to refactor the API layer.',
       NOW() - INTERVAL '5 days'),
(2, 2, 'I noticed the perpendicular intersection of our service boundaries is causing issues.',
       NOW() - INTERVAL '4 days'),
(2, 5, 'I can help with the database migration.',
       NOW() - INTERVAL '3 days'),
(2, 1, 'Great, let''s sync tomorrow.',
       NOW() - INTERVAL '2 days'),

-- ---- Channel 3: secret-project (private, ws1) — 2 messages ----
(3, 1, 'This is top secret. Do not share outside this channel.',
       NOW() - INTERVAL '6 days'),
(3, 3, 'The perpendicular approach might work better for the architecture.',
       NOW() - INTERVAL '5 days'),

-- ---- Channel 4: alice-charlie DM (ws1) — 2 messages ----
(4, 1, 'Hey Charlie, quick question about the project.',
       NOW() - INTERVAL '3 days'),
(4, 3, 'Sure, what''s up?',
       NOW() - INTERVAL '3 days' + INTERVAL '10 minutes'),

-- ---- Channel 5: design-general (public, ws2) — 5 messages ----
(5, 2, 'Welcome to the design team channel!',
       NOW() - INTERVAL '6 days'),
(5, 4, 'Let''s review the latest mockups this week.',
       NOW() - INTERVAL '5 days'),
(5, 5, 'The perpendicular layout looks great for the dashboard.',
       NOW() - INTERVAL '4 days'),
(5, 6, 'I prefer the horizontal layout personally.',
       NOW() - INTERVAL '3 days'),
(5, 2, 'Let''s vote on which layout to go with.',
       NOW() - INTERVAL '2 days'),

-- ---- Channel 6: ui-review (public, ws2) — 2 messages ----
(6, 2, 'UI review for sprint 5 starts now.',
       NOW() - INTERVAL '4 days'),
(6, 4, 'The buttons need perpendicular alignment to the toolbar.',
       NOW() - INTERVAL '3 days'),

-- ---- Channel 7: bob-diana DM (ws2) — 2 messages ----
(7, 2, 'Diana, can you review the new designs by Friday?',
       NOW() - INTERVAL '2 days'),
(7, 4, 'Sure, I''ll take a look this afternoon.',
       NOW() - INTERVAL '1 day');