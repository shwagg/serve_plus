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

mas okay gamitin for isahang run (import-export):
firebase emulators:start --import=./emulator_data --export-on-exit=./emulator_data


okay solution mga panget
kung pagkaexport niyo parang nareplace yung folder from "emulator_data" to whateva 

close niyo lang lahat from database to vite(react) tas run this command 

Rename-Item (currentname)  emulator_data
Example: 
Rename-Item "firebase-export-1778020336585lW0KOO" -NewName "emulator_data"

Hi, for material-icons, install lang ito:
close yung run npm dev.
"npm install @mui/material @mui/icons-material @emotion/react @emotion/styled"
then run npm dev again.

for QR naginstall ako na pang-react,
install: npm install qrcode.react

for text editor in agreement,
install: npm install @tiptap/react @tiptap/starter-kit dompurify



users w/ positions:
admin@test.com = admin/regular
admin2@test.com = admin/director
faculty2@test.com = faculty/program chair
faculty3@test.com = faculty/college dean

proposal approval sequence:
student -> create/submit a proposal first
faculty2@test.com -> faculty/program chair (dito next magrereflect for approval) (REVIEWED BY)
faculty3@test.com -> faculty/college dean  (RECOMMENDED BY)
admin@test.com -> admin/regular  (ENDORSED BY)
admin2@test.com -> admin/director (final approval) (APPROVED BY)
