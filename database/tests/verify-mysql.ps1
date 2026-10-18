# Kiểm thử tích hợp SQL trên MySQL thật; tạo database tạm riêng rồi tự dọn database đó.
# Không sửa/xóa database pickleball_db hoặc dữ liệu người dùng.
# Nếu tài khoản có mật khẩu, dùng mysql login-path hoặc MYSQL_PWD của phiên hiện tại;
# không truyền mật khẩu vào dòng lệnh hoặc ghi mật khẩu vào mã nguồn.
[CmdletBinding()]
param(
    [string]$Mysql = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe',
    [string]$HostName = '127.0.0.1',
    [int]$Port = 3307,
    [string]$UserName = 'root',
    [string]$DefaultsFile = '',
    [switch]$KeepDatabase
)
$ErrorActionPreference = 'Stop'
$testDatabase = 'pickleball_verify_' + [guid]::NewGuid().ToString('N')
$sqlDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.Replace('\', '/')
$checks = 0
$clientArguments = @('--protocol=TCP', "--host=$HostName", "--port=$Port", "--user=$UserName",
    '--default-character-set=utf8mb4', '--batch', '--skip-column-names')
if ($DefaultsFile) { $clientArguments = @("--defaults-extra-file=$DefaultsFile") + $clientArguments }

function Invoke-TestSql([string]$Sql, [switch]$ServerOnly) {
    $arguments = $clientArguments
    if (-not $ServerOnly) { $arguments += "--database=$testDatabase" }
    $arguments += "--execute=$Sql"
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Mysql
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in $arguments) { $start.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::Start($start)
    $outputTask = $process.StandardOutput.ReadToEndAsync()
    $errorTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $result = @{ Code = $process.ExitCode; Output = $outputTask.Result.Trim(); Error = $errorTask.Result.Trim() }
    $process.Dispose()
    return $result
}
function Sql([string]$Statement) {
    $result = Invoke-TestSql $Statement
    if ($result.Code -ne 0) { throw $result.Error }
    return $result.Output
}
function Assert-Equal([string]$Actual, [string]$Expected, [string]$Name) {
    if ($Actual -ne $Expected) { throw "FAIL $Name : expected '$Expected', got '$Actual'" }
    $script:checks++
    Write-Host "PASS $Name"
}
function Assert-Error([string]$Statement, [string]$Expected, [string]$Name) {
    $result = Invoke-TestSql $Statement
    if ($result.Code -eq 0 -or -not $result.Error.Contains($Expected)) {
        throw "FAIL $Name : expected '$Expected', got '$($result.Output) $($result.Error)'"
    }
    $script:checks++
    Write-Host "PASS $Name"
}
function Invoke-ConcurrentSql([string[]]$Statements) {
    $processes = @()
    foreach ($statement in $Statements) {
        $start = [System.Diagnostics.ProcessStartInfo]::new()
        $start.FileName = $Mysql
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        foreach ($argument in ($clientArguments + @("--database=$testDatabase", "--execute=$statement"))) {
            $start.ArgumentList.Add($argument)
        }
        $process = [System.Diagnostics.Process]::Start($start)
        $processes += @{ Process = $process; Output = $process.StandardOutput.ReadToEndAsync(); Error = $process.StandardError.ReadToEndAsync() }
    }
    $results = @()
    foreach ($entry in $processes) {
        $entry.Process.WaitForExit()
        $results += @{ Code = $entry.Process.ExitCode; Output = $entry.Output.Result.Trim(); Error = $entry.Error.Result.Trim() }
        $entry.Process.Dispose()
    }
    return $results
}

$created = $false
try {
    $result = Invoke-TestSql "CREATE DATABASE $testDatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci" -ServerOnly
    if ($result.Code -ne 0) { throw $result.Error }
    $created = $true
    foreach ($file in @('01_schema.sql', '02_routines.sql', '03_seed.sql')) {
        $null = Sql "source $sqlDirectory/$file"
    }
    Assert-Equal (Sql 'SELECT CONCAT((SELECT COUNT(*) FROM customers),",",(SELECT COUNT(*) FROM courts),",",(SELECT COUNT(*) FROM time_slots))') '8,4,17' 'reference data imported'

    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(),NULL)' 'INVALID_SLOTS' 'empty selection rejected'
    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY("1"),NULL)' 'INVALID_SLOTS' 'string slot id rejected'
    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(1,1),NULL)' 'INVALID_SLOTS' 'duplicate slot ids rejected'
    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(1,999),NULL)' 'INVALID_SLOTS' 'missing slot rejected'
    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(1,3),NULL)' 'NON_CONTIGUOUS_SLOTS' 'nonconsecutive slots rejected'
    Assert-Error 'CALL sp_create_booking(1,4,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(1),NULL)' 'COURT_UNAVAILABLE' 'maintenance court rejected'
    Assert-Error 'CALL sp_create_booking(999,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(1),NULL)' 'CUSTOMER_NOT_FOUND' 'missing customer rejected'
    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE - INTERVAL 1 DAY,JSON_ARRAY(1),NULL)' 'INVALID_DATE' 'past date rejected'
    Assert-Error 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 31 DAY,JSON_ARRAY(1),NULL)' 'INVALID_DATE' 'over 30 day limit rejected'

    $bookingId = Sql 'CALL sp_create_booking(1,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(13,14),"Two hours")'
    Assert-Equal (Sql "SELECT CONCAT(COUNT(*),',',SUM(unit_price)) FROM booking_items WHERE booking_id=$bookingId") '2,300000' 'two consecutive hours saved atomically'
    $before = Sql 'SELECT COUNT(*) FROM bookings'
    Assert-Error 'CALL sp_create_booking(2,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(12,13),NULL)' 'BOOKING_CONFLICT' 'overlap rejected even after first free slot'
    Assert-Equal (Sql 'SELECT COUNT(*) FROM bookings') $before 'failed order header rolled back'
    Assert-Equal (Sql 'SELECT COUNT(*) FROM booking_items WHERE court_id=1 AND time_slot_id=12 AND released_at IS NULL') '0' 'failed order first slot rolled back'
    $null = Sql "CALL sp_cancel_booking($bookingId)"
    Assert-Equal (Sql "SELECT CONCAT(b.status,',',COUNT(bi.id),',',SUM(bi.active_guard IS NULL)) FROM bookings b JOIN booking_items bi ON bi.booking_id=b.id WHERE b.id=$bookingId GROUP BY b.status") 'CANCELLED,2,2' 'cancellation releases slots and retains detail history'
    $newId = Sql 'CALL sp_create_booking(2,1,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(13,14),NULL)'
    Assert-Equal (Sql "SELECT COUNT(*) FROM booking_items WHERE booking_id=$newId AND released_at IS NULL") '2' 'released slots can be booked again'
    $null = Sql 'UPDATE courts SET hourly_price=175000 WHERE id=1'
    $null = Sql "CALL sp_pay_booking($newId,'CASH')"
    Assert-Equal (Sql "SELECT amount FROM payments WHERE booking_id=$newId") '300000' 'historical price remains after court price update'
    Assert-Error "CALL sp_pay_booking($newId,'CASH')" 'ALREADY_PAID' 'double payment rejected'
    Assert-Error "CALL sp_cancel_booking($newId)" 'PAID_BOOKING_CANNOT_CANCEL' 'paid booking cancellation rejected'
    Assert-Error "CALL sp_complete_booking($newId)" 'BOOKING_NOT_FINISHED' 'future paid booking cannot complete'
    Assert-Error "UPDATE booking_items SET unit_price=1 WHERE booking_id=$newId" 'BOOKING_IMMUTABLE' 'price snapshot cannot be edited'
    Assert-Error "UPDATE payments SET amount=1 WHERE booking_id=$newId" 'PAYMENT_IMMUTABLE' 'payment cannot be edited'

    $unpaidId = Sql 'CALL sp_create_booking(3,2,CURRENT_DATE + INTERVAL 1 DAY,JSON_ARRAY(4,5),NULL)'
    Assert-Error "CALL sp_complete_booking($unpaidId)" 'PAYMENT_REQUIRED' 'unpaid booking cannot complete'
    Assert-Error "INSERT INTO payments(booking_id,amount,method) VALUES($unpaidId,1,'CASH')" 'INVALID_PAYMENT_AMOUNT' 'direct partial payment rejected by trigger'
    $null = Sql "CALL sp_cancel_booking($unpaidId)"
    Assert-Error "INSERT INTO booking_items(booking_id,court_id,play_date,time_slot_id,unit_price) VALUES($unpaidId,2,CURRENT_DATE + INTERVAL 1 DAY,6,150000)" 'INVALID_TRANSITION' 'direct insert into cancelled order rejected'

    # Lịch sử quá khứ phục vụ demo: tạo header CONFIRMED và chi tiết rồi chuyển trạng thái đúng quy tắc.
    $pastId = Sql "INSERT INTO bookings(booking_code,customer_id,created_at) VALUES(CONCAT('SQL-PAST-',UUID()),4,CURRENT_DATE - INTERVAL 3 DAY); SELECT LAST_INSERT_ID()"
    $null = Sql "INSERT INTO booking_items(booking_id,court_id,play_date,time_slot_id,unit_price) VALUES($pastId,2,CURRENT_DATE - INTERVAL 2 DAY,1,150000),($pastId,2,CURRENT_DATE - INTERVAL 2 DAY,2,150000)"
    $null = Sql "CALL sp_pay_booking($pastId,'TRANSFER'); CALL sp_complete_booking($pastId)"
    Assert-Equal (Sql "SELECT status FROM bookings WHERE id=$pastId") 'COMPLETED' 'past fully paid booking completes'
    Assert-Error "CALL sp_cancel_booking($pastId)" 'INVALID_TRANSITION' 'completed booking is final'

    $race = Invoke-ConcurrentSql @(
        'CALL sp_create_booking(5,3,CURRENT_DATE + INTERVAL 2 DAY,JSON_ARRAY(10,11),NULL)',
        'CALL sp_create_booking(6,3,CURRENT_DATE + INTERVAL 2 DAY,JSON_ARRAY(10,11),NULL)'
    )
    Assert-Equal ([string]@($race | Where-Object { $_.Code -eq 0 }).Count) '1' 'one simultaneous booking succeeds'
    Assert-Equal ([string]@($race | Where-Object { $_.Error.Contains('BOOKING_CONFLICT') }).Count) '1' 'other simultaneous booking reports conflict'
    Assert-Equal (Sql 'SELECT COUNT(DISTINCT booking_id) FROM booking_items WHERE court_id=3 AND play_date=CURRENT_DATE + INTERVAL 2 DAY AND released_at IS NULL') '1' 'database has exactly one owner of raced slots'

    $raceId = Sql 'CALL sp_create_booking(7,2,CURRENT_DATE + INTERVAL 3 DAY,JSON_ARRAY(8),NULL)'
    $race = Invoke-ConcurrentSql @("CALL sp_pay_booking($raceId,'CASH')", "CALL sp_cancel_booking($raceId)")
    Assert-Equal ([string]@($race | Where-Object { $_.Code -eq 0 }).Count) '1' 'payment and cancellation serialize'
    Assert-Equal (Sql "SELECT COUNT(*) FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE b.id=$raceId AND b.status='CANCELLED'") '0' 'cancelled order never has a payment'

    $null = Sql "source $sqlDirectory/04_queries.sql"
    $checks++
    Write-Host 'PASS all 12 educational SELECT queries execute'
    Write-Host "All $checks SQL integration checks passed on MySQL $(Sql 'SELECT VERSION()')."
} finally {
    if ($created -and -not $KeepDatabase) {
        # Tên do script tự sinh và kiểm tra chặt; chỉ DROP database tạm do lần chạy này tạo.
        if ($testDatabase -notmatch '^pickleball_verify_[0-9a-f]{32}$') { throw 'Invalid temporary database name.' }
        $result = Invoke-TestSql "DROP DATABASE $testDatabase" -ServerOnly
        if ($result.Code -ne 0) { Write-Warning "Could not remove temporary test database $testDatabase : $($result.Error)" }
    } elseif ($created) {
        Write-Host "Kept isolated database: $testDatabase"
    }
}
