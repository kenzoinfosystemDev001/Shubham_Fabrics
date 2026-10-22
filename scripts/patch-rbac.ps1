$file = 'c:\Users\SujalKumar\Desktop\Shubham_Fabrics\apps\web\src\lib\rbac.ts'
$content = [System.IO.File]::ReadAllText($file)

$anchor = '  // Programming department routes protection'

$insert = "  // Steam Press Department routes protection`r`n  if (pathname.startsWith('/steam-press')) {`r`n    if (isSteamPressUser(user)) {`r`n      return { allowed: true, redirectTarget: pathname };`r`n    }`r`n    return {`r`n      allowed: false,`r`n      redirectTarget: defaultUserHome,`r`n      reason: 'Access Restricted: You are not authorized for the Steam Press Department. Access is restricted to Steam Press personnel and Admins.',`r`n    };`r`n  }`r`n`r`n  // Final QC Department routes protection`r`n  if (pathname.startsWith('/final-check')) {`r`n    if (isFinalCheckUser(user)) {`r`n      return { allowed: true, redirectTarget: pathname };`r`n    }`r`n    return {`r`n      allowed: false,`r`n      redirectTarget: defaultUserHome,`r`n      reason: 'Access Restricted: You are not authorized for the Final QC Department. Access is restricted to Final QC personnel and Admins.',`r`n    };`r`n  }`r`n`r`n  // Programming department routes protection"

$newContent = $content.Replace($anchor, $insert)

if ($newContent -eq $content) {
    Write-Host "ERROR: anchor not found"
} else {
    [System.IO.File]::WriteAllText($file, $newContent)
    Write-Host "SUCCESS: rbac.ts patched"
}
