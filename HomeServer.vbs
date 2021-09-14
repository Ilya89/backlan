Set oShell = Wscript.CreateObject("WScript.Shell")
CommandLine = "%COMSPEC% /c node src/app/app.js"
oShell.Run CommandLine, 0, 0