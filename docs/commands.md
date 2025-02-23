# Commands

There are a few commands that can be used by entering them in the chat.

### `/admin <code>`

If your world has an admin code set, the only way to become an admin is to use this command with your code (see your .env file).

If you're .env doesn't have an ADMIN_CODE set, then all players are given the admin role temporarily.

### `/spawn set`

Sets the spawn point for all future players entering the world, to the current position and direction you are facing. Requires admin role.

### `/spawn clear`

Resets the spawn point back to origin. Requires admin role.

### `/name <name>`

Sets your name.
This is currently the only way to change your name, until the UI for it is built.

### `/chat clear`

Clears all chat messages. Requires admin privledges to use. 