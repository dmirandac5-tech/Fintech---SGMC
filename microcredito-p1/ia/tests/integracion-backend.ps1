$base = "http://localhost:3000/api"
$rutas = @(
    "/creditos/CV-2026-0030?fechaCorte=2026-10-31",
    "/creditos/CV-2026-0030/plan?fechaCorte=2026-10-31",
    "/creditos/CV-2026-0030/mora?cuota=3&fechaCorte=2026-10-31",
    "/cartera/resumen?fechaCorte=2026-10-31",
    "/cartera/morosos?tramo=Mora%203&fechaCorte=2026-10-31",
    "/creditos/vencimientos?dias=7&fechaCorte=2026-10-31",
    "/cierres/diario?fechaCorte=2026-10-31",
    "/cierres/mensual?fechaCorte=2026-10-31"
)
$resultados = @()
foreach ($ruta in $rutas) {
    try {
        $respuesta = Invoke-WebRequest `
            -Uri "$base$ruta" `
            -Method GET `
            -UseBasicParsing `
            -TimeoutSec 8 `
            -ErrorAction Stop
        $codigo = [int]$respuesta.StatusCode
        $estado = if ($codigo -eq 200) { "RESPONDE" } else { "REVISAR" }
    }
    catch {
        $codigo = 0
        if ($_.Exception.Response) {
            $codigo = [int]$_.Exception.Response.StatusCode
        }
        $estado = if ($codigo -eq 0) { "SIN CONEXION" } else { "REVISAR" }
    }
    $resultados += [pscustomobject]@{
        Ruta = $ruta
        HTTP = $codigo
        Estado = $estado
    }
}
$resultados | Format-Table -AutoSize
$resultados |
    ConvertTo-Json -Depth 5 |
    Set-Content ".\evidencias\integracion-backend.json" -Encoding UTF8
Write-Host "VERIFICACION FINALIZADA" -ForegroundColor Green
