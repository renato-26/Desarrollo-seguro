<?php
// VUL-07: migración única de contraseñas en texto plano a hash seguro.
// Uso (solo por consola): php Script_BD/migrar_passwords_vul07.php
// Es idempotente: las contraseñas que ya son hash no se vuelven a procesar.

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Acceso no autorizado');
}

require __DIR__ . '/../pnkSecurity/setup/setup.php';

$con = conectar();
mysqli_set_charset($con, 'utf8mb4');

$result = mysqli_query($con, 'SELECT Id, password FROM usuarios');
$update = mysqli_prepare($con, 'UPDATE usuarios SET password = ? WHERE Id = ?');

$migrados = 0;
$omitidos = 0;

while ($fila = mysqli_fetch_assoc($result)) {
    $actual = (string) ($fila['password'] ?? '');

    // Omitir vacías y las que ya son un hash reconocido por PHP.
    if ($actual === '' || password_get_info($actual)['algoName'] !== 'unknown') {
        $omitidos++;
        continue;
    }

    $hash = password_hash($actual, PASSWORD_DEFAULT);
    $id   = (int) $fila['Id'];
    mysqli_stmt_bind_param($update, 'si', $hash, $id);
    mysqli_stmt_execute($update);
    $migrados++;
}

mysqli_stmt_close($update);

echo "Contrasenas migradas: {$migrados}" . PHP_EOL;
echo "Registros omitidos (ya eran hash o vacios): {$omitidos}" . PHP_EOL;