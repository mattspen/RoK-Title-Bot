#Persistent
#NoEnv
SendMode Input

; Define a function to process coordinates
ProcessCoordinates(x, y) {
    ; Activate the Bluestacks window
    WinActivate, Bluestacks ; Change this to the exact title or class of your Bluestacks window

    ; Wait until the window is active
    WinWaitActive, Bluestacks

    ; Example actions
    ; Move the mouse to coordinates and click (Replace with actual actions)
    MouseMove, x, y
    Click
}

; Handle command-line arguments
if (0 < 2) {
    x := %1%
    y := %2%
    ProcessCoordinates(x, y)
}
