<?php

require_once __DIR__ . '/sesion_segura.php';

// Conservar el restaurante antes de cerrar la sesión.
$idRestaurante = filter_var(
    $_SESSION['id'] ?? 1,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if ($idRestaurante === false) {
    $idRestaurante = 1;
}

// Eliminar todas las variables de sesión.
$_SESSION = [];

// Invalidar también la cookie de sesión.
if (ini_get('session.use_cookies')) {

    $params = session_get_cookie_params();

    setcookie(session_name(), '', [
        'expires'  => time() - 3600,
        'path'     => $params['path'],
        'domain'   => $params['domain'],
        'secure'   => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => $params['samesite'] ?? 'Lax'
    ]);
}

// Destruir la sesión del servidor.
session_destroy();

// Regresar al restaurante seleccionado.
header('Location: ../index.php?id=' . $idRestaurante);
exit;