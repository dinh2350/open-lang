# LiveKit Platform

A web app where a person talks out loud with an AI voice agent from the browser. For now it hosts one Agent; hosting many agents or tenants is out of scope.

## People and access

**User**:
A person with an account who signs in and talks to the Agent from a browser.
_Avoid_: caller, customer, client, account

**Role**:
What a User may do. Every User has exactly one Role: Member or Admin.
_Avoid_: permission level, group

**Member**:
The Role that may start Conversations. Every new User starts as a Member.

**Admin**:
The Role that may do everything a Member can, and also manage Users: change their Role, lock them, and reset their password.
_Avoid_: superuser, owner

**Locked User**:
A User an Admin has blocked. A Locked User can't sign in or start a new Conversation, but a Conversation already running continues until it ends.
_Avoid_: disabled, banned, deactivated

**Auth Token**:
The token that proves which User is calling the backend.
_Avoid_: access token (ambiguous with Room Token), session

**Room Token**:
The token that lets one User join the room of one Conversation.
_Avoid_: access token (ambiguous with Auth Token), LiveKit token

## Talking to the Agent

**Agent**:
The AI that holds a spoken conversation with a User. There is one Agent in the app.
_Avoid_: bot, assistant, voice bot

**Conversation**:
One spoken exchange between one User and the Agent. It starts when the User presses Start and ends when the User leaves. A reload starts a new Conversation; a Conversation can't be resumed.
_Avoid_: session, call, chat

**Agent Mode**:
How the Agent turns the User's speech into its spoken reply. In **Realtime** mode, one model listens and speaks. In **Pipeline** mode, separate models transcribe, think, and speak.
_Avoid_: engine, flow

**Provider**:
The AI vendor whose models the Agent uses: OpenAI or Google. In Pipeline mode, each step can use a different Provider.
_Avoid_: vendor, backend, model
