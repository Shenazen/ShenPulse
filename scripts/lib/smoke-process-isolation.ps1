# Arrêt limité à l'exécutable du smoke, jamais à tous les processus ShenPulse.
function Stop-ShenPulseSmokeProcesses {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [scriptblock]$ListProcesses = { Get-Process -Name ShenPulse -ErrorAction SilentlyContinue },
        [scriptblock]$FindProcess = { param($ProcessId) Get-Process -Id $ProcessId -ErrorAction Stop },
        [scriptblock]$StopProcess = { param($Process) Stop-Process -InputObject $Process -Force -ErrorAction Stop },
        [scriptblock]$WaitProcess = { param($Process) Wait-Process -InputObject $Process -Timeout 10 -ErrorAction Stop }
    )

    $exactPath = [IO.Path]::GetFullPath($Executable.Replace('/', '\'))
    $stopped = 0
    $alreadyExited = 0
    foreach ($snapshot in @(& $ListProcesses)) {
        if (-not $snapshot.Path -or -not [StringComparer]::OrdinalIgnoreCase.Equals(
            [IO.Path]::GetFullPath(([string]$snapshot.Path).Replace('/', '\')), $exactPath)) { continue }
        try {
            # Un PID capturé peut disparaître avec son parent : revalider la cible.
            $current = & $FindProcess $snapshot.Id
            if (-not $current) { throw 'Le PID du smoke a changé de cible : arrêt refusé.' }
            # Get-Process peut réussir juste avant la fin du processus. Seule
            # une propriété HasExited booléenne vraie prouve cette disparition.
            $hasExited = $current.HasExited
            $currentPath = [string]$current.Path
            if ($currentPath -and -not [StringComparer]::OrdinalIgnoreCase.Equals(
                [IO.Path]::GetFullPath($currentPath.Replace('/', '\')), $exactPath)) {
                throw 'Le PID du smoke a changé de cible : arrêt refusé.'
            }
            if ($hasExited -is [bool] -and $hasExited) {
                $alreadyExited += 1
                continue
            }
            if (-not $currentPath) {
                throw 'Le PID du smoke a changé de cible : arrêt refusé.'
            }
            & $StopProcess $current
            & $WaitProcess $current
            $stopped += 1
        }
        catch {
            if (($_.FullyQualifiedErrorId -split ',')[0] -ne 'NoProcessFoundForGivenId') { throw }
            # Seul un processus déjà terminé est toléré ; les autres erreurs bloquent.
            $alreadyExited += 1
        }
    }
    return [pscustomobject]@{ Stopped = $stopped; AlreadyExited = $alreadyExited }
}
