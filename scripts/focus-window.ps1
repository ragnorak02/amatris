param([int]$ParentPid)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$elapsed = 0
while ($elapsed -lt 8000) {
    Start-Sleep -Milliseconds 500
    $elapsed += 500

    $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }

    # Try direct PID match first
    $target = $procs | Where-Object { $_.Id -eq $ParentPid } | Select-Object -First 1

    # If no window on parent, check child processes (Godot often spawns a child)
    if (-not $target) {
        try {
            $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ParentPid }
            foreach ($c in $children) {
                $target = $procs | Where-Object { $_.Id -eq $c.ProcessId } | Select-Object -First 1
                if ($target) { break }
            }
        } catch {}
    }

    if ($target) {
        # SW_RESTORE = 9 (restore if minimized), then bring to front
        [WinFocus]::ShowWindow($target.MainWindowHandle, 9) | Out-Null
        [WinFocus]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
        exit 0
    }
}
