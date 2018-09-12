# Common Lab Use Clock Kit (CLUCK)

This is the client for the Common Lab Use Clock Kit (CLUCK) created by Dylan Smith with FRC Team 1540 The Flaming Chickens.
I will go through a detailed (or soon to be detailed) description of each app and how to set them up.

## Setup
The following will be changed shortly when a new update comes out to make the apps more user friendly.
Complete the following for each app:
1. In the downloaded folder, run `npm i` in a command prompt window.
2. [To Be Changed Soon] Create `credentials.json`. The file should look like this: `{"username":"paste_username_here","password":"paste_password_here"}`
3. In the downloaded folder, run `npm start` in a command prompt window.
4. The app will ask for a server address and port. Input the appropriate information.

## Clock App

This is the main app that will be used, for regular users clocking in and out the lab.

## Attendance App

This is an app that displays all members that are currently clocked into the lab.

## Admin App

This is an app that requries admin credentials and can be used to:
- add or remove users
- edit user information, such as an ID or email
- manually clock in/out users
- clock out a user without incrementing their hours
- viewing all users who are currently clocked in
