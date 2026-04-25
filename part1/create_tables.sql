-- Drop Tables
DROP TABLE IF EXISTS Messages              CASCADE;
DROP TABLE IF EXISTS Channel_Invitations   CASCADE;
DROP TABLE IF EXISTS Channel_Members       CASCADE;
DROP TABLE IF EXISTS Channels              CASCADE;
DROP TABLE IF EXISTS Workspace_Invitations CASCADE;
DROP TABLE IF EXISTS Workspace_Members     CASCADE;
DROP TABLE IF EXISTS Workspaces            CASCADE;
DROP TABLE IF EXISTS Users                 CASCADE;

-- Create Tables
CREATE TABLE Users (
	user_id		SERIAL PRIMARY KEY,
	email		VARCHAR(255) NOT NULL UNIQUE,
	username	VARCHAR(50)  NOT NULL UNIQUE,
	nickname	VARCHAR(50),
	password_hash	VARCHAR(255) NOT NULL
);

CREATE TABLE Workspaces (
	workspace_id	SERIAL PRIMARY KEY,
	name		VARCHAR(100) NOT NULL,
	description	VARCHAR(500),
	created_by	INT REFERENCES Users(user_id) ON DELETE SET NULL
);

CREATE TABLE Workspace_Members (
	workspace_id	INT NOT NULL REFERENCES Workspaces(workspace_id) ON DELETE CASCADE,
	user_id		INT NOT NULL REFERENCES Users(user_id)           ON DELETE CASCADE,
	is_admin	BOOLEAN NOT NULL DEFAULT FALSE,
	PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE Workspace_Invitations (
	invitation_id	SERIAL PRIMARY KEY,
	workspace_id	INT NOT NULL REFERENCES Workspaces(workspace_id) ON DELETE CASCADE,
	inviter		INT NOT NULL REFERENCES Users(user_id)           ON DELETE CASCADE,
	invitee		INT NOT NULL REFERENCES Users(user_id)           ON DELETE CASCADE,
	status		VARCHAR(10) NOT NULL DEFAULT 'pending'
			CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE TABLE Channels (
	channel_id	SERIAL PRIMARY KEY,
	workspace_id	INT NOT NULL REFERENCES Workspaces(workspace_id) ON DELETE CASCADE,
	name		VARCHAR(100) NOT NULL,
	channel_type	VARCHAR(10) NOT NULL CHECK (channel_type IN ('public', 'private', 'direct')),
	created_by	INT REFERENCES Users(user_id) ON DELETE SET NULL,
	UNIQUE (workspace_id, name)
);

CREATE TABLE Channel_Members (
	channel_id	INT NOT NULL REFERENCES Channels(channel_id) ON DELETE CASCADE,
	user_id		INT NOT NULL REFERENCES Users(user_id)       ON DELETE CASCADE,
	is_admin	BOOLEAN NOT NULL DEFAULT FALSE,
	PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE Channel_Invitations (
	invitation_id	SERIAL PRIMARY KEY,
	channel_id	INT NOT NULL REFERENCES Channels(channel_id) ON DELETE CASCADE,
	inviter		INT NOT NULL REFERENCES Users(user_id)       ON DELETE CASCADE,
	invitee		INT NOT NULL REFERENCES Users(user_id)       ON DELETE CASCADE,
	invited_at	TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	status		VARCHAR(10) NOT NULL DEFAULT 'pending'
			CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE TABLE Messages (
	message_id	SERIAL PRIMARY KEY,
	channel_id	INT  NOT NULL REFERENCES Channels(channel_id) ON DELETE CASCADE,
	sender_id	INT  REFERENCES Users(user_id)                ON DELETE SET NULL,
	body		TEXT NOT NULL,
	posted_at	TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);