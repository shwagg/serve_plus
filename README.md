Folder description:
assets = Images & icons
components = Reusable UI parts
pages = Full screens grouped by role
modules = Feature logic for each sprint domain
context = Global app states
services = Firebase + API calls
util = Helper logic & validators
router = App routing & redirections
backend/functions = Cloud Functions backend logic



Import yung local firebase emulators (copy) ->  firebase emulators:start --import=./emulator_data

Export yung changes -> firebase emulators:export ./emulator_data

if hindi gumana export, use -> firebase emulators:export ./emulator_data --force




isang run ng import and export -> firebase emulators:start --import=./emulator_data --export-on-exit


okay solution mga panget 

kung pagkaexport niyo parang nareplace yung folder from "emulator_data" to whateva 

close niyo lang lahat from database to vite(react) tas run this command 

Rename-Item (currentname)  emulator_data
Example: Rename-Item -Path "firebase-export-1767812823428G3B94I" -NewName "emulator_data"

Hi, for material-icons, install lang ito:
close yung run npm dev.
"npm install @mui/material @mui/icons-material @emotion/react @emotion/styled"
then run npm dev again.